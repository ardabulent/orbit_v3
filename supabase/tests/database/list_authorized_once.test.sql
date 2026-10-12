-- Liste okumaları sorgu başına bir kez yetkilendirilir (2026-10-12, göç
-- 20261027000000, ROADMAP v1.5-24).
--
-- Göç on iki tablonun rol başına okuma kurallarını tek bir kurala indirdi.
-- Eşdeğerlik tohumlu kurumda 200 kullanıcıyla ölçüldü; bu dosya en ince
-- dalları kalıcı olarak kilitler:
--
--   1–3   Şubeye bağlı yönetici yalnız kendi şubesinin ve şubesiz öğrencileri
--         görür; ⛔ başka şubenin öğrencisini görmez. Kurum yöneticisi hepsini.
--   4–6   Öğretmen okuttuğu öğrenciyi, onun velisini ve teslimini görür;
--         ⛔ okutmadığı öğrenciyi görmez.
--   7–8   Bugün süren vekillikteki öğretmen, yerine geçtiği sınıfın öğrencisini
--         ve yoklamasını görür.
--   9–10  Veli çocuğunun taksitini görür; ⛔ öğretmen taksiti görmez.
--   11    Öğrenci yalnız kendi kaydını görür.
--   12    On iki tablonun her birinde tek bir okuma kuralı var ve o kural
--         şifre değiştirme kilidini taşıyor.
--   13    Yeni dizi fonksiyonlarını ⛔ anon çağıramaz.

begin;

create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
select ('e1' || n || '00000-0000-0000-0000-0000000e1' || n || '00')::uuid,
       '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'lo-' || n || '@example.test', '', now(), now()
from generate_series(1, 7) as n;
-- 1 kurum yöneticisi · 2 şube yöneticisi · 3 öğretmen · 4 vekil
-- 5 öğrenci · 6 veli · 7 başka öğretmen

insert into public.organizations (id, name, slug, code)
values ('e2100000-0000-0000-0000-0000000e2100', 'Liste Dershanesi', 'liste-dershanesi', 8931);

insert into public.branches (id, organization_id, name)
values ('e2200000-0000-0000-0000-0000000e2200', 'e2100000-0000-0000-0000-0000000e2100', 'Merkez'),
       ('e2300000-0000-0000-0000-0000000e2300', 'e2100000-0000-0000-0000-0000000e2100', 'Kuzey');

insert into public.organization_memberships (id, organization_id, branch_id, user_id, role, status)
values
  ('e3100000-0000-0000-0000-0000000e3100', 'e2100000-0000-0000-0000-0000000e2100', null,
   'e1100000-0000-0000-0000-0000000e1100', 'admin', 'active'),
  ('e3200000-0000-0000-0000-0000000e3200', 'e2100000-0000-0000-0000-0000000e2100', 'e2200000-0000-0000-0000-0000000e2200',
   'e1200000-0000-0000-0000-0000000e1200', 'admin', 'active'),
  ('e3300000-0000-0000-0000-0000000e3300', 'e2100000-0000-0000-0000-0000000e2100', null,
   'e1300000-0000-0000-0000-0000000e1300', 'teacher', 'active'),
  ('e3400000-0000-0000-0000-0000000e3400', 'e2100000-0000-0000-0000-0000000e2100', null,
   'e1400000-0000-0000-0000-0000000e1400', 'teacher', 'active'),
  ('e3500000-0000-0000-0000-0000000e3500', 'e2100000-0000-0000-0000-0000000e2100', null,
   'e1500000-0000-0000-0000-0000000e1500', 'student', 'active'),
  ('e3600000-0000-0000-0000-0000000e3600', 'e2100000-0000-0000-0000-0000000e2100', null,
   'e1600000-0000-0000-0000-0000000e1600', 'parent', 'active'),
  ('e3700000-0000-0000-0000-0000000e3700', 'e2100000-0000-0000-0000-0000000e2100', null,
   'e1700000-0000-0000-0000-0000000e1700', 'teacher', 'active');

insert into public.subjects (id, organization_id, name)
values ('e4100000-0000-0000-0000-0000000e4100', 'e2100000-0000-0000-0000-0000000e2100', 'Matematik');

insert into public.classes (id, organization_id, name)
values ('e5100000-0000-0000-0000-0000000e5100', 'e2100000-0000-0000-0000-0000000e2100', 'L-1');

