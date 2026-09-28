-- Yoklama ders ders alınır.
--
-- =========================================================================
-- Neden gerekti
-- =========================================================================
--
-- Karar (2026-09-28, Arda Bülent): yoklama **her ders için ayrı** alınır; o
-- dersin öğretmeni kendi dersinde alır. Öğrencinin üçüncü dersten ayrılması
-- ancak böyle görünür.
--
-- Veri modeli buna baştan hazırdı (`20260904220000`): oturum `subject_id` ve
-- `starts_at` taşıyor ve iki benzersiz dizin "aynı sınıf, aynı ders, aynı
-- gün, aynı saat" oturumunu tek tutuyor. Değişmesi gereken, **"bu dersin
-- yoklaması alındı mı" sorusunun cevabı**: bugüne kadar sınıfın o gün
-- herhangi bir oturumu varsa bütün dersleri "alındı" sayılıyordu
-- (`today_lessons`, `admin_overview_counts`, `teacher_overview_counts`).
--
-- =========================================================================
-- "Alındı" ne demek — tek yerde
-- =========================================================================
--
-- Bir dersin (program satırının) o gün yoklaması alınmıştır, eğer o gün,
-- arşivlenmemiş ve **en az bir öğrencisi işaretlenmiş** bir oturum varsa ve
-- bu oturum:
--
--   (a) o dersin oturumudur — aynı sınıf, aynı ders (`subject_id`, dersi
--       olmayan etüt/rehberlik için ikisi de boş) ve aynı başlangıç saati; ya da
--   (b) sınıfın **günlük** oturumudur (ders ve saat boş) — eski düzende
--       açılmış yoklama o günün bütün derslerini kapsamaya devam eder.
--       Üretimde ölçüldü (2026-09-28): 1 günlük oturum, 0 kayıt.
--
-- **"En az bir kayıt" yeni bir şart.** Oturum, öğretmen "Yoklama al"a
-- bastığı anda açılıyor; hiç işaretlemeden çıkarsa oturum boş kalır ve eski
-- tanım o sınıfı "alındı" gösterirdi (K-03: ölçülmemiş şey ölçüm gibi
-- gösterilmez).
--
-- Fonksiyon `security definer` DEĞİL: vekil ya da öğretmen göremediği
-- oturumu "alınmadı" diye görür; `my_lessons_today` o satırda zaten NULL
-- döndürüyor (`20261002000000`).

create or replace function public.lesson_attendance_taken(
  target_entry_id uuid,
  target_date date
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.schedule_entries as entry
    join public.attendance_sessions as session
      on session.class_id = entry.class_id
     and session.organization_id = entry.organization_id
    where entry.id = target_entry_id
      and session.session_date = target_date
      and session.archived_at is null
      and (
        (
          session.starts_at = entry.starts_at
          and session.subject_id is not distinct from entry.subject_id
        )
        or (session.subject_id is null and session.starts_at is null)
      )
      and exists (
        select 1
        from public.attendance_records as record
        where record.session_id = session.id
      )
  );
$$;

comment on function public.lesson_attendance_taken(uuid, date) is
  'Program satırının (dersin) o günkü yoklaması alındı mı: aynı sınıf+ders+saat oturumu ya da sınıfın günlük oturumu var VE en az bir öğrenci işaretlenmiş. RLS altında çalışır (`security definer` DEĞİLDİR).';

revoke all on function public.lesson_attendance_taken(uuid, date) from public, anon;
grant execute on function public.lesson_attendance_taken(uuid, date) to authenticated;

-- ---------------------------------------------------------------------------
-- today_lessons: satır başına kendi yoklaması
-- ---------------------------------------------------------------------------

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
    public.lesson_attendance_taken(entry.id, public.orbit_today()) as attendance_taken
  from public.schedule_entries as entry
  join public.classes as klass
    on klass.id = entry.class_id
  left join public.subjects as subject
    on subject.id = entry.subject_id
  -- Ad `profiles`'tan doğrudan okunmaz (#228); tek yol `class_staff_names`.
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
  'Bugünün ders programı satırları ve her dersin kendi yoklamasının alınıp alınmadığı (`lesson_attendance_taken`). Öğretmen adı `class_staff_names` üzerinden çözülür; çözülemezse ad NULL döner, satır yine döner. `security definer` DEĞİLDİR.';

