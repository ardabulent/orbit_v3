-- Yoklama ders ders (`lesson_attendance_taken`, `20261006000000`).
--
-- 12-A'nın bugün üç dersi var: Matematik 09:00, Fizik 10:00, Etüt 11:00
-- (dersi olmayan, başlıklı satır). Her adım bir oturum ekleyip hangi dersin
-- "alındı" sayıldığını sınıyor:
--
--   · boş oturum (kimse işaretlenmemiş) hiçbir dersi kapsamaz
--   · ders oturumu yalnız aynı ders + aynı saati kapsar
--   · etüt oturumu (ders boş, saat dolu) günlük oturum SAYILMAZ
--   · arşivli ve dünkü oturum bugünü kapsamaz
--   · günlük oturum (ders ve saat boş) günün bütün derslerini kapsar
--
-- ⛔ anon çağıramaz.

begin;

create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
values
  ('81000000-0000-0000-0000-000000000081', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ders-yoklama-yonetici@example.test', '', now(), now());

insert into public.organizations (id, name, slug, code)
values ('8a000000-0000-0000-0000-00000000008a', 'Ders Yoklama Kurumu', 'ders-yoklama', 7911);

insert into public.branches (id, organization_id, name, is_default)
values ('8c000000-0000-0000-0000-00000000008c', '8a000000-0000-0000-0000-00000000008a', 'Merkez', true);

insert into public.organization_memberships
  (id, organization_id, branch_id, user_id, role, status, person_code)
values
  ('8d000000-0000-0000-0000-0000000d8000', '8a000000-0000-0000-0000-00000000008a',
   '8c000000-0000-0000-0000-00000000008c', '81000000-0000-0000-0000-000000000081', 'admin', 'active', 8101);

insert into public.subjects (id, organization_id, name)
values
  ('8e100000-0000-0000-0000-00000000008e', '8a000000-0000-0000-0000-00000000008a', 'Matematik'),
  ('8e200000-0000-0000-0000-00000000008e', '8a000000-0000-0000-0000-00000000008a', 'Fizik');

insert into public.classes (id, organization_id, branch_id, name)
values ('8f100000-0000-0000-0000-0000000f8001', '8a000000-0000-0000-0000-00000000008a',
        '8c000000-0000-0000-0000-00000000008c', '12-A');

insert into public.students (id, organization_id, branch_id, full_name)
values ('8f900000-0000-0000-0000-000000000089', '8a000000-0000-0000-0000-00000000008a',
        '8c000000-0000-0000-0000-00000000008c', 'S1');

insert into public.class_enrollments (organization_id, class_id, student_id)
values ('8a000000-0000-0000-0000-00000000008a', '8f100000-0000-0000-0000-0000000f8001',
        '8f900000-0000-0000-0000-000000000089');

insert into public.schedule_entries
  (id, organization_id, class_id, subject_id, title, day_of_week, starts_at, ends_at)
values
  ('8b100000-0000-0000-0000-0000000b8001', '8a000000-0000-0000-0000-00000000008a',
   '8f100000-0000-0000-0000-0000000f8001', '8e100000-0000-0000-0000-00000000008e', null,
   extract(isodow from public.orbit_today())::smallint, '09:00', '09:40'),
  ('8b200000-0000-0000-0000-0000000b8002', '8a000000-0000-0000-0000-00000000008a',
   '8f100000-0000-0000-0000-0000000f8001', '8e200000-0000-0000-0000-00000000008e', null,
   extract(isodow from public.orbit_today())::smallint, '10:00', '10:40'),
  ('8b300000-0000-0000-0000-0000000b8003', '8a000000-0000-0000-0000-00000000008a',
   '8f100000-0000-0000-0000-0000000f8001', null, 'Etüt',
   extract(isodow from public.orbit_today())::smallint, '11:00', '11:40');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '81000000-0000-0000-0000-000000000081', true);

select is(
  (select lessons_missing_attendance_today from public.admin_overview_counts('8a000000-0000-0000-0000-00000000008a')),
  3::bigint,
  'with no session, all three of today''s lessons miss attendance'
);

-- 1. Boş oturum
reset role;
insert into public.attendance_sessions (id, organization_id, class_id, subject_id, session_date, starts_at)
values ('8a100000-0000-0000-0000-0000000a8001', '8a000000-0000-0000-0000-00000000008a',
        '8f100000-0000-0000-0000-0000000f8001', '8e100000-0000-0000-0000-00000000008e',
        public.orbit_today(), '09:00');
set local role authenticated;

select is(
  public.lesson_attendance_taken('8b100000-0000-0000-0000-0000000b8001', public.orbit_today()),
  false,
  'an opened session with nobody marked does not count as taken'
);

-- 2. Aynı oturuma bir kayıt
reset role;
insert into public.attendance_records (organization_id, session_id, student_id, status)
values ('8a000000-0000-0000-0000-00000000008a', '8a100000-0000-0000-0000-0000000a8001',
        '8f900000-0000-0000-0000-000000000089', 'present');
set local role authenticated;

select results_eq(
  $$ select coalesce(subject_name, title), attendance_taken
     from public.today_lessons('8a000000-0000-0000-0000-00000000008a')
     order by starts_at $$,
  $$ values ('Matematik'::text, true), ('Fizik'::text, false), ('Etüt'::text, false) $$,
  'a lesson session covers only its own lesson'
);