insert into public.class_teachers (organization_id, class_id, membership_id, subject_id)
values ('e2100000-0000-0000-0000-0000000e2100', 'e5100000-0000-0000-0000-0000000e5100',
        'e3300000-0000-0000-0000-0000000e3300', 'e4100000-0000-0000-0000-0000000e4100');

-- Öğretmen 3 izinde, 4 bugün onun yerine geçiyor.
insert into public.substitute_assignments
  (organization_id, absent_membership_id, substitute_membership_id, starts_on, ends_on)
values ('e2100000-0000-0000-0000-0000000e2100', 'e3300000-0000-0000-0000-0000000e3300',
        'e3400000-0000-0000-0000-0000000e3400', public.orbit_today(), public.orbit_today());

insert into public.students (id, organization_id, branch_id, full_name, auth_user_id)
values
  ('e6100000-0000-0000-0000-0000000e6100', 'e2100000-0000-0000-0000-0000000e2100',
   'e2200000-0000-0000-0000-0000000e2200', 'Merkezli Öğrenci', 'e1500000-0000-0000-0000-0000000e1500'),
  ('e6200000-0000-0000-0000-0000000e6200', 'e2100000-0000-0000-0000-0000000e2100',
   'e2300000-0000-0000-0000-0000000e2300', 'Kuzeyli Öğrenci', null),
  ('e6300000-0000-0000-0000-0000000e6300', 'e2100000-0000-0000-0000-0000000e2100',
   null, 'Şubesiz Öğrenci', null);

insert into public.class_enrollments (organization_id, class_id, student_id)
values ('e2100000-0000-0000-0000-0000000e2100', 'e5100000-0000-0000-0000-0000000e5100',
        'e6100000-0000-0000-0000-0000000e6100');

insert into public.guardians (id, organization_id, full_name, auth_user_id)
values ('e7100000-0000-0000-0000-0000000e7100', 'e2100000-0000-0000-0000-0000000e2100',
        'Merkezli Veli', 'e1600000-0000-0000-0000-0000000e1600');
insert into public.student_guardians (organization_id, student_id, guardian_id)
values ('e2100000-0000-0000-0000-0000000e2100', 'e6100000-0000-0000-0000-0000000e6100',
        'e7100000-0000-0000-0000-0000000e7100');

insert into public.homework_assignments (id, organization_id, class_id, title, due_date)
values ('e8100000-0000-0000-0000-0000000e8100', 'e2100000-0000-0000-0000-0000000e2100',
        'e5100000-0000-0000-0000-0000000e5100', 'Türev', public.orbit_today() + 7);
-- Kaydeden üye tetikleyiciyle oturumdaki kimlikten yazılıyor.
do $$ begin perform set_config('request.jwt.claim.sub', 'e1300000-0000-0000-0000-0000000e1300', true); end $$;
insert into public.homework_submissions (organization_id, homework_id, student_id, recorded_by_membership_id)
values ('e2100000-0000-0000-0000-0000000e2100', 'e8100000-0000-0000-0000-0000000e8100',
        'e6100000-0000-0000-0000-0000000e6100', 'e3300000-0000-0000-0000-0000000e3300');

insert into public.attendance_sessions (id, organization_id, class_id, session_date)
values ('e9100000-0000-0000-0000-0000000e9100', 'e2100000-0000-0000-0000-0000000e2100',
        'e5100000-0000-0000-0000-0000000e5100', public.orbit_today());
insert into public.attendance_records (organization_id, session_id, student_id, status)
values ('e2100000-0000-0000-0000-0000000e2100', 'e9100000-0000-0000-0000-0000000e9100',
        'e6100000-0000-0000-0000-0000000e6100', 'present');

insert into public.payment_plans (id, organization_id, student_id, name, total_amount)
values ('ea100000-0000-0000-0000-00000000ea10', 'e2100000-0000-0000-0000-0000000e2100',
        'e6100000-0000-0000-0000-0000000e6100', 'Yıllık', 1000);
insert into public.installments (organization_id, plan_id, sequence_no, due_date, amount)
values ('e2100000-0000-0000-0000-0000000e2100', 'ea100000-0000-0000-0000-00000000ea10',
        1, public.orbit_today() + 30, 1000);

