-- Genel Bakış sayıları (`admin_overview_counts`, `today_lessons`).
--
-- Bu fonksiyonlar yöneticiye "şuna bakmalısın" diyen sayıları üretiyor. Yanlış
-- bir sayı burada iki yönde de zarar verir: fazla sayı sahte alarm üretir ve
-- ekrana güveni bitirir, eksik sayı gerçek bir sorunu gizler.
--
-- Senaryo tek kurumda yedi durumu yan yana koyuyor; her biri bir sayımın
-- sınırını sınıyor:
--
--   S1  aktif sınıfa kayıtlı, velisi bağlı         → hiçbir uyarıya girmez
--   S2  yalnız ARŞİVLİ sınıfa kayıtlı, velisiz      → kayıtsız + velisiz
--   S3  ARŞİVLİ öğrenci                              → hiçbir sayıya girmez
--   S4  aktif sınıfa ama kaydı ARŞİVLİ, velisiz      → kayıtsız + velisiz
--
--   12-A  bugün dersi var, bugün yoklaması açık     → eksik yoklamaya girmez
--   12-B  bugün dersi var, yoklaması YOK            → eksik yoklamaya girer
--   12-C  ARŞİVLİ sınıf, bugün programı var          → hiçbir sayıya girmez
--
-- 12-B'nin bir de başka güne ait dersi var: "bugün" süzgeci sınanıyor.
--
-- İkinci bir kurum var ve üç olumsuz sınama onun üzerinde:
-- ⛔ başka kurumun satırı sayılmaz, ⛔ başka kurumun kimliğiyle çağırmak satır
-- döndürmez (sıfır değil), ⛔ öğretmen yönetici kadar görmez.

begin;

