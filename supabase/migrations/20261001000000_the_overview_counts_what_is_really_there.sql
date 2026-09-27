-- Genel Bakış, kurumda gerçekten ne olduğunu sayar.
--
-- =========================================================================
-- Neden gerekti
-- =========================================================================
--
-- Yönetici Genel Bakış ekranı hiçbir servisi çağırmıyordu; bütün kartlarını
-- demo modülünden alıyordu (ROADMAP §4.23 B3, `v1.5-22`). Demo modda dolu
-- görünüyor, gerçek modda her şeye sıfır diyordu. 2026-09-27'de üretimde
-- ölçüldü: kurumda 1 öğrenci, 1 sınıf, 1 yoklama, 1 sınav, 1 ödev, 1 ödeme
-- planı ve 1 duyuru vardı; ekran hepsine "0" ve "Gösterilecek kayıt yok"
-- diyordu. Üstüne "Sistemler çalışıyor" ve "Günün eğitim operasyonu kontrol
-- altında" gibi hiçbir ölçüme dayanmayan iki cümle taşıyordu (**K-03**).
--
-- Yeni ekran sayı değil **dikkat isteyen durum** gösteriyor: sınıfa kaydı
-- olmayan öğrenci, velisi bağlanmamış öğrenci, bugün dersi olup yoklaması
-- alınmamış sınıf. Bu sayılar istemcide hesaplanabilirdi — öğrenci listesi
-- sınıf kayıtlarını zaten taşıyor. Ama o liste **100 satırla sınırlı** ve
-- `20260908020000`'ın öğrettiği şey tam burada geçerli: satır çekip sayan
-- istemci, tavana dayandığında **yetkili görünen yanlış bir sayı** üretir.
-- Sayım veritabanında yapılır.
--
-- =========================================================================
-- İki fonksiyon
-- =========================================================================
--
-- `admin_overview_counts(kurum)` — tek satır: aktif öğrenci, sınıfa kayıtsız
-- öğrenci, velisiz öğrenci, aktif sınıf, bugünkü ders, bugün dersi olup
-- yoklaması alınmamış sınıf.
--
-- `today_lessons(kurum)` — bugünün ders programı satırları, her birinin
-- yanında sınıfın bugünkü yoklamasının açılıp açılmadığı.
--
-- **İkisi de `security definer` DEĞİL.** Çağıranın hakları geçerli kalır, RLS
-- olduğu gibi uygulanır. Yönetici kendi kurumunu sayar; öğretmen çağırsa
-- yalnız görebildiğini sayar. Kapsamı elle yeniden yazsaydık o kopya
-- politikalardan ayrışabilirdi (**K-06**). Sayım yetkisi okuma yetkisinden
-- fazlası değildir.
--
-- Kurum kimliği **açık parametre**: servis katmanının "her sorgu açık
-- `organization_id` süzgeci taşır" kuralı (**K-19**'un ikizi) SQL'de de
-- geçerli, ve kiracı ön süzgecinin indeksleri bu sütuna dayanıyor.
--
-- =========================================================================
-- "Yoklaması alınmamış DERS" değil, "yoklaması alınmamış SINIF"
-- =========================================================================
--
-- Planda satır "yoklaması alınmamış ders" diye konuşulmuştu. Kod okununca
-- düzeltildi: yoklama ekranı (`openAttendanceSession`) oturumu **sınıf başına
-- günde bir kez** açıyor; `subject_id` ve `starts_at` göndermiyor. Yani ürünün
-- mantığında ders yoklaması yok, sınıfın günlük yoklaması var. Ders başına
-- eşleştirme yapsaydık, yoklaması alınmış bir sınıfın her dersi "alınmadı"
-- görünürdü. Sayım ürünün gerçek davranışını izliyor.
--
-- =========================================================================
-- Görünmeyen kurum: satır YOK, sıfır değil
-- =========================================================================
--
-- `payment_overview_counts`'un kuralı burada da geçerli: çağıran kurumu hiç
-- göremiyorsa fonksiyon **hiç satır döndürmez**. Sıfırlar "kurumda hiç öğrenci
-- yok" derdi; oysa doğru cevap "bu kurumu görmüyorsun". Görünürlük
-- `organizations` tablosunun RLS'inden gelir.
--
-- "Bugün" `orbit_today()`'dir, sunucu saati değil (Türkiye saati tek kaynağı).
-- Haftanın günü ISO 8601: Pazartesi=1, Pazar=7 — `schedule_entries.day_of_week`
-- ile aynı sözleşme.

