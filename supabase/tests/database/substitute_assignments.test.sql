-- Vekil öğretmen (`substitute_assignments` → `current_user_teaches_class`).
--
-- Kadro:
--   A  yönetici
--   M  izinli öğretmen — 12-A'ya atanmış, 12-B'nin rehberi. Bugün 12-A 09:00.
--   V  vekil — hiçbir ataması yok.
--   U  başka bir öğretmen — 12-C'ye atanmış, vekillikle ilgisi yok.
--   P  öğrenci üyeliği (uygunluk sınaması için).
--   W  başka kurumun öğretmeni.
--   S  12-A öğrencisi.
--
-- Sınanan: vekillik penceresinden ÖNCE, SONRA ve iptal edildikten sonra vekil
-- sınıfı görmez; pencere İÇİNDE M'nin iki sınıfını (atama + rehberlik) görür,
-- başka sınıfı görmez; M'nin yetkisi değişmez; yalnız yönetici atar; kurum
-- sınırı ve uygunluk (K-18) veritabanında durur; her değişiklik iz bırakır.

begin;

create extension if not exists pgtap with schema extensions;
select plan(25);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
values
  ('71000000-0000-0000-0000-000000000071', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'vekil-yonetici@example.test', '', now(), now()),
  ('72000000-0000-0000-0000-000000000072', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'vekil-izinli@example.test', '', now(), now()),
  ('73000000-0000-0000-0000-000000000073', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'vekil-vekil@example.test', '', now(), now()),
  ('74000000-0000-0000-0000-000000000074', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'vekil-diger@example.test', '', now(), now()),
  ('75000000-0000-0000-0000-000000000075', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'vekil-ogrenci@example.test', '', now(), now()),
  ('76000000-0000-0000-0000-000000000076', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'vekil-komsu@example.test', '', now(), now());

insert into public.organizations (id, name, slug, code)
values
  ('7a000000-0000-0000-0000-00000000007a', 'Vekil Kurumu', 'vekil-kurumu', 7811),
  ('7b000000-0000-0000-0000-00000000007b', 'Komşu Kurum', 'vekil-komsu', 7812);

insert into public.branches (id, organization_id, name, is_default)
values
  ('7c000000-0000-0000-0000-00000000007c', '7a000000-0000-0000-0000-00000000007a', 'Merkez', true),
  ('7c100000-0000-0000-0000-00000000007c', '7b000000-0000-0000-0000-00000000007b', 'Merkez', true);

insert into public.organization_memberships
  (id, organization_id, branch_id, user_id, role, status, person_code)
values
  ('7d000000-0000-0000-0000-0000000d7000', '7a000000-0000-0000-0000-00000000007a',
   '7c000000-0000-0000-0000-00000000007c', '71000000-0000-0000-0000-000000000071', 'admin', 'active', 7101),
  ('7d100000-0000-0000-0000-0000000d7001', '7a000000-0000-0000-0000-00000000007a',
   '7c000000-0000-0000-0000-00000000007c', '72000000-0000-0000-0000-000000000072', 'teacher', 'active', 7102),
  ('7d200000-0000-0000-0000-0000000d7002', '7a000000-0000-0000-0000-00000000007a',
   '7c000000-0000-0000-0000-00000000007c', '73000000-0000-0000-0000-000000000073', 'teacher', 'active', 7103),
  ('7d300000-0000-0000-0000-0000000d7003', '7a000000-0000-0000-0000-00000000007a',
   '7c000000-0000-0000-0000-00000000007c', '74000000-0000-0000-0000-000000000074', 'teacher', 'active', 7104),
  ('7d400000-0000-0000-0000-0000000d7004', '7a000000-0000-0000-0000-00000000007a',
   '7c000000-0000-0000-0000-00000000007c', '75000000-0000-0000-0000-000000000075', 'student', 'active', 7105),
  ('7d500000-0000-0000-0000-0000000d7005', '7b000000-0000-0000-0000-00000000007b',
   '7c100000-0000-0000-0000-00000000007c', '76000000-0000-0000-0000-000000000076', 'teacher', 'active', 7106);

insert into public.subjects (id, organization_id, name)
values ('7e000000-0000-0000-0000-00000000007e', '7a000000-0000-0000-0000-00000000007a', 'Matematik');

insert into public.classes (id, organization_id, branch_id, name, mentor_membership_id)
values
  ('7f100000-0000-0000-0000-0000000f7001', '7a000000-0000-0000-0000-00000000007a',
   '7c000000-0000-0000-0000-00000000007c', '12-A', null),
  ('7f200000-0000-0000-0000-0000000f7002', '7a000000-0000-0000-0000-00000000007a',
   '7c000000-0000-0000-0000-00000000007c', '12-B', '7d100000-0000-0000-0000-0000000d7001'),
  ('7f300000-0000-0000-0000-0000000f7003', '7a000000-0000-0000-0000-00000000007a',
   '7c000000-0000-0000-0000-00000000007c', '12-C', null);

