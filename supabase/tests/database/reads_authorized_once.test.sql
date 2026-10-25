-- Okuma kuralları yetkiyi sorgu başına bir kez hesaplar (2026-10-25, ana plan 5.1).
--
--   1. 🔴 Hiçbir izin veren okuma kuralı yetki fonksiyonunu satır değeriyle
--      çağırmaz (`current_user_x(organization_id)` biçimi). Liste katalogdan:
--      yeni bir kural eski kalıpla yazılırsa bu iddia kırmızıya döner.
--   2. Birleştirilen altı tabloda tam bir okuma kuralı var.
--   3–4. Şube: şube yöneticisi yalnız kendi şubesini, kurum geneli üye hepsini görür.
--   5. Denetim kaydı: şube yöneticisi şubesiz ve kendi şubesinin kaydını görür.
--   6. Öğretmen okuttuğu öğrencinin "sınava girmedi" kaydını görür, ötekini görmez.
--   7. Vekil öğretmen kendi vekâlet kaydını görür.
--   8. Veli çocuğunun ödeme planını görür, başkasınınkini görmez.
--   9. Kilitli öğretmen hiçbirini görmez ama kurumunun adını görür.

begin;

create extension if not exists pgtap with schema extensions;
select plan(9);

-- 1 · Katalog kapısı
select is(
  (
    select coalesce(string_agg(tablename || '.' || policyname, ', ' order by tablename, policyname), '')
    from pg_policies
    where schemaname = 'public'
      and permissive = 'PERMISSIVE'
      and cmd in ('SELECT', 'ALL')
      and coalesce(qual, '') ~ 'current_user_[a-z_]+\([a-z]'
  ),
  '',
  'no permissive read policy calls an authorization function with a row value'
);

-- 2 · Tek kural
select is(
  (
    select string_agg(tablename || '=' || adet, ', ' order by tablename)
    from (
      select tablename, count(*) as adet
      from pg_policies
      where schemaname = 'public' and permissive = 'PERMISSIVE' and cmd = 'SELECT'
        and tablename in ('class_teachers', 'exam_absences', 'exam_section_results',
                          'organizations', 'payment_plans', 'substitute_assignments')
      group by tablename
    ) as sayim
  ),
  'class_teachers=1, exam_absences=1, exam_section_results=1, organizations=1, payment_plans=1, substitute_assignments=1',
  'the six tables that had several read policies have exactly one'
);

-- Kurulum ---------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
select ('d51' || lpad(n::text, 5, '0') || '-0000-0000-0000-000000000000')::uuid,
       '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'okuma51-' || n || '@example.test', '', now(), now()
from generate_series(1, 7) as n;
-- 1 kurum geneli yönetici · 2 şube-1 yöneticisi · 3 öğretmen (sınıf A)
-- 4 öğretmen (sınıf yok, vekil) · 5 veli · 6 kilitli öğretmen (sınıf A) · 7 öğrenci
update public.profiles set must_change_password = false, password_expires_at = null
where id::text like 'd51%';
update public.profiles set must_change_password = true
where id = 'd5100006-0000-0000-0000-000000000000';

insert into public.organizations (id, name, slug, code)
values ('e5100000-0000-0000-0000-000000000000', 'Okuma Kurumu', 'okuma-kurumu-51', 9561);
insert into public.branches (id, organization_id, name, is_default) values
  ('e5100001-0000-0000-0000-000000000000', 'e5100000-0000-0000-0000-000000000000', 'Şube 1', true),
  ('e5100002-0000-0000-0000-000000000000', 'e5100000-0000-0000-0000-000000000000', 'Şube 2', false);

insert into public.organization_memberships (id, organization_id, branch_id, user_id, role, status, person_code) values
  ('f5100001-0000-0000-0000-000000000000', 'e5100000-0000-0000-0000-000000000000', null, 'd5100001-0000-0000-0000-000000000000', 'admin', 'active', 1000),
  ('f5100002-0000-0000-0000-000000000000', 'e5100000-0000-0000-0000-000000000000', 'e5100001-0000-0000-0000-000000000000', 'd5100002-0000-0000-0000-000000000000', 'admin', 'active', 1001),
  ('f5100003-0000-0000-0000-000000000000', 'e5100000-0000-0000-0000-000000000000', null, 'd5100003-0000-0000-0000-000000000000', 'teacher', 'active', 1002),
  ('f5100004-0000-0000-0000-000000000000', 'e5100000-0000-0000-0000-000000000000', null, 'd5100004-0000-0000-0000-000000000000', 'teacher', 'active', 1003),
  ('f5100005-0000-0000-0000-000000000000', 'e5100000-0000-0000-0000-000000000000', null, 'd5100005-0000-0000-0000-000000000000', 'parent', 'active', 1004),
  ('f5100006-0000-0000-0000-000000000000', 'e5100000-0000-0000-0000-000000000000', null, 'd5100006-0000-0000-0000-000000000000', 'teacher', 'active', 1005),
  ('f5100007-0000-0000-0000-000000000000', 'e5100000-0000-0000-0000-000000000000', null, 'd5100007-0000-0000-0000-000000000000', 'student', 'active', 1006);

insert into public.subjects (id, organization_id, name)
values ('a5100000-0000-0000-0000-000000000000', 'e5100000-0000-0000-0000-000000000000', 'Fizik');
insert into public.classes (id, organization_id, name) values
  ('c5100001-0000-0000-0000-000000000000', 'e5100000-0000-0000-0000-000000000000', 'A'),
  ('c5100002-0000-0000-0000-000000000000', 'e5100000-0000-0000-0000-000000000000', 'B');