create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
values
  ('41000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'genel-yonetici@example.test', '', now(), now()),
  ('42000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'genel-ogretmen@example.test', '', now(), now()),
  ('43000000-0000-0000-0000-000000000043', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'genel-baska@example.test', '', now(), now());

insert into public.organizations (id, name, slug, code)
values
  ('4a000000-0000-0000-0000-00000000004a', 'Genel Bakış Kurumu', 'genel-bakis-kurumu', 7701),
  ('4b000000-0000-0000-0000-00000000004b', 'Başka Kurum', 'genel-bakis-baska', 7702);

insert into public.branches (id, organization_id, name, is_default)
values
  ('4c000000-0000-0000-0000-00000000004c', '4a000000-0000-0000-0000-00000000004a', 'Merkez', true),
  ('4d000000-0000-0000-0000-00000000004d', '4b000000-0000-0000-0000-00000000004b', 'Merkez', true);

insert into public.organization_memberships
  (id, organization_id, branch_id, user_id, role, status, person_code)
values
  ('4e100000-0000-0000-0000-0000000e1001', '4a000000-0000-0000-0000-00000000004a', null,
   '41000000-0000-0000-0000-000000000041', 'admin', 'active', 4101),
  ('4e200000-0000-0000-0000-0000000e2002', '4a000000-0000-0000-0000-00000000004a',
   '4c000000-0000-0000-0000-00000000004c', '42000000-0000-0000-0000-000000000042', 'teacher', 'active', 4102),
  ('4e300000-0000-0000-0000-0000000e3003', '4b000000-0000-0000-0000-00000000004b', null,
   '43000000-0000-0000-0000-000000000043', 'admin', 'active', 4201);

insert into public.subjects (id, organization_id, name)
values ('4f000000-0000-0000-0000-00000000004f', '4a000000-0000-0000-0000-00000000004a', 'Matematik');

insert into public.classes (id, organization_id, branch_id, name)
values
  ('5a100000-0000-0000-0000-0000000a1001', '4a000000-0000-0000-0000-00000000004a',
   '4c000000-0000-0000-0000-00000000004c', '12-A'),
  ('5a200000-0000-0000-0000-0000000a2002', '4a000000-0000-0000-0000-00000000004a',
   '4c000000-0000-0000-0000-00000000004c', '12-B'),
  ('5a300000-0000-0000-0000-0000000a3003', '4a000000-0000-0000-0000-00000000004a',
   '4c000000-0000-0000-0000-00000000004c', '12-C'),
  ('5b100000-0000-0000-0000-0000000b1001', '4b000000-0000-0000-0000-00000000004b',
   '4d000000-0000-0000-0000-00000000004d', 'Başka-A');

-- Öğretmen yalnız 12-A'ya giriyor.
insert into public.class_teachers (organization_id, class_id, membership_id, subject_id)
values
  ('4a000000-0000-0000-0000-00000000004a', '5a100000-0000-0000-0000-0000000a1001',
   '4e200000-0000-0000-0000-0000000e2002', '4f000000-0000-0000-0000-00000000004f');

insert into public.students (id, organization_id, branch_id, full_name)
values
  ('6a100000-0000-0000-0000-0000000c1001', '4a000000-0000-0000-0000-00000000004a',
   '4c000000-0000-0000-0000-00000000004c', 'S1 Kayıtlı Velili'),
  ('6a200000-0000-0000-0000-0000000c2002', '4a000000-0000-0000-0000-00000000004a',
   '4c000000-0000-0000-0000-00000000004c', 'S2 Arşivli Sınıfta'),
  ('6a300000-0000-0000-0000-0000000c3003', '4a000000-0000-0000-0000-00000000004a',
   '4c000000-0000-0000-0000-00000000004c', 'S3 Arşivli Öğrenci'),
  ('6a400000-0000-0000-0000-0000000c4004', '4a000000-0000-0000-0000-00000000004a',
   '4c000000-0000-0000-0000-00000000004c', 'S4 Kaydı Arşivli'),
  ('6b100000-0000-0000-0000-0000000d1001', '4b000000-0000-0000-0000-00000000004b',
   '4d000000-0000-0000-0000-00000000004d', 'Başka Kurumun Öğrencisi');

insert into public.class_enrollments (id, organization_id, class_id, student_id)
values
  ('6e100000-0000-0000-0000-0000000e1001', '4a000000-0000-0000-0000-00000000004a',
   '5a100000-0000-0000-0000-0000000a1001', '6a100000-0000-0000-0000-0000000c1001'),
  ('6e200000-0000-0000-0000-0000000e2002', '4a000000-0000-0000-0000-00000000004a',
   '5a300000-0000-0000-0000-0000000a3003', '6a200000-0000-0000-0000-0000000c2002'),
  ('6e400000-0000-0000-0000-0000000e4004', '4a000000-0000-0000-0000-00000000004a',
   '5a200000-0000-0000-0000-0000000a2002', '6a400000-0000-0000-0000-0000000c4004');

insert into public.guardians (id, organization_id, full_name)
values ('7a100000-0000-0000-0000-0000000a1001', '4a000000-0000-0000-0000-00000000004a', 'S1 Velisi');

insert into public.student_guardians (organization_id, student_id, guardian_id)
values
  ('4a000000-0000-0000-0000-00000000004a', '6a100000-0000-0000-0000-0000000c1001',
   '7a100000-0000-0000-0000-0000000a1001');

-- Bugün ve başka bir gün. Haftanın günü ISO 8601 (Pazartesi=1, Pazar=7).
insert into public.schedule_entries
  (organization_id, class_id, subject_id, membership_id, day_of_week, starts_at, ends_at)
values
  ('4a000000-0000-0000-0000-00000000004a', '5a100000-0000-0000-0000-0000000a1001',
   '4f000000-0000-0000-0000-00000000004f', '4e200000-0000-0000-0000-0000000e2002',
   extract(isodow from public.orbit_today())::smallint, '09:00', '09:40'),
  ('4a000000-0000-0000-0000-00000000004a', '5a200000-0000-0000-0000-0000000a2002',
   '4f000000-0000-0000-0000-00000000004f', null,
   extract(isodow from public.orbit_today())::smallint, '10:00', '10:40'),
  ('4a000000-0000-0000-0000-00000000004a', '5a200000-0000-0000-0000-0000000a2002',
   '4f000000-0000-0000-0000-00000000004f', null,
   (extract(isodow from public.orbit_today())::smallint % 7) + 1, '11:00', '11:40'),
  ('4a000000-0000-0000-0000-00000000004a', '5a300000-0000-0000-0000-0000000a3003',
   '4f000000-0000-0000-0000-00000000004f', null,
   extract(isodow from public.orbit_today())::smallint, '12:00', '12:40');

insert into public.schedule_entries
  (organization_id, class_id, title, day_of_week, starts_at, ends_at)
values
  ('4b000000-0000-0000-0000-00000000004b', '5b100000-0000-0000-0000-0000000b1001', 'Etüt',
   extract(isodow from public.orbit_today())::smallint, '09:00', '09:40');

-- 12-A'nın bugünkü günlük yoklaması açık; 12-B'ninki değil.
insert into public.attendance_sessions (organization_id, class_id, session_date)
values
  ('4a000000-0000-0000-0000-00000000004a', '5a100000-0000-0000-0000-0000000a1001',
   public.orbit_today());

-- Arşivlemeler en sonda: satırlar önce aktifken kuruluyor, sonra kapanıyor.
update public.classes set archived_at = now()
where id = '5a300000-0000-0000-0000-0000000a3003';
update public.students set archived_at = now()
where id = '6a300000-0000-0000-0000-0000000c3003';
update public.class_enrollments set archived_at = now()
where id = '6e400000-0000-0000-0000-0000000e4004';

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Yönetici -----------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000041', true);

select is(
  (select active_students from public.admin_overview_counts('4a000000-0000-0000-0000-00000000004a')),
  3::bigint,
  'active students: archived S3 and the other organization''s student are not counted'
);

select is(
  (select students_without_class from public.admin_overview_counts('4a000000-0000-0000-0000-00000000004a')),
  2::bigint,
  'without class: S2 (only an archived class) and S4 (archived enrollment); S1 is enrolled'
);

select is(
  (select students_without_guardian from public.admin_overview_counts('4a000000-0000-0000-0000-00000000004a')),
  2::bigint,
  'without guardian: S2 and S4; S1 has a linked guardian'
);

select is(
  (select active_classes from public.admin_overview_counts('4a000000-0000-0000-0000-00000000004a')),
  2::bigint,
  'active classes: 12-A and 12-B; archived 12-C is not counted'
);

select is(
  (select lessons_today from public.admin_overview_counts('4a000000-0000-0000-0000-00000000004a')),
  2::bigint,
  'lessons today: another weekday and an archived class are both excluded'
);

select is(
  (select classes_missing_attendance_today from public.admin_overview_counts('4a000000-0000-0000-0000-00000000004a')),
  1::bigint,
  'missing attendance today: 12-B only — 12-A''s daily session is open'
);

select is(
  (select count(*) from public.today_lessons('4a000000-0000-0000-0000-00000000004a')),
  2::bigint,
  'today_lessons returns exactly today''s two lessons of active classes'
);

select results_eq(
  $$ select class_name, attendance_taken
     from public.today_lessons('4a000000-0000-0000-0000-00000000004a')
     order by starts_at $$,
  $$ values ('12-A'::text, true), ('12-B'::text, false) $$,
  'attendance_taken follows the class''s daily session, lesson by lesson'
);

-- ⛔ Başka kurumun kimliğiyle çağırmak: SIFIR değil, HİÇ SATIR.
select is(
  (select count(*) from public.admin_overview_counts('4b000000-0000-0000-0000-00000000004b')),
  0::bigint,
  'calling with an organization the caller cannot see returns no row at all, not zeros'
);

select is(
  (select count(*) from public.today_lessons('4b000000-0000-0000-0000-00000000004b')),
  0::bigint,
  'today_lessons of another organization returns nothing'
);

-- Öğretmen -----------------------------------------------------------------------------
-- ⛔ Fonksiyon definer değil: öğretmen yöneticinin gördüğünü görmez.

select set_config('request.jwt.claim.sub', '42000000-0000-0000-0000-000000000042', true);

select ok(
  (select active_students from public.admin_overview_counts('4a000000-0000-0000-0000-00000000004a')) < 3,
  'a teacher counts fewer active students than the admin — RLS applies, the function is not definer'
);

-- Anon ---------------------------------------------------------------------------------

reset role;
set local role anon;

select throws_ok(
  $$ select * from public.admin_overview_counts('4a000000-0000-0000-0000-00000000004a') $$,
  '42501',
  null,
  'anon cannot call admin_overview_counts'
);

select * from finish();
rollback;