-- Kişinin gözüyle, verilen tablodaki bu kurumun satır sayısı.
create function pg_temp.sayi(kisi uuid, tablo text) returns bigint language plpgsql as $$
declare sonuc bigint;
begin
  perform set_config('request.jwt.claim.sub', kisi::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  execute format('select count(*) from public.%I where organization_id = %L',
                 tablo, 'e2100000-0000-0000-0000-0000000e2100') into sonuc;
  execute 'reset role';
  return sonuc;
end $$;

-- Kişi bu öğrenci kaydını kimliğiyle arayınca buluyor mu?
create function pg_temp.gorur(kisi uuid, ogrenci uuid) returns boolean language plpgsql as $$
declare sonuc boolean;
begin
  perform set_config('request.jwt.claim.sub', kisi::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  select exists (select 1 from public.students where id = ogrenci) into sonuc;
  execute 'reset role';
  return sonuc;
end $$;

-- 1–3
select is(pg_temp.sayi('e1200000-0000-0000-0000-0000000e1200', 'students'), 2::bigint,
  'a branch admin sees their branch''s student and the unbranched one');
select ok(not pg_temp.gorur('e1200000-0000-0000-0000-0000000e1200', 'e6200000-0000-0000-0000-0000000e6200'),
  'a branch admin does not see another branch''s student, even by id');
select is(pg_temp.sayi('e1100000-0000-0000-0000-0000000e1100', 'students'), 3::bigint,
  'an organization-wide admin sees every student');

-- 4–6
select is(pg_temp.sayi('e1300000-0000-0000-0000-0000000e1300', 'students'), 1::bigint,
  'a teacher sees only the student they teach');
select is(pg_temp.sayi('e1300000-0000-0000-0000-0000000e1300', 'guardians'), 1::bigint,
  'a teacher sees the guardian of a student they teach');
select is(
  pg_temp.sayi('e1300000-0000-0000-0000-0000000e1300', 'homework_submissions')
  + pg_temp.sayi('e1700000-0000-0000-0000-0000000e1700', 'homework_submissions'),
  1::bigint,
  'the class teacher sees the submission; a teacher of no class does not');

-- 7–8
select is(pg_temp.sayi('e1400000-0000-0000-0000-0000000e1400', 'students'), 1::bigint,
  'a substitute covering today sees the absent teacher''s student');
select is(pg_temp.sayi('e1400000-0000-0000-0000-0000000e1400', 'attendance_records'), 1::bigint,
  'a substitute covering today sees that class''s attendance');

-- 9–10
select is(pg_temp.sayi('e1600000-0000-0000-0000-0000000e1600', 'installments'), 1::bigint,
  'a guardian sees their child''s installment');
select is(pg_temp.sayi('e1300000-0000-0000-0000-0000000e1300', 'installments'), 0::bigint,
  'a teacher does not see installments');

-- 11
select is(pg_temp.sayi('e1500000-0000-0000-0000-0000000e1500', 'students'), 1::bigint,
  'a student sees only their own record');

-- 12
select is(
  (select count(*) from pg_policies
    where schemaname = 'public' and cmd = 'SELECT' and permissive = 'PERMISSIVE'
      and tablename = any (array[
        'homework_assignments', 'schedule_entries', 'daily_feed_posts', 'students',
        'class_enrollments', 'student_guardians', 'attendance_records',
        'attendance_sessions', 'exam_results', 'homework_submissions',
        'installments', 'guardians'])
      and qual like '%current_user_must_change_password%'),
  12::bigint,
  'each of the twelve tables has exactly one read policy, carrying the password lock');

-- 13
select is(
  (select count(*) from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = any (array[
        'current_user_visible_class_ids', 'current_user_active_membership_ids',
        'current_user_full_admin_org_ids', 'current_user_admin_branch_ids',
        'current_user_taught_student_ids', 'current_user_guarded_student_ids',
        'current_user_own_student_ids', 'current_user_guardian_ids',
        'current_user_teaching_class_ids', 'current_user_attended_class_ids',
        'current_user_taught_guardian_ids', 'current_user_visible_payment_plan_ids'])
      and not has_function_privilege('anon', oid, 'execute')
      and has_function_privilege('authenticated', oid, 'execute')),
  12::bigint,
  'anon cannot call the twelve visibility functions; authenticated can');

select * from finish();
rollback;
