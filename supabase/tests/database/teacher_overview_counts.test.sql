-- Öğretmen Genel Bakış (`teacher_overview_counts`, `my_lessons_today`).
--
-- "Benim" üç ayrı şey demek ve her biri ayrı sınanıyor:
--
--   Sınıflarım     T, 12-A ve 12-B'ye atanmış. 12-C'ye atanmamış.
--   Öğrencilerim   S1, S2 (12-A) · S2, S3 (12-B) → 3 tekil. S4 arşivli (12-A),
--                  S5 başka sınıfta (12-C) → sayılmaz.
--   Derslerim      Bugün: T 12-A 09:00 · U 12-A 10:00 (T'nin DEĞİL) ·
--                  T 12-B 11:00 · T 12-C 12:00 (VEKİL) · T 12-A başka gün.
--                  → 2 ders. Vekil dersi bugün GELMİYOR: vekil sınıfın
--                  kaydını göremiyor (`classes_select_teacher`). Bu, göçte
--                  ölçülüp yazılmış bilinen bir boşluk; test onu sabitliyor
--                  ki yetki açıldığında bilinçli olarak güncellensin.
--   Yoklama        12-A bugün açık. 12-B açık değil → 1 eksik.
--                  12-C de açık değil ama T vekil ve o sınıfı göremiyor: eksik
--                  yoklamaya SAYILMAZ (yanlış bir "alınmadı" üretilmez).
--   Ödev           T'nin dün biten, işaretlenmemiş ödevi → 1.
--                  Sayılmayanlar: işaretlemesi bitirilmiş · bugün teslim ·
--                  U'nun ödevi · arşivli ödev.
--
-- ⛔ Başka kurumun kimliğiyle çağırmak satır döndürmez. ⛔ anon çağıramaz.

begin;

create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
values
  ('51000000-0000-0000-0000-000000000051', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ogretmen-t@example.test', '', now(), now()),
  ('52000000-0000-0000-0000-000000000052', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ogretmen-u@example.test', '', now(), now());

insert into public.organizations (id, name, slug, code)
values
  ('5a000000-0000-0000-0000-00000000005a', 'Öğretmen Kurumu', 'ogretmen-genel-bakis', 7711),
  ('5b000000-0000-0000-0000-00000000005b', 'Başka Kurum', 'ogretmen-genel-baska', 7712);

insert into public.branches (id, organization_id, name, is_default)
values ('5c000000-0000-0000-0000-00000000005c', '5a000000-0000-0000-0000-00000000005a', 'Merkez', true);

insert into public.organization_memberships
  (id, organization_id, branch_id, user_id, role, status, person_code)
values
  ('5d100000-0000-0000-0000-0000000d1001', '5a000000-0000-0000-0000-00000000005a',
   '5c000000-0000-0000-0000-00000000005c', '51000000-0000-0000-0000-000000000051', 'teacher', 'active', 5101),
  ('5d200000-0000-0000-0000-0000000d2002', '5a000000-0000-0000-0000-00000000005a',
   '5c000000-0000-0000-0000-00000000005c', '52000000-0000-0000-0000-000000000052', 'teacher', 'active', 5102);

insert into public.subjects (id, organization_id, name)
values ('5e000000-0000-0000-0000-00000000005e', '5a000000-0000-0000-0000-00000000005a', 'Matematik');

insert into public.classes (id, organization_id, branch_id, name)
values
  ('5f100000-0000-0000-0000-0000000f1001', '5a000000-0000-0000-0000-00000000005a',
   '5c000000-0000-0000-0000-00000000005c', '12-A'),
  ('5f200000-0000-0000-0000-0000000f2002', '5a000000-0000-0000-0000-00000000005a',
   '5c000000-0000-0000-0000-00000000005c', '12-B'),
  ('5f300000-0000-0000-0000-0000000f3003', '5a000000-0000-0000-0000-00000000005a',
   '5c000000-0000-0000-0000-00000000005c', '12-C');

insert into public.class_teachers (organization_id, class_id, membership_id, subject_id)
values
  ('5a000000-0000-0000-0000-00000000005a', '5f100000-0000-0000-0000-0000000f1001',
   '5d100000-0000-0000-0000-0000000d1001', '5e000000-0000-0000-0000-00000000005e'),
  ('5a000000-0000-0000-0000-00000000005a', '5f200000-0000-0000-0000-0000000f2002',
   '5d100000-0000-0000-0000-0000000d1001', '5e000000-0000-0000-0000-00000000005e'),
  ('5a000000-0000-0000-0000-00000000005a', '5f100000-0000-0000-0000-0000000f1001',
   '5d200000-0000-0000-0000-0000000d2002', '5e000000-0000-0000-0000-00000000005e');

insert into public.students (id, organization_id, branch_id, full_name)
values
  ('6f100000-0000-0000-0000-000000000001', '5a000000-0000-0000-0000-00000000005a',
   '5c000000-0000-0000-0000-00000000005c', 'S1'),
  ('6f200000-0000-0000-0000-000000000002', '5a000000-0000-0000-0000-00000000005a',
   '5c000000-0000-0000-0000-00000000005c', 'S2'),
  ('6f300000-0000-0000-0000-000000000003', '5a000000-0000-0000-0000-00000000005a',
   '5c000000-0000-0000-0000-00000000005c', 'S3'),
  ('6f400000-0000-0000-0000-000000000004', '5a000000-0000-0000-0000-00000000005a',
   '5c000000-0000-0000-0000-00000000005c', 'S4 Arşivli'),
  ('6f500000-0000-0000-0000-000000000005', '5a000000-0000-0000-0000-00000000005a',
   '5c000000-0000-0000-0000-00000000005c', 'S5 Başka Sınıf');

insert into public.class_enrollments (organization_id, class_id, student_id)
values
  ('5a000000-0000-0000-0000-00000000005a', '5f100000-0000-0000-0000-0000000f1001', '6f100000-0000-0000-0000-000000000001'),
  ('5a000000-0000-0000-0000-00000000005a', '5f100000-0000-0000-0000-0000000f1001', '6f200000-0000-0000-0000-000000000002'),
  ('5a000000-0000-0000-0000-00000000005a', '5f200000-0000-0000-0000-0000000f2002', '6f200000-0000-0000-0000-000000000002'),
  ('5a000000-0000-0000-0000-00000000005a', '5f200000-0000-0000-0000-0000000f2002', '6f300000-0000-0000-0000-000000000003'),
  ('5a000000-0000-0000-0000-00000000005a', '5f100000-0000-0000-0000-0000000f1001', '6f400000-0000-0000-0000-000000000004'),
  ('5a000000-0000-0000-0000-00000000005a', '5f300000-0000-0000-0000-0000000f3003', '6f500000-0000-0000-0000-000000000005');

insert into public.schedule_entries
  (organization_id, class_id, subject_id, membership_id, day_of_week, starts_at, ends_at)
values
  ('5a000000-0000-0000-0000-00000000005a', '5f100000-0000-0000-0000-0000000f1001',
   '5e000000-0000-0000-0000-00000000005e', '5d100000-0000-0000-0000-0000000d1001',
   extract(isodow from public.orbit_today())::smallint, '09:00', '09:40'),
  ('5a000000-0000-0000-0000-00000000005a', '5f100000-0000-0000-0000-0000000f1001',
   '5e000000-0000-0000-0000-00000000005e', '5d200000-0000-0000-0000-0000000d2002',
   extract(isodow from public.orbit_today())::smallint, '10:00', '10:40'),
  ('5a000000-0000-0000-0000-00000000005a', '5f200000-0000-0000-0000-0000000f2002',
   '5e000000-0000-0000-0000-00000000005e', '5d100000-0000-0000-0000-0000000d1001',
   extract(isodow from public.orbit_today())::smallint, '11:00', '11:40'),
  ('5a000000-0000-0000-0000-00000000005a', '5f300000-0000-0000-0000-0000000f3003',
   '5e000000-0000-0000-0000-00000000005e', '5d100000-0000-0000-0000-0000000d1001',
   extract(isodow from public.orbit_today())::smallint, '12:00', '12:40'),
  ('5a000000-0000-0000-0000-00000000005a', '5f100000-0000-0000-0000-0000000f1001',
   '5e000000-0000-0000-0000-00000000005e', '5d100000-0000-0000-0000-0000000d1001',
   (extract(isodow from public.orbit_today())::smallint % 7) + 1, '09:00', '09:40');

insert into public.attendance_sessions (organization_id, class_id, session_date)
values ('5a000000-0000-0000-0000-00000000005a', '5f100000-0000-0000-0000-0000000f1001', public.orbit_today());

insert into public.homework_assignments
  (organization_id, class_id, title, assigned_by_membership_id, assigned_on, due_date,
   submissions_recorded_at, archived_at)
values
  -- Sayılır: T'nin, dün bitti, işaretlenmedi.
  ('5a000000-0000-0000-0000-00000000005a', '5f100000-0000-0000-0000-0000000f1001', 'Bekleyen',
   '5d100000-0000-0000-0000-0000000d1001', public.orbit_today() - 5, public.orbit_today() - 1, null, null),
  -- Sayılmaz: işaretlemesi bitirildi.
  ('5a000000-0000-0000-0000-00000000005a', '5f100000-0000-0000-0000-0000000f1001', 'Bitti',
   '5d100000-0000-0000-0000-0000000d1001', public.orbit_today() - 5, public.orbit_today() - 1, now(), null),
  -- Sayılmaz: teslim bugün.
  ('5a000000-0000-0000-0000-00000000005a', '5f200000-0000-0000-0000-0000000f2002', 'Bugün',
   '5d100000-0000-0000-0000-0000000d1001', public.orbit_today() - 5, public.orbit_today(), null, null),
  -- Sayılmaz: U'nun ödevi.
  ('5a000000-0000-0000-0000-00000000005a', '5f100000-0000-0000-0000-0000000f1001', 'Başkasının',
   '5d200000-0000-0000-0000-0000000d2002', public.orbit_today() - 5, public.orbit_today() - 1, null, null),
  -- Sayılmaz: arşivli.
  ('5a000000-0000-0000-0000-00000000005a', '5f100000-0000-0000-0000-0000000f1001', 'Arşivli',
   '5d100000-0000-0000-0000-0000000d1001', public.orbit_today() - 5, public.orbit_today() - 1, null, now());

update public.students set archived_at = now()
where id = '6f400000-0000-0000-0000-000000000004';

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000051', true);

select is(
  (select my_classes from public.teacher_overview_counts('5a000000-0000-0000-0000-00000000005a')),
  2::bigint,
  'my classes: 12-A and 12-B; substitute-only 12-C is not mine'
);

select is(
  (select my_students from public.teacher_overview_counts('5a000000-0000-0000-0000-00000000005a')),
  3::bigint,
  'my students: S1, S2, S3 counted once each; archived S4 and 12-C''s S5 are not'
);

select is(
  (select my_lessons_today from public.teacher_overview_counts('5a000000-0000-0000-0000-00000000005a')),
  2::bigint,
  'my lessons today: own 12-A and 12-B; U''s lesson, another day and the (invisible) substitute class are not'
);

select is(
  (select classes_missing_attendance_today from public.teacher_overview_counts('5a000000-0000-0000-0000-00000000005a')),
  1::bigint,
  'missing attendance: 12-B only — 12-A is open and substitute 12-C cannot be seen, so it is not claimed'
);

select is(
  (select homework_awaiting_marking from public.teacher_overview_counts('5a000000-0000-0000-0000-00000000005a')),
  1::bigint,
  'awaiting marking: own, past due, not recorded; recorded, due today, colleague''s and archived are excluded'
);

select is(
  (select count(*) from public.my_lessons_today('5a000000-0000-0000-0000-00000000005a')),
  2::bigint,
  'my_lessons_today returns only my lessons in classes I can see'
);

select results_eq(
  $$ select class_name, attendance_taken
     from public.my_lessons_today('5a000000-0000-0000-0000-00000000005a')
     order by starts_at $$,
  $$ values ('12-A'::text, true), ('12-B'::text, false) $$,
  'attendance per lesson: taken and not taken; the substitute class is never claimed as missing'
);

-- ⛔ Başka kurum.
select is(
  (select count(*) from public.teacher_overview_counts('5b000000-0000-0000-0000-00000000005b')),
  0::bigint,
  'another organization''s id returns no row at all, not zeros'
);

select is(
  (select count(*) from public.my_lessons_today('5b000000-0000-0000-0000-00000000005b')),
  0::bigint,
  'my_lessons_today of another organization returns nothing'
);

-- Diğer öğretmen: aynı sınıf, farklı gün.
select set_config('request.jwt.claim.sub', '52000000-0000-0000-0000-000000000052', true);

select results_eq(
  $$ select my_classes, my_lessons_today, homework_awaiting_marking
     from public.teacher_overview_counts('5a000000-0000-0000-0000-00000000005a') $$,
  $$ values (1::bigint, 1::bigint, 1::bigint) $$,
  'a colleague in the same class gets their own day, not T''s'
);

select is(
  (select start_time from (
     select starts_at::text as start_time
     from public.my_lessons_today('5a000000-0000-0000-0000-00000000005a')
   ) as lesson),
  '10:00:00',
  'the colleague sees only their 10:00 lesson'
);

reset role;
set local role anon;

select throws_ok(
  $$ select * from public.teacher_overview_counts('5a000000-0000-0000-0000-00000000005a') $$,
  '42501',
  null,
  'anon cannot call teacher_overview_counts'
);

select * from finish();
rollback;
