-- Öğretmenin Genel Bakış'ı, öğretmenin kendi gününü sayar.
--
-- =========================================================================
-- Neden gerekti
-- =========================================================================
--
-- Öğretmen Genel Bakış ekranı yöneticininkiyle aynı sorunu taşıyordu
-- (ROADMAP §4.23 B3, `v1.5-22`): kartlar ve "Takip önerileri" demo
-- modülünden geliyordu, gerçek modda boştu. "Bugünün dersleri" haftanın
-- gününe bakmadan bütün programı listeliyor ve her satırın altına
-- "Yoklama ders başlangıcında açılacak" yazıyordu — böyle bir otomatik
-- açılma yok (**K-03**).
--
-- Yönetici tarafı `20261001000000`'da bağlandı. Bu göç öğretmen tarafı.
--
-- =========================================================================
-- Neden `admin_overview_counts` yeniden kullanılmadı
-- =========================================================================
--
-- O fonksiyon invoker ve öğretmen çağırınca RLS onu zaten daraltıyor; sayılar
-- yanlış olmazdı. Ama **soru yanlış olurdu**: "velisiz öğrenci" öğretmenin
-- çözebileceği bir şey değil, "kontrol bekleyen ödevim" ise yöneticinin
-- sorusu değil. Aynı fonksiyonu iki rolün sorusuna uydurmak, bir sonraki
-- değişikliğin birini bozması demek.
--
-- =========================================================================
-- "Benim" ne demek — üç ayrı tanım, bilerek
-- =========================================================================
--
-- * **Sınıflarım / öğrencilerim:** okuttuğum veya rehberi olduğum sınıflar
--   (`current_user_teaches_class`) — RLS'in öğretmene açtığı kümenin aynısı.
-- * **Bugünkü derslerim:** programda **öğretmen olarak benim yazılı olduğum**
--   satırlar (`schedule_entries.membership_id`). Karar 2026-09-27 (Arda
--   Bülent): öğretmen yalnız kendi derslerini görür; sınıfının başka
--   öğretmenlere ait dersleri listede yok.
-- * **Kontrol bekleyen ödevim:** benim verdiğim (`assigned_by_membership_id`),
--   teslim tarihi **dün veya daha önce** geçmiş ve "işaretlemeyi bitirdim"
--   (`submissions_recorded_at`) denmemiş ödev. Bugün teslim edilen ödev henüz
--   bekleyen değil: öğrenci akşama kadar getirebilir.
--
-- =========================================================================
-- Vekil öğretmen: yoklama durumu BİLİNMİYOR, "alınmadı" değil
-- =========================================================================
--
-- Program satırı bir öğretmeni, o sınıfa atanmamış olsa da derse
-- yazabiliyor (vekil — `20260908010000`). Ama yoklama oturumlarını görme
-- yetkisi yalnız sınıfa atanmış öğretmende
-- (`attendance_sessions_select_teacher`). Vekil çağırdığında oturum RLS'e
-- takılır ve `today_lessons` "yoklama alınmadı" der — **bu bir ölçüm değil,
-- görememe**. O satırda durum `NULL` döner ve eksik yoklama sayısına girmez
-- (**K-03**: sistemin bilmediği bir şey bir sayı olarak gösterilemez).
--
-- 🔴 **Ölçüldü (2026-09-27): bugün vekil dersi bu ekrana HİÇ gelmiyor.**
-- Vekil, program satırını görüyor ama sınıfın kendisini görmüyor —
-- `classes_select_teacher` yalnız `current_user_teaches_class`'a bakıyor.
-- Arşiv süzgeci sınıfa katılmayı gerektirdiği için satır düşüyor. Aynı boşluk
-- Ders Programı ekranında da var (sınıf adı boş). Sınıf okuma yetkisini
-- vekile açmak bir yetki kararı ve bu dilimin kapsamı dışında; yukarıdaki
-- `NULL` koruması o karar verildiğinde yanlış bir "alınmadı" çizilmesin diye
-- şimdiden yerinde. Test bugünkü davranışı açıkça sabitliyor.
--
-- İkisi de `security definer` DEĞİL; kurum açık parametre; kurum görünmüyorsa
-- HİÇ SATIR dönmez — `20261001000000` ile aynı sözleşme.