insert into public.class_teachers (organization_id, class_id, membership_id, subject_id)
values
  ('7a000000-0000-0000-0000-00000000007a', '7f100000-0000-0000-0000-0000000f7001',
   '7d100000-0000-0000-0000-0000000d7001', '7e000000-0000-0000-0000-00000000007e'),
  ('7a000000-0000-0000-0000-00000000007a', '7f300000-0000-0000-0000-0000000f7003',
   '7d300000-0000-0000-0000-0000000d7003', '7e000000-0000-0000-0000-00000000007e');

insert into public.students (id, organization_id, branch_id, full_name)
values ('7f900000-0000-0000-0000-000000000079', '7a000000-0000-0000-0000-00000000007a',
        '7c000000-0000-0000-0000-00000000007c', 'S');

insert into public.class_enrollments (organization_id, class_id, student_id)
values ('7a000000-0000-0000-0000-00000000007a', '7f100000-0000-0000-0000-0000000f7001',
        '7f900000-0000-0000-0000-000000000079');

insert into public.schedule_entries
  (organization_id, class_id, subject_id, membership_id, day_of_week, starts_at, ends_at)
values
  ('7a000000-0000-0000-0000-00000000007a', '7f100000-0000-0000-0000-0000000f7001',
   '7e000000-0000-0000-0000-00000000007e', '7d100000-0000-0000-0000-0000000d7001',
   extract(isodow from public.orbit_today())::smallint, '09:00', '09:40');

-- =========================================================================
-- 1. Veritabanı kuralları (yetkiden bağımsız)
-- =========================================================================

select throws_ok(
  $$ insert into public.substitute_assignments
       (organization_id, absent_membership_id, substitute_membership_id, starts_on, ends_on)
     values ('7a000000-0000-0000-0000-00000000007a', '7d100000-0000-0000-0000-0000000d7001',
             '7d200000-0000-0000-0000-0000000d7002', public.orbit_today(), public.orbit_today() - 1) $$,
  '23514', null,
  'the end date cannot come before the start date'
);

select throws_ok(
  $$ insert into public.substitute_assignments
       (organization_id, absent_membership_id, substitute_membership_id, starts_on, ends_on)
     values ('7a000000-0000-0000-0000-00000000007a', '7d100000-0000-0000-0000-0000000d7001',
             '7d100000-0000-0000-0000-0000000d7001', public.orbit_today(), public.orbit_today()) $$,
  '23514', null,
  'a teacher cannot substitute for themselves'
);

select throws_ok(
  $$ insert into public.substitute_assignments
       (organization_id, absent_membership_id, substitute_membership_id, starts_on, ends_on)
     values ('7a000000-0000-0000-0000-00000000007a', '7d100000-0000-0000-0000-0000000d7001',
             '7d400000-0000-0000-0000-0000000d7004', public.orbit_today(), public.orbit_today()) $$,
  'ORB03', null,
  'a student membership cannot be a substitute (K-18)'
);

select throws_ok(
  $$ insert into public.substitute_assignments
       (organization_id, absent_membership_id, substitute_membership_id, starts_on, ends_on)
     values ('7a000000-0000-0000-0000-00000000007a', '7d100000-0000-0000-0000-0000000d7001',
             '7d500000-0000-0000-0000-0000000d7005', public.orbit_today(), public.orbit_today()) $$,
  '23503', null,
  'a teacher of another organization cannot be a substitute here'
);

-- =========================================================================
-- 2. Pencere dışında vekil hiçbir şey görmez
-- =========================================================================

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '73000000-0000-0000-0000-000000000073', true);

select is(
  public.current_user_teaches_class('7f100000-0000-0000-0000-0000000f7001'),
  false,
  'without an assignment the substitute does not teach the class'
);

reset role;
insert into public.substitute_assignments
  (id, organization_id, absent_membership_id, substitute_membership_id, starts_on, ends_on)
values
  -- Gelecek: yarın başlıyor.
  ('7a100000-0000-0000-0000-0000000a7001', '7a000000-0000-0000-0000-00000000007a',
   '7d100000-0000-0000-0000-0000000d7001', '7d200000-0000-0000-0000-0000000d7002',
   public.orbit_today() + 1, public.orbit_today() + 5),
  -- Geçmiş: dün bitti.
  ('7a200000-0000-0000-0000-0000000a7002', '7a000000-0000-0000-0000-00000000007a',
   '7d100000-0000-0000-0000-0000000d7001', '7d200000-0000-0000-0000-0000000d7002',
   public.orbit_today() - 5, public.orbit_today() - 1);

set local role authenticated;
select set_config('request.jwt.claim.sub', '73000000-0000-0000-0000-000000000073', true);

select is(
  public.current_user_teaches_class('7f100000-0000-0000-0000-0000000f7001'),
  false,
  'a substitution starting tomorrow or ending yesterday grants nothing today'
);

select is(
  (select count(*) from public.classes where id = '7f100000-0000-0000-0000-0000000f7001'),
  0::bigint,
  'outside the window the substitute cannot read the class row'
);

-- =========================================================================
-- 3. Yalnız yönetici atar
-- =========================================================================