create or replace function public.admin_overview_counts(target_organization_id uuid)
returns table (
  active_students bigint,
  students_without_class bigint,
  students_without_guardian bigint,
  active_classes bigint,
  lessons_today bigint,
  classes_missing_attendance_today bigint
)
language sql
stable
set search_path = ''
as $$
  select
    (
      select count(*)
      from public.students as student
      where student.organization_id = target_organization_id
        and student.archived_at is null
    ) as active_students,
    (
      select count(*)
      from public.students as student
      where student.organization_id = target_organization_id
        and student.archived_at is null
        and not exists (
          select 1
          from public.class_enrollments as enrollment
          join public.classes as klass
            on klass.id = enrollment.class_id
          where enrollment.organization_id = target_organization_id
            and enrollment.student_id = student.id
            and enrollment.archived_at is null
            and klass.archived_at is null
        )
    ) as students_without_class,
    (
      select count(*)
      from public.students as student
      where student.organization_id = target_organization_id
        and student.archived_at is null
        and not exists (
          select 1
          from public.student_guardians as link
          join public.guardians as guardian
            on guardian.id = link.guardian_id
          where link.organization_id = target_organization_id
            and link.student_id = student.id
            and link.archived_at is null
            and guardian.archived_at is null
        )
    ) as students_without_guardian,
    (
      select count(*)
      from public.classes as klass
      where klass.organization_id = target_organization_id
        and klass.archived_at is null
    ) as active_classes,
    (
      select count(*)
      from public.schedule_entries as entry
      join public.classes as klass
        on klass.id = entry.class_id
      where entry.organization_id = target_organization_id
        and entry.archived_at is null
        and klass.archived_at is null
        and entry.day_of_week = extract(isodow from public.orbit_today())::smallint
    ) as lessons_today,
    (
      select count(distinct entry.class_id)
      from public.schedule_entries as entry
      join public.classes as klass
        on klass.id = entry.class_id
      where entry.organization_id = target_organization_id
        and entry.archived_at is null
        and klass.archived_at is null
        and entry.day_of_week = extract(isodow from public.orbit_today())::smallint
        and not exists (
          select 1
          from public.attendance_sessions as session
          where session.organization_id = target_organization_id
            and session.class_id = entry.class_id
            and session.session_date = public.orbit_today()
            and session.archived_at is null
        )
    ) as classes_missing_attendance_today
  where exists (
    select 1
    from public.organizations as organization
    where organization.id = target_organization_id
  );
$$;

comment on function public.admin_overview_counts(uuid) is
  'Yönetici Genel Bakış sayıları: aktif öğrenci, sınıfa kayıtsız öğrenci, velisiz öğrenci, aktif sınıf, bugünkü ders, bugün dersi olup yoklaması alınmamış sınıf. Çağıran kurumu göremiyorsa HİÇ SATIR dönmez — sıfırlar "kurumda hiçbir şey yok" derdi. `security definer` DEĞİLDİR: kapsam RLS''ten gelir. Yoklama sınıf başına günlüktür (`openAttendanceSession`), ders başına değil.';

create or replace function public.today_lessons(target_organization_id uuid)
returns table (
  entry_id uuid,
  starts_at time,
  ends_at time,
  class_id uuid,
  class_name text,
  subject_name text,
  title text,
  room text,
  teacher_name text,
  attendance_taken boolean
)
language sql
stable
set search_path = ''
as $$
  select
    entry.id as entry_id,
    entry.starts_at,
    entry.ends_at,
    entry.class_id,
    klass.name as class_name,
    subject.name as subject_name,
    entry.title,
    entry.room,
    staff.display_name as teacher_name,
    exists (
      select 1
      from public.attendance_sessions as session
      where session.organization_id = target_organization_id
        and session.class_id = entry.class_id
        and session.session_date = public.orbit_today()
        and session.archived_at is null
    ) as attendance_taken
  from public.schedule_entries as entry
  join public.classes as klass
    on klass.id = entry.class_id
  left join public.subjects as subject
    on subject.id = entry.subject_id
  -- Ad `profiles`'tan doğrudan okunmaz: o tablo aynı satırda iletişim ve
  -- şifre kilidi taşıyor (#228) ve ad çözümünün tek yolu `class_staff_names`
  -- (#231, **K-06**). Vekil öğretmen de o fonksiyonun kapsamında.
  left join lateral (
    select names.display_name
    from public.class_staff_names(array[entry.class_id]) as names
    where names.membership_id = entry.membership_id
    limit 1
  ) as staff on true
  where entry.organization_id = target_organization_id
    and entry.archived_at is null
    and klass.archived_at is null
    and entry.day_of_week = extract(isodow from public.orbit_today())::smallint
  order by entry.starts_at, klass.name;
$$;

comment on function public.today_lessons(uuid) is
  'Bugünün ders programı satırları ve her satırın sınıfının bugünkü günlük yoklamasının açılıp açılmadığı. Öğretmen adı `class_staff_names` üzerinden çözülür; çözülemezse ad NULL döner, satır yine döner. `security definer` DEĞİLDİR.';

revoke all on function public.admin_overview_counts(uuid) from public, anon;
grant execute on function public.admin_overview_counts(uuid) to authenticated;
revoke all on function public.today_lessons(uuid) from public, anon;
grant execute on function public.today_lessons(uuid) to authenticated;