create or replace function public.teacher_overview_counts(target_organization_id uuid)
returns table (
  my_classes bigint,
  my_students bigint,
  my_lessons_today bigint,
  classes_missing_attendance_today bigint,
  homework_awaiting_marking bigint
)
language sql
stable
set search_path = ''
as $$
  with me as (
    select membership.id
    from public.organization_memberships as membership
    where membership.organization_id = target_organization_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
  ),
  my_classes as (
    select klass.id
    from public.classes as klass
    where klass.organization_id = target_organization_id
      and klass.archived_at is null
      and public.current_user_teaches_class(klass.id)
  ),
  my_entries_today as (
    select entry.class_id
    from public.schedule_entries as entry
    join public.classes as klass
      on klass.id = entry.class_id
    where entry.organization_id = target_organization_id
      and entry.archived_at is null
      and klass.archived_at is null
      and entry.membership_id in (select me.id from me)
      and entry.day_of_week = extract(isodow from public.orbit_today())::smallint
  )
  select
    (select count(*) from my_classes) as my_classes,
    (
      select count(distinct enrollment.student_id)
      from public.class_enrollments as enrollment
      join public.students as student
        on student.id = enrollment.student_id
      where enrollment.organization_id = target_organization_id
        and enrollment.archived_at is null
        and student.archived_at is null
        and enrollment.class_id in (select my_classes.id from my_classes)
    ) as my_students,
    (select count(*) from my_entries_today) as my_lessons_today,
    (
      select count(distinct entry.class_id)
      from my_entries_today as entry
      -- Vekil olduğum sınıfın yoklamasını göremiyorum; o sınıf sayılmaz.
      where entry.class_id in (select my_classes.id from my_classes)
        and not exists (
          select 1
          from public.attendance_sessions as session
          where session.organization_id = target_organization_id
            and session.class_id = entry.class_id
            and session.session_date = public.orbit_today()
            and session.archived_at is null
        )
    ) as classes_missing_attendance_today,
    (
      select count(*)
      from public.homework_assignments as homework
      join public.classes as klass
        on klass.id = homework.class_id
      where homework.organization_id = target_organization_id
        and homework.archived_at is null
        and klass.archived_at is null
        and homework.assigned_by_membership_id in (select me.id from me)
        and homework.due_date < public.orbit_today()
        and homework.submissions_recorded_at is null
    ) as homework_awaiting_marking
  where exists (
    select 1
    from public.organizations as organization
    where organization.id = target_organization_id
  );
$$;

comment on function public.teacher_overview_counts(uuid) is
  'Öğretmen Genel Bakış sayıları: sınıflarım, öğrencilerim, bugünkü derslerim (programda benim yazılı olduğum), bugün dersim olup yoklaması alınmamış sınıf (yalnız okuttuğum sınıflar — vekil olduğum sınıfın yoklamasını göremiyorum), teslim tarihi geçmiş ve işaretlemesi bitirilmemiş ödevim. Kurum görünmüyorsa HİÇ SATIR dönmez. `security definer` DEĞİLDİR.';

-- Satır mantığı `today_lessons`'tan gelir (**K-06**): ad çözümü, arşiv
-- süzgeci ve "bugün" tanımı iki yerde yazılmaz. Bu fonksiyon yalnız iki şey
-- ekler: "benim dersim" süzgeci ve vekil satırında bilinmeyen yoklama.
create or replace function public.my_lessons_today(target_organization_id uuid)
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
    lesson.entry_id,
    lesson.starts_at,
    lesson.ends_at,
    lesson.class_id,
    lesson.class_name,
    lesson.subject_name,
    lesson.title,
    lesson.room,
    lesson.teacher_name,
    case
      when public.current_user_teaches_class(lesson.class_id)
        then lesson.attendance_taken
    end as attendance_taken
  from public.today_lessons(target_organization_id) as lesson
  join public.schedule_entries as entry
    on entry.id = lesson.entry_id
  join public.organization_memberships as membership
    on membership.id = entry.membership_id
  where membership.user_id = (select auth.uid())
    and membership.status = 'active'
  order by lesson.starts_at, lesson.class_name;
$$;

comment on function public.my_lessons_today(uuid) is
  'Çağıranın programda öğretmen olarak yazılı olduğu bugünkü dersler. Satırlar `today_lessons`''tan gelir. `attendance_taken` vekil olunan sınıfta NULL: çağıran o sınıfın yoklamasını göremez, "alınmadı" demek bir ölçüm olmazdı. `security definer` DEĞİLDİR.';

revoke all on function public.teacher_overview_counts(uuid) from public, anon;
grant execute on function public.teacher_overview_counts(uuid) to authenticated;
revoke all on function public.my_lessons_today(uuid) from public, anon;
grant execute on function public.my_lessons_today(uuid) to authenticated;
