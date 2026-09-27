-- Öğrenci Genel Bakış (`student_overview_counts`, `student_upcoming_homework`,
-- `student_lessons_today`).
--
-- Senaryo (T = bugün):
--
--   S1  12-A'da ve ARŞİVLİ 12-B'de. Hesabı var; velisi P.
--   S2  12-A'da ve 12-C'de. Hesabı var. S1'in sınıf arkadaşı — ama S1'in
--       sayılarını GÖRMEMELİ.
--
--   Ders (bugün)   12-A 09:00 · 12-A 10:00 · 12-B 11:00 (arşivli sınıf) ·
--                  12-C 12:00 (S1'in değil) · 12-A başka gün
--                  → S1: 2 ders
--   Ödev (12-A)    T · T+1 · T+6 → pencerede (3); T+7 ve T-1 → dışında.
--                  12-C T (S1'in değil) · 12-B T (arşivli sınıf)
--                  → bu hafta 3, bugün/yarın 2
--   Getirilmedi    Geçmiş iki ödev işaretlendi; S1 birini getirdi → 1
--   Devam          dün gelmedi, önceki gün geç kaldı, bir gün geldi → 1 / 1
--   Sınav          son sınav 72/100
--
-- ⛔ Sınıf arkadaşı S1'in kimliğiyle çağırınca HİÇ SATIR. Veli aynı sayıları
-- görür. anon çağıramaz.

begin;

create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
values
  ('61000000-0000-0000-0000-000000000061', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'genel-ogrenci-1@example.test', '', now(), now()),
  ('62000000-0000-0000-0000-000000000062', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'genel-ogrenci-2@example.test', '', now(), now()),
  ('63000000-0000-0000-0000-000000000063', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'genel-veli@example.test', '', now(), now()),
  ('64000000-0000-0000-0000-000000000064', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'genel-ogretmen-3@example.test', '', now(), now());

insert into public.organizations (id, name, slug, code)
values ('6a000000-0000-0000-0000-00000000006a', 'Öğrenci Kurumu', 'ogrenci-genel-bakis', 7721);

insert into public.branches (id, organization_id, name, is_default)
values ('6b000000-0000-0000-0000-00000000006b', '6a000000-0000-0000-0000-00000000006a', 'Merkez', true);

insert into public.organization_memberships
  (id, organization_id, branch_id, user_id, role, status, person_code)
values
  ('6c100000-0000-0000-0000-0000000c1001', '6a000000-0000-0000-0000-00000000006a',
   '6b000000-0000-0000-0000-00000000006b', '61000000-0000-0000-0000-000000000061', 'student', 'active', 6101),
  ('6c200000-0000-0000-0000-0000000c2002', '6a000000-0000-0000-0000-00000000006a',
   '6b000000-0000-0000-0000-00000000006b', '62000000-0000-0000-0000-000000000062', 'student', 'active', 6102),
  ('6c300000-0000-0000-0000-0000000c3003', '6a000000-0000-0000-0000-00000000006a',
   '6b000000-0000-0000-0000-00000000006b', '63000000-0000-0000-0000-000000000063', 'parent', 'active', 6103),
  ('6c400000-0000-0000-0000-0000000c4004', '6a000000-0000-0000-0000-00000000006a',
   '6b000000-0000-0000-0000-00000000006b', '64000000-0000-0000-0000-000000000064', 'teacher', 'active', 6104);

insert into public.subjects (id, organization_id, name)
values ('6d000000-0000-0000-0000-00000000006d', '6a000000-0000-0000-0000-00000000006a', 'Matematik');

insert into public.classes (id, organization_id, branch_id, name)
values
  ('6e100000-0000-0000-0000-0000000e1001', '6a000000-0000-0000-0000-00000000006a',
   '6b000000-0000-0000-0000-00000000006b', '12-A'),
  ('6e200000-0000-0000-0000-0000000e2002', '6a000000-0000-0000-0000-00000000006a',
   '6b000000-0000-0000-0000-00000000006b', '12-B'),
  ('6e300000-0000-0000-0000-0000000e3003', '6a000000-0000-0000-0000-00000000006a',
   '6b000000-0000-0000-0000-00000000006b', '12-C');

insert into public.class_teachers (organization_id, class_id, membership_id, subject_id)
values
  ('6a000000-0000-0000-0000-00000000006a', '6e100000-0000-0000-0000-0000000e1001',
   '6c400000-0000-0000-0000-0000000c4004', '6d000000-0000-0000-0000-00000000006d');

insert into public.students (id, organization_id, branch_id, auth_user_id, full_name)
values
  ('7f100000-0000-0000-0000-000000000001', '6a000000-0000-0000-0000-00000000006a',
   '6b000000-0000-0000-0000-00000000006b', '61000000-0000-0000-0000-000000000061', 'S1'),
  ('7f200000-0000-0000-0000-000000000002', '6a000000-0000-0000-0000-00000000006a',
   '6b000000-0000-0000-0000-00000000006b', '62000000-0000-0000-0000-000000000062', 'S2');

insert into public.guardians (id, organization_id, auth_user_id, full_name)
values ('7a100000-0000-0000-0000-000000000001', '6a000000-0000-0000-0000-00000000006a',
        '63000000-0000-0000-0000-000000000063', 'P');

insert into public.student_guardians (organization_id, student_id, guardian_id)
values ('6a000000-0000-0000-0000-00000000006a', '7f100000-0000-0000-0000-000000000001',
        '7a100000-0000-0000-0000-000000000001');

-- Kayıtlar bir ay önce açılmış: `student_homework_ratios` kayıttan önce
-- verilmiş ödevi saymıyor ve geçmiş ödevler bu tarihten sonra verildi.
insert into public.class_enrollments (organization_id, class_id, student_id, created_at)
values
  ('6a000000-0000-0000-0000-00000000006a', '6e100000-0000-0000-0000-0000000e1001', '7f100000-0000-0000-0000-000000000001', now() - interval '30 days'),
  ('6a000000-0000-0000-0000-00000000006a', '6e200000-0000-0000-0000-0000000e2002', '7f100000-0000-0000-0000-000000000001', now() - interval '30 days'),
  ('6a000000-0000-0000-0000-00000000006a', '6e100000-0000-0000-0000-0000000e1001', '7f200000-0000-0000-0000-000000000002', now() - interval '30 days'),
  ('6a000000-0000-0000-0000-00000000006a', '6e300000-0000-0000-0000-0000000e3003', '7f200000-0000-0000-0000-000000000002', now() - interval '30 days');

insert into public.schedule_entries
  (organization_id, class_id, subject_id, day_of_week, starts_at, ends_at)
values
  ('6a000000-0000-0000-0000-00000000006a', '6e100000-0000-0000-0000-0000000e1001', '6d000000-0000-0000-0000-00000000006d',
   extract(isodow from public.orbit_today())::smallint, '09:00', '09:40'),
  ('6a000000-0000-0000-0000-00000000006a', '6e100000-0000-0000-0000-0000000e1001', '6d000000-0000-0000-0000-00000000006d',
   extract(isodow from public.orbit_today())::smallint, '10:00', '10:40'),
  ('6a000000-0000-0000-0000-00000000006a', '6e200000-0000-0000-0000-0000000e2002', '6d000000-0000-0000-0000-00000000006d',
   extract(isodow from public.orbit_today())::smallint, '11:00', '11:40'),
  ('6a000000-0000-0000-0000-00000000006a', '6e300000-0000-0000-0000-0000000e3003', '6d000000-0000-0000-0000-00000000006d',
   extract(isodow from public.orbit_today())::smallint, '12:00', '12:40'),
  ('6a000000-0000-0000-0000-00000000006a', '6e100000-0000-0000-0000-0000000e1001', '6d000000-0000-0000-0000-00000000006d',
   (extract(isodow from public.orbit_today())::smallint % 7) + 1, '09:00', '09:40');

insert into public.homework_assignments
  (id, organization_id, class_id, subject_id, title, assigned_on, due_date, submissions_recorded_at)
values
  -- Pencerede (12-A).
  ('7b100000-0000-0000-0000-000000000001', '6a000000-0000-0000-0000-00000000006a', '6e100000-0000-0000-0000-0000000e1001',
   '6d000000-0000-0000-0000-00000000006d', 'Bugün', public.orbit_today(), public.orbit_today(), null),
  ('7b200000-0000-0000-0000-000000000002', '6a000000-0000-0000-0000-00000000006a', '6e100000-0000-0000-0000-0000000e1001',
   '6d000000-0000-0000-0000-00000000006d', 'Yarın', public.orbit_today(), public.orbit_today() + 1, null),
  ('7b300000-0000-0000-0000-000000000003', '6a000000-0000-0000-0000-00000000006a', '6e100000-0000-0000-0000-0000000e1001',
   '6d000000-0000-0000-0000-00000000006d', 'Altı gün', public.orbit_today(), public.orbit_today() + 6, null),
  -- Pencere dışında.
  ('7b400000-0000-0000-0000-000000000004', '6a000000-0000-0000-0000-00000000006a', '6e100000-0000-0000-0000-0000000e1001',
   '6d000000-0000-0000-0000-00000000006d', 'Yedi gün', public.orbit_today(), public.orbit_today() + 7, null),
  -- S1'in değil / arşivli sınıf.
  ('7b500000-0000-0000-0000-000000000005', '6a000000-0000-0000-0000-00000000006a', '6e300000-0000-0000-0000-0000000e3003',
   '6d000000-0000-0000-0000-00000000006d', '12-C', public.orbit_today(), public.orbit_today(), null),
  ('7b600000-0000-0000-0000-000000000006', '6a000000-0000-0000-0000-00000000006a', '6e200000-0000-0000-0000-0000000e2002',
   '6d000000-0000-0000-0000-00000000006d', '12-B', public.orbit_today(), public.orbit_today(), null),
  -- Geçmiş, işaretlemesi bitirilmiş iki ödev.
  ('7b700000-0000-0000-0000-000000000007', '6a000000-0000-0000-0000-00000000006a', '6e100000-0000-0000-0000-0000000e1001',
   '6d000000-0000-0000-0000-00000000006d', 'Getirilen', public.orbit_today() - 10, public.orbit_today() - 3, now()),
  ('7b800000-0000-0000-0000-000000000008', '6a000000-0000-0000-0000-00000000006a', '6e100000-0000-0000-0000-0000000e1001',
   '6d000000-0000-0000-0000-00000000006d', 'Getirilmeyen', public.orbit_today() - 10, public.orbit_today() - 1, now());

-- İşaretleyeni tetikleyici çağıranın üyeliğinden yazar; öğretmen olarak ekle.
select set_config('request.jwt.claim.sub', '64000000-0000-0000-0000-000000000064', true);
insert into public.homework_submissions (organization_id, homework_id, student_id)
values ('6a000000-0000-0000-0000-00000000006a', '7b700000-0000-0000-0000-000000000007',
        '7f100000-0000-0000-0000-000000000001');
select set_config('request.jwt.claim.sub', '', true);

insert into public.attendance_sessions (id, organization_id, class_id, session_date)
values
  ('7c100000-0000-0000-0000-000000000001', '6a000000-0000-0000-0000-00000000006a', '6e100000-0000-0000-0000-0000000e1001', public.orbit_today() - 1),
  ('7c200000-0000-0000-0000-000000000002', '6a000000-0000-0000-0000-00000000006a', '6e100000-0000-0000-0000-0000000e1001', public.orbit_today() - 2),
  ('7c300000-0000-0000-0000-000000000003', '6a000000-0000-0000-0000-00000000006a', '6e100000-0000-0000-0000-0000000e1001', public.orbit_today() - 3);

insert into public.attendance_records (organization_id, session_id, student_id, status)
values
  ('6a000000-0000-0000-0000-00000000006a', '7c100000-0000-0000-0000-000000000001', '7f100000-0000-0000-0000-000000000001', 'absent'),
  ('6a000000-0000-0000-0000-00000000006a', '7c200000-0000-0000-0000-000000000002', '7f100000-0000-0000-0000-000000000001', 'late'),
  ('6a000000-0000-0000-0000-00000000006a', '7c300000-0000-0000-0000-000000000003', '7f100000-0000-0000-0000-000000000001', 'present');

insert into public.exams (id, organization_id, class_id, name, exam_date, max_score)
values ('7d100000-0000-0000-0000-000000000001', '6a000000-0000-0000-0000-00000000006a',
        '6e100000-0000-0000-0000-0000000e1001', 'TYT Deneme 3', public.orbit_today() - 5, 100);

insert into public.exam_results (organization_id, exam_id, student_id, score)
values ('6a000000-0000-0000-0000-00000000006a', '7d100000-0000-0000-0000-000000000001',
        '7f100000-0000-0000-0000-000000000001', 72);

update public.classes set archived_at = now()
where id = '6e200000-0000-0000-0000-0000000e2002';

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Öğrencinin kendisi -------------------------------------------------------------------

select set_config('request.jwt.claim.sub', '61000000-0000-0000-0000-000000000061', true);

select is(
  (select lessons_today from public.student_overview_counts('7f100000-0000-0000-0000-000000000001')),
  2::bigint,
  'lessons today: two 12-A lessons; archived 12-B, a classmate''s 12-C and another day are not'
);

select results_eq(
  $$ select homework_due_this_week, homework_due_soon
     from public.student_overview_counts('7f100000-0000-0000-0000-000000000001') $$,
  $$ values (3::bigint, 2::bigint) $$,
  'homework window: T, T+1, T+6 in the week, T and T+1 soon; T+7, T-1, other and archived classes excluded'
);

select is(
  (select homework_missed from public.student_overview_counts('7f100000-0000-0000-0000-000000000001')),
  1::bigint,
  'missed: two recorded past homeworks, one brought'
);

select results_eq(
  $$ select absent_count, late_count
     from public.student_overview_counts('7f100000-0000-0000-0000-000000000001') $$,
  $$ values (1::bigint, 1::bigint) $$,
  'attendance comes from student_attendance_counts: one absent, one late'
);

select results_eq(
  $$ select latest_exam_name, latest_exam_score, latest_exam_max_score
     from public.student_overview_counts('7f100000-0000-0000-0000-000000000001') $$,
  $$ values ('TYT Deneme 3'::text, 72::numeric, 100::numeric) $$,
  'latest exam comes from student_latest_exam_scores'
);

select results_eq(
  $$ select title from public.student_upcoming_homework('7f100000-0000-0000-0000-000000000001') $$,
  $$ values ('Bugün'::text), ('Yarın'::text), ('Altı gün'::text) $$,
  'upcoming homework: the same 7-day window, ordered by due date'
);

select is(
  (select count(*) from public.student_lessons_today('7f100000-0000-0000-0000-000000000001')),
  2::bigint,
  'student_lessons_today: only the student''s active classes'
);

-- ⛔ Sınıf arkadaşı ----------------------------------------------------------------------

select set_config('request.jwt.claim.sub', '62000000-0000-0000-0000-000000000062', true);

select is(
  (select count(*) from public.student_overview_counts('7f100000-0000-0000-0000-000000000001')),
  0::bigint,
  'a classmate asking for S1 gets no row at all'
);

select is(
  (select count(*) from public.student_upcoming_homework('7f100000-0000-0000-0000-000000000001')),
  0::bigint,
  'a classmate asking for S1''s homework gets nothing, even though they share 12-A'
);

select is(
  (select lessons_today from public.student_overview_counts('7f200000-0000-0000-0000-000000000002')),
  3::bigint,
  'the classmate''s own day: two 12-A lessons and 12-C'
);

-- Veli -----------------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', '63000000-0000-0000-0000-000000000063', true);

select results_eq(
  $$ select lessons_today, homework_due_this_week, homework_missed, absent_count
     from public.student_overview_counts('7f100000-0000-0000-0000-000000000001') $$,
  $$ values (2::bigint, 3::bigint, 1::bigint, 1::bigint) $$,
  'the guardian sees the same numbers for their child'
);

reset role;
set local role anon;

select throws_ok(
  $$ select * from public.student_overview_counts('7f100000-0000-0000-0000-000000000001') $$,
  '42501',
  null,
  'anon cannot call student_overview_counts'
);

select * from finish();
rollback;