insert into public.class_teachers (organization_id, class_id, membership_id, subject_id) values
  ('e5100000-0000-0000-0000-000000000000', 'c5100001-0000-0000-0000-000000000000', 'f5100003-0000-0000-0000-000000000000', 'a5100000-0000-0000-0000-000000000000'),
  ('e5100000-0000-0000-0000-000000000000', 'c5100001-0000-0000-0000-000000000000', 'f5100006-0000-0000-0000-000000000000', 'a5100000-0000-0000-0000-000000000000');

insert into public.students (id, organization_id, auth_user_id, full_name) values
  ('b5100001-0000-0000-0000-000000000000', 'e5100000-0000-0000-0000-000000000000', 'd5100007-0000-0000-0000-000000000000', 'A Öğrencisi'),
  ('b5100002-0000-0000-0000-000000000000', 'e5100000-0000-0000-0000-000000000000', null, 'B Öğrencisi');
insert into public.class_enrollments (organization_id, class_id, student_id) values
  ('e5100000-0000-0000-0000-000000000000', 'c5100001-0000-0000-0000-000000000000', 'b5100001-0000-0000-0000-000000000000'),
  ('e5100000-0000-0000-0000-000000000000', 'c5100002-0000-0000-0000-000000000000', 'b5100002-0000-0000-0000-000000000000');
insert into public.guardians (id, organization_id, auth_user_id, full_name)
values ('a5200000-0000-0000-0000-000000000000', 'e5100000-0000-0000-0000-000000000000', 'd5100005-0000-0000-0000-000000000000', 'A Velisi');
insert into public.student_guardians (organization_id, student_id, guardian_id)
values ('e5100000-0000-0000-0000-000000000000', 'b5100001-0000-0000-0000-000000000000', 'a5200000-0000-0000-0000-000000000000');

insert into public.exams (id, organization_id, name, exam_date)
values ('e5200000-0000-0000-0000-000000000000', 'e5100000-0000-0000-0000-000000000000', 'Deneme', current_date);
insert into public.exam_absences (organization_id, exam_id, student_id) values
  ('e5100000-0000-0000-0000-000000000000', 'e5200000-0000-0000-0000-000000000000', 'b5100001-0000-0000-0000-000000000000'),
  ('e5100000-0000-0000-0000-000000000000', 'e5200000-0000-0000-0000-000000000000', 'b5100002-0000-0000-0000-000000000000');
insert into public.payment_plans (organization_id, student_id, name, total_amount) values
  ('e5100000-0000-0000-0000-000000000000', 'b5100001-0000-0000-0000-000000000000', 'A planı', 1000),
  ('e5100000-0000-0000-0000-000000000000', 'b5100002-0000-0000-0000-000000000000', 'B planı', 1000);
insert into public.substitute_assignments (organization_id, absent_membership_id, substitute_membership_id, starts_on, ends_on)
values ('e5100000-0000-0000-0000-000000000000', 'f5100003-0000-0000-0000-000000000000', 'f5100004-0000-0000-0000-000000000000', current_date, current_date);
insert into public.audit_events (organization_id, branch_id, action, entity_type) values
  ('e5100000-0000-0000-0000-000000000000', null, 'test.a', 'test'),
  ('e5100000-0000-0000-0000-000000000000', 'e5100001-0000-0000-0000-000000000000', 'test.b', 'test'),
  ('e5100000-0000-0000-0000-000000000000', 'e5100002-0000-0000-0000-000000000000', 'test.c', 'test');

create function pg_temp.olarak(n int) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', 'd51' || lpad(n::text, 5, '0') || '-0000-0000-0000-000000000000', true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
end $$;

-- 3–4 · Şube
select pg_temp.olarak(2);
select is(
  (select array_agg(name order by name) from public.branches
    where organization_id = 'e5100000-0000-0000-0000-000000000000'),
  array['Şube 1'],
  'a branch admin sees only their own branch'
);
reset role;
select pg_temp.olarak(1);
select is(
  (select count(*) from public.branches where organization_id = 'e5100000-0000-0000-0000-000000000000'),
  2::bigint,
  'an organization-wide member sees every branch'
);
reset role;

-- 5 · Denetim kaydı
select pg_temp.olarak(2);
select is(
  (select array_agg(action order by action) from public.audit_events
    where organization_id = 'e5100000-0000-0000-0000-000000000000' and action like 'test.%'),
  array['test.a', 'test.b'],
  'a branch admin reads the branchless audit rows and their own branch, not the other branch'
);
reset role;

-- 6 · Öğretmen ve girmedi
select pg_temp.olarak(3);
select is(
  (select array_agg(student_id) from public.exam_absences),
  array['b5100001-0000-0000-0000-000000000000'::uuid],
  'a teacher sees the absence of the student they teach, not the other one'
);
reset role;

-- 7 · Vekil
select pg_temp.olarak(4);
select is(
  (select count(*) from public.substitute_assignments),
  1::bigint,
  'a substitute teacher sees their own assignment'
);
reset role;

-- 8 · Veli ve ödeme planı
select pg_temp.olarak(5);
select is(
  (select array_agg(name) from public.payment_plans),
  array['A planı'],
  'a guardian sees their child''s payment plan only'
);
reset role;

-- 9 · Kilitli öğretmen
select pg_temp.olarak(6);
select ok(
  (select count(*) from public.exam_absences) = 0
  and (select count(*) from public.class_teachers) = 0
  and (select count(*) from public.exams) = 0
  and (select count(*) from public.organizations) = 1,
  'a locked teacher reads nothing but still sees their organization''s name'
);
reset role;

select * from finish();
rollback;