select is(
  (select lessons_missing_attendance_today from public.admin_overview_counts('8a000000-0000-0000-0000-00000000008a')),
  2::bigint,
  'the admin count drops by exactly one lesson'
);

-- 3. Fizik oturumu yanlış saatte
reset role;
insert into public.attendance_sessions (id, organization_id, class_id, subject_id, session_date, starts_at)
values ('8a200000-0000-0000-0000-0000000a8002', '8a000000-0000-0000-0000-00000000008a',
        '8f100000-0000-0000-0000-0000000f8001', '8e200000-0000-0000-0000-00000000008e',
        public.orbit_today(), '10:30');
insert into public.attendance_records (organization_id, session_id, student_id, status)
values ('8a000000-0000-0000-0000-00000000008a', '8a200000-0000-0000-0000-0000000a8002',
        '8f900000-0000-0000-0000-000000000089', 'present');
set local role authenticated;

select is(
  public.lesson_attendance_taken('8b200000-0000-0000-0000-0000000b8002', public.orbit_today()),
  false,
  'a session of the same subject at another time is another lesson'
);

-- 4. Etüt oturumu: ders boş ama saat dolu → günlük oturum DEĞİL
reset role;
insert into public.attendance_sessions (id, organization_id, class_id, subject_id, session_date, starts_at)
values ('8a300000-0000-0000-0000-0000000a8003', '8a000000-0000-0000-0000-00000000008a',
        '8f100000-0000-0000-0000-0000000f8001', null, public.orbit_today(), '11:00');
insert into public.attendance_records (organization_id, session_id, student_id, status)
values ('8a000000-0000-0000-0000-00000000008a', '8a300000-0000-0000-0000-0000000a8003',
        '8f900000-0000-0000-0000-000000000089', 'late');
set local role authenticated;

select is(
  public.lesson_attendance_taken('8b300000-0000-0000-0000-0000000b8003', public.orbit_today()),
  true,
  'a lesson without a subject is matched by its time'
);

select is(
  public.lesson_attendance_taken('8b200000-0000-0000-0000-0000000b8002', public.orbit_today()),
  false,
  'a timed session without a subject is not a daily session and covers nothing else'
);

-- 5. Arşivli ve dünkü Fizik 10:00
reset role;
insert into public.attendance_sessions (id, organization_id, class_id, subject_id, session_date, starts_at, archived_at)
values
  ('8a400000-0000-0000-0000-0000000a8004', '8a000000-0000-0000-0000-00000000008a',
   '8f100000-0000-0000-0000-0000000f8001', '8e200000-0000-0000-0000-00000000008e',
   public.orbit_today(), '10:00', now()),
  ('8a500000-0000-0000-0000-0000000a8005', '8a000000-0000-0000-0000-00000000008a',
   '8f100000-0000-0000-0000-0000000f8001', '8e200000-0000-0000-0000-00000000008e',
   public.orbit_today() - 1, '10:00', null);
insert into public.attendance_records (organization_id, session_id, student_id, status)
values
  ('8a000000-0000-0000-0000-00000000008a', '8a400000-0000-0000-0000-0000000a8004',
   '8f900000-0000-0000-0000-000000000089', 'present'),
  ('8a000000-0000-0000-0000-00000000008a', '8a500000-0000-0000-0000-0000000a8005',
   '8f900000-0000-0000-0000-000000000089', 'present');
set local role authenticated;

select is(
  public.lesson_attendance_taken('8b200000-0000-0000-0000-0000000b8002', public.orbit_today()),
  false,
  'an archived session and yesterday''s session do not cover today'
);

select is(
  public.lesson_attendance_taken('8b200000-0000-0000-0000-0000000b8002', public.orbit_today() - 1),
  true,
  'yesterday''s session does cover yesterday'
);

-- 6. Günlük oturum (eski düzen): bütün günü kapsar
reset role;
insert into public.attendance_sessions (id, organization_id, class_id, session_date)
values ('8a600000-0000-0000-0000-0000000a8006', '8a000000-0000-0000-0000-00000000008a',
        '8f100000-0000-0000-0000-0000000f8001', public.orbit_today());
set local role authenticated;

select is(
  public.lesson_attendance_taken('8b200000-0000-0000-0000-0000000b8002', public.orbit_today()),
  false,
  'an empty daily session still covers nothing'
);

reset role;
insert into public.attendance_records (organization_id, session_id, student_id, status)
values ('8a000000-0000-0000-0000-00000000008a', '8a600000-0000-0000-0000-0000000a8006',
        '8f900000-0000-0000-0000-000000000089', 'present');
set local role authenticated;

select is(
  public.lesson_attendance_taken('8b200000-0000-0000-0000-0000000b8002', public.orbit_today()),
  true,
  'a daily session with a record covers every lesson of that class''s day'
);

select is(
  (select lessons_missing_attendance_today from public.admin_overview_counts('8a000000-0000-0000-0000-00000000008a')),
  0::bigint,
  'with the day covered, no lesson misses attendance'
);

reset role;
set local role anon;

select throws_ok(
  $$ select public.lesson_attendance_taken('8b100000-0000-0000-0000-0000000b8001', current_date) $$,
  '42501', null,
  'anon cannot call lesson_attendance_taken'
);

select * from finish();
rollback;