-- ---------------------------------------------------------------------------
-- Sayılar: "yoklaması alınmamış sınıf" → "yoklaması alınmamış ders"
-- ---------------------------------------------------------------------------
--
-- Sütun adı anlamıyla birlikte değişiyor; eski adı yeni anlamla bırakmak
-- okuyanı yanıltırdı. Dönüş tipi değiştiği için iki fonksiyon düşürülüp
-- yeniden kuruluyor; istemci aynı PR'da güncellendi.

drop function public.admin_overview_counts(uuid);

create function public.admin_overview_counts(target_organization_id uuid)
returns table (
  active_students bigint,
  students_without_class bigint,
  students_without_guardian bigint,
  active_classes bigint,
  lessons_today bigint,
  lessons_missing_attendance_today bigint
)
language sql
stable
set search_path = ''
as $$
  with today_entries as (
    select entry.id
    from public.schedule_entries as entry
    join public.classes as klass
      on klass.id = entry.class_id
    where entry.organization_id = target_organization_id
      and entry.archived_at is null
      and klass.archived_at is null
      and entry.day_of_week = extract(isodow from public.orbit_today())::smallint
  )
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
    (select count(*) from today_entries) as lessons_today,
    (
      select count(*)
      from today_entries
      where not public.lesson_attendance_taken(today_entries.id, public.orbit_today())
    ) as lessons_missing_attendance_today
  where exists (
    select 1
    from public.organizations as organization
    where organization.id = target_organization_id
  );
$$;

comment on function public.admin_overview_counts(uuid) is
  'Yönetici Genel Bakış sayıları: aktif öğrenci, sınıfa kayıtsız öğrenci, velisiz öğrenci, aktif sınıf, bugünkü ders, bugün yoklaması alınmamış ders (ders başına, `lesson_attendance_taken`). Çağıran kurumu göremiyorsa HİÇ SATIR dönmez. `security definer` DEĞİLDİR: kapsam RLS''ten gelir.';

revoke all on function public.admin_overview_counts(uuid) from public, anon;
grant execute on function public.admin_overview_counts(uuid) to authenticated;

drop function public.teacher_overview_counts(uuid);

create function public.teacher_overview_counts(target_organization_id uuid)
returns table (
  my_classes bigint,
  my_students bigint,
  my_lessons_today bigint,
  lessons_missing_attendance_today bigint,
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
  covering as (
    select cover.absent_membership_id as id
    from public.substitute_assignments as cover
    where cover.organization_id = target_organization_id
      and cover.archived_at is null
      and cover.substitute_membership_id in (select me.id from me)
      and public.orbit_today() between cover.starts_on and cover.ends_on
  ),
  my_classes as (
    select klass.id
    from public.classes as klass
    where klass.organization_id = target_organization_id
      and klass.archived_at is null
      and public.current_user_teaches_class(klass.id)
  ),
  my_entries_today as (
    select entry.id, entry.class_id
    from public.schedule_entries as entry
    join public.classes as klass
      on klass.id = entry.class_id
    where entry.organization_id = target_organization_id
      and entry.archived_at is null
      and klass.archived_at is null
      and (
        entry.membership_id in (select me.id from me)
        or entry.membership_id in (select covering.id from covering)
      )
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
      select count(*)
      from my_entries_today as entry
      -- Göremediğim sınıfın yoklaması sayılmaz (programa yazılı ama atamasız).
      where entry.class_id in (select my_classes.id from my_classes)
        and not public.lesson_attendance_taken(entry.id, public.orbit_today())
    ) as lessons_missing_attendance_today,
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
  'Öğretmen Genel Bakış sayıları: sınıflarım (vekillik dahil), öğrencilerim, bugünkü derslerim (benim ve bugün vekili olduğum öğretmenin satırları), bugün yoklaması alınmamış dersim (yalnız görebildiğim sınıflar, ders başına), teslim tarihi geçmiş ve işaretlemesi bitirilmemiş ödevim. Kurum görünmüyorsa HİÇ SATIR dönmez. `security definer` DEĞİLDİR.';

revoke all on function public.teacher_overview_counts(uuid) from public, anon;
grant execute on function public.teacher_overview_counts(uuid) to authenticated;