select throws_ok(
  $$ insert into public.substitute_assignments
       (organization_id, absent_membership_id, substitute_membership_id, starts_on, ends_on)
     values ('7a000000-0000-0000-0000-00000000007a', '7d100000-0000-0000-0000-0000000d7001',
             '7d200000-0000-0000-0000-0000000d7002', public.orbit_today(), public.orbit_today()) $$,
  '42501', null,
  'a teacher cannot appoint themselves as a substitute'
);

select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000071', true);

select lives_ok(
  $$ insert into public.substitute_assignments
       (organization_id, absent_membership_id, substitute_membership_id, starts_on, ends_on, note)
     values ('7a000000-0000-0000-0000-00000000007a',
             '7d100000-0000-0000-0000-0000000d7001', '7d200000-0000-0000-0000-0000000d7002',
             public.orbit_today() - 1, public.orbit_today() + 1, 'Rapor') $$,
  'the admin appoints a substitute covering today'
);

-- =========================================================================
-- 4. Pencere içinde vekil, izinli öğretmenin sınıflarının öğretmenidir
-- =========================================================================

select set_config('request.jwt.claim.sub', '73000000-0000-0000-0000-000000000073', true);

select is(
  public.current_user_teaches_class('7f100000-0000-0000-0000-0000000f7001'),
  true,
  'during the window the substitute teaches the absent teacher''s assigned class'
);

select is(
  public.current_user_teaches_class('7f200000-0000-0000-0000-0000000f7002'),
  true,
  'during the window the substitute also covers the class the absent teacher mentors'
);

select is(
  public.current_user_teaches_class('7f300000-0000-0000-0000-0000000f7003'),
  false,
  'a class the absent teacher has nothing to do with stays closed'
);

select is(
  (select count(*) from public.classes where id = '7f100000-0000-0000-0000-0000000f7001'),
  1::bigint,
  'the substitute reads the class row through the ordinary RLS policy'
);

select is(
  (select count(*) from public.students where id = '7f900000-0000-0000-0000-000000000079'),
  1::bigint,
  'the substitute reads the class''s student (teaches_student follows)'
);

select results_eq(
  $$ select count(*)::bigint, bool_and(is_substitute)
     from public.my_lessons_today('7a000000-0000-0000-0000-00000000007a') $$,
  $$ values (1::bigint, true) $$,
  'today''s lesson of the absent teacher is the substitute''s lesson, marked as a substitution'
);

select is(
  (select my_lessons_today from public.teacher_overview_counts('7a000000-0000-0000-0000-00000000007a')),
  1::bigint,
  'the substitute''s overview counts the covered lesson'
);

select is(
  (select count(*) from public.substitute_assignments),
  3::bigint,
  'the substitute reads their own assignments (past, future, current)'
);

-- Başka öğretmen başkasının izin kaydını görmez.
select set_config('request.jwt.claim.sub', '74000000-0000-0000-0000-000000000074', true);

select is(
  (select count(*) from public.substitute_assignments),
  0::bigint,
  'an uninvolved teacher sees no substitute assignments'
);

-- İzinli öğretmenin yetkisi değişmedi.
select set_config('request.jwt.claim.sub', '72000000-0000-0000-0000-000000000072', true);

select is(
  public.current_user_teaches_class('7f100000-0000-0000-0000-0000000f7001'),
  true,
  'the absent teacher keeps their class during the substitution'
);

select is(
  (select count(*) from public.substitute_assignments),
  3::bigint,
  'the absent teacher sees who covers for them'
);

-- =========================================================================
-- 5. Süren vekilliğin altından rol çekilemez
-- =========================================================================

reset role;

select throws_ok(
  $$ update public.organization_memberships set role = 'parent'
     where id = '7d200000-0000-0000-0000-0000000d7002' $$,
  'ORB03', null,
  'the role of a membership with a current substitution cannot be changed'
);

-- =========================================================================
-- 6. İptal: yetki anında kapanır, iz kalır
-- =========================================================================

update public.substitute_assignments set archived_at = now()
where note = 'Rapor';

set local role authenticated;
select set_config('request.jwt.claim.sub', '73000000-0000-0000-0000-000000000073', true);

select is(
  public.current_user_teaches_class('7f100000-0000-0000-0000-0000000f7001'),
  false,
  'a cancelled substitution grants nothing'
);

reset role;

select is(
  (
    select array_agg(action order by action)
    from public.audit_events
    where entity_id = (select id from public.substitute_assignments where note = 'Rapor')
  ),
  array['substitute_assignment.archived', 'substitute_assignment.created'],
  'appointing and cancelling a substitute both leave a trace in the audit log'
);

set local role anon;

select throws_ok(
  $$ select count(*) from public.substitute_assignments $$,
  '42501', null,
  'anon cannot read substitute assignments'
);

reset role;

select is(
  (
    select string_agg(column_name, ', ' order by column_name)
    from information_schema.role_column_grants
    where table_schema = 'public'
      and table_name = 'substitute_assignments'
      and grantee = 'authenticated'
      and privilege_type = 'UPDATE'
  ),
  'archived_at, ends_on, note, starts_on',
  'the people and the organization of a substitution cannot be rewritten, only its dates, note and cancellation'
);

select * from finish();
rollback;
