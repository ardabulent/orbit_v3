-- Ödev tamamlanma sayımı (2026-10-05, v1.5-24).
--
-- C sınıfında üç etkin öğrenci (S1 S2 S3) + sınıftan ayrılmış S4. Ödev H1'i
-- S1, S2 ve S4 teslim etti (S2'nin teslimi arşivlendi). D sınıfının ödevi H2.
--
--   1. Yönetici H1 için 2 / 4 görür: pay S1 + S4, payda S1 S2 S3 ∪ S4.
--   2. Arşivli teslim paya girmez (S2), arşivli kayıt paydaya girmez.
--   3. Sınıfın öğretmeni H1'i görür.
--   4. ⛔ Başka sınıfın öğretmeni H1 için satır almaz.
--   5. ⛔ Öğrenci satır almaz (sınıfın tamamı onun görebileceği şey değil).
--   6. ⛔ Komşu kurumun yöneticisi satır almaz.
--   7. ⛔ Kilitli yönetici satır almaz.
--   8. Teslimi olmayan ödev 0 / sınıf mevcudu.

begin;

create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
values
  ('c5100000-0000-0000-0000-0000000c5100', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'os-yonetici@example.test', '', now(), now()),
  ('c5200000-0000-0000-0000-0000000c5200', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'os-ogretmen-c@example.test', '', now(), now()),
  ('c5300000-0000-0000-0000-0000000c5300', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'os-ogretmen-d@example.test', '', now(), now()),
  ('c5400000-0000-0000-0000-0000000c5400', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'os-ogrenci@example.test', '', now(), now()),
  ('c5500000-0000-0000-0000-0000000c5500', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'os-komsu@example.test', '', now(), now());

insert into public.organizations (id, name, slug, code)
values
  ('c6100000-0000-0000-0000-0000000c6100', 'Sayım Dershanesi', 'sayim-dershanesi', 8910),
  ('c6200000-0000-0000-0000-0000000c6200', 'Komşu Sayım', 'komsu-sayim', 8911);

insert into public.organization_memberships (id, organization_id, user_id, role, status)
values
  ('c7100000-0000-0000-0000-0000000c7100', 'c6100000-0000-0000-0000-0000000c6100',
   'c5100000-0000-0000-0000-0000000c5100', 'admin', 'active'),
  ('c7200000-0000-0000-0000-0000000c7200', 'c6100000-0000-0000-0000-0000000c6100',
   'c5200000-0000-0000-0000-0000000c5200', 'teacher', 'active'),
  ('c7300000-0000-0000-0000-0000000c7300', 'c6100000-0000-0000-0000-0000000c6100',
   'c5300000-0000-0000-0000-0000000c5300', 'teacher', 'active'),
  ('c7400000-0000-0000-0000-0000000c7400', 'c6100000-0000-0000-0000-0000000c6100',
   'c5400000-0000-0000-0000-0000000c5400', 'student', 'active'),
  ('c7500000-0000-0000-0000-0000000c7500', 'c6200000-0000-0000-0000-0000000c6200',
   'c5500000-0000-0000-0000-0000000c5500', 'admin', 'active');

insert into public.subjects (id, organization_id, name)
values ('c8000000-0000-0000-0000-0000000c8000', 'c6100000-0000-0000-0000-0000000c6100', 'Matematik');

insert into public.classes (id, organization_id, name)
values
  ('c9100000-0000-0000-0000-0000000c9100', 'c6100000-0000-0000-0000-0000000c6100', 'C'),
  ('c9200000-0000-0000-0000-0000000c9200', 'c6100000-0000-0000-0000-0000000c6100', 'D');

insert into public.class_teachers (organization_id, class_id, membership_id, subject_id)
values
  ('c6100000-0000-0000-0000-0000000c6100', 'c9100000-0000-0000-0000-0000000c9100',
   'c7200000-0000-0000-0000-0000000c7200', 'c8000000-0000-0000-0000-0000000c8000'),
  ('c6100000-0000-0000-0000-0000000c6100', 'c9200000-0000-0000-0000-0000000c9200',
   'c7300000-0000-0000-0000-0000000c7300', 'c8000000-0000-0000-0000-0000000c8000');

insert into public.students (id, organization_id, auth_user_id, full_name)
values
  ('ca100000-0000-0000-0000-0000000ca100', 'c6100000-0000-0000-0000-0000000c6100',
   'c5400000-0000-0000-0000-0000000c5400', 'S1'),
  ('ca200000-0000-0000-0000-0000000ca200', 'c6100000-0000-0000-0000-0000000c6100', null, 'S2'),
  ('ca300000-0000-0000-0000-0000000ca300', 'c6100000-0000-0000-0000-0000000c6100', null, 'S3'),
  ('ca400000-0000-0000-0000-0000000ca400', 'c6100000-0000-0000-0000-0000000c6100', null, 'S4');

insert into public.class_enrollments (organization_id, class_id, student_id, archived_at)
values
  ('c6100000-0000-0000-0000-0000000c6100', 'c9100000-0000-0000-0000-0000000c9100', 'ca100000-0000-0000-0000-0000000ca100', null),
  ('c6100000-0000-0000-0000-0000000c6100', 'c9100000-0000-0000-0000-0000000c9100', 'ca200000-0000-0000-0000-0000000ca200', null),
  ('c6100000-0000-0000-0000-0000000c6100', 'c9100000-0000-0000-0000-0000000c9100', 'ca300000-0000-0000-0000-0000000ca300', null),
  ('c6100000-0000-0000-0000-0000000c6100', 'c9100000-0000-0000-0000-0000000c9100', 'ca400000-0000-0000-0000-0000000ca400', now());

insert into public.homework_assignments (
  id, organization_id, class_id, subject_id, title,
  assigned_by_membership_id, assigned_on, due_date
)
values
  ('cb100000-0000-0000-0000-0000000cb100', 'c6100000-0000-0000-0000-0000000c6100',
   'c9100000-0000-0000-0000-0000000c9100', 'c8000000-0000-0000-0000-0000000c8000',
   'H1', 'c7200000-0000-0000-0000-0000000c7200', '2026-09-01', '2026-09-08'),
  ('cb200000-0000-0000-0000-0000000cb200', 'c6100000-0000-0000-0000-0000000c6100',
   'c9200000-0000-0000-0000-0000000c9200', 'c8000000-0000-0000-0000-0000000c8000',
   'H2', 'c7300000-0000-0000-0000-0000000c7300', '2026-09-01', '2026-09-08'),
  ('cb300000-0000-0000-0000-0000000cb300', 'c6100000-0000-0000-0000-0000000c6100',
   'c9100000-0000-0000-0000-0000000c9100', 'c8000000-0000-0000-0000-0000000c8000',
   'H3', 'c7200000-0000-0000-0000-0000000c7200', '2026-09-02', '2026-09-09');

-- Teslimler `recorded_by_membership_id`'yi tetikleyiciyle çağıranın
-- üyeliğinden yazar; yönetici olarak eklenir.
select set_config('request.jwt.claim.sub', 'c5100000-0000-0000-0000-0000000c5100', true);

insert into public.homework_submissions (organization_id, homework_id, student_id, archived_at)
values
  ('c6100000-0000-0000-0000-0000000c6100', 'cb100000-0000-0000-0000-0000000cb100', 'ca100000-0000-0000-0000-0000000ca100', null),
  ('c6100000-0000-0000-0000-0000000c6100', 'cb100000-0000-0000-0000-0000000cb100', 'ca200000-0000-0000-0000-0000000ca200', now()),
  ('c6100000-0000-0000-0000-0000000c6100', 'cb100000-0000-0000-0000-0000000cb100', 'ca400000-0000-0000-0000-0000000ca400', null);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

create function pg_temp.sayim(kimlik uuid) returns text language sql as $$
  select coalesce(
    (select submitted_count || '/' || total_count
       from public.homework_completion_counts(array[kimlik]) ),
    'yok')
$$;

-- 1–2 · Yönetici
select set_config('request.jwt.claim.sub', 'c5100000-0000-0000-0000-0000000c5100', true);
select is(pg_temp.sayim('cb100000-0000-0000-0000-0000000cb100'), '2/4',
  'admin: submitted S1+S4, denominator active S1 S2 S3 plus departed submitter S4');
select is(pg_temp.sayim('cb300000-0000-0000-0000-0000000cb300'), '0/3',
  'a homework with no submissions is 0 over the active class size');

-- 3 · Sınıfın öğretmeni
select set_config('request.jwt.claim.sub', 'c5200000-0000-0000-0000-0000000c5200', true);
select is(pg_temp.sayim('cb100000-0000-0000-0000-0000000cb100'), '2/4',
  'the class teacher gets the same count');

-- 4 · Başka sınıfın öğretmeni
select set_config('request.jwt.claim.sub', 'c5300000-0000-0000-0000-0000000c5300', true);
select is(pg_temp.sayim('cb100000-0000-0000-0000-0000000cb100'), 'yok',
  'a teacher of another class gets no row');
select is(pg_temp.sayim('cb200000-0000-0000-0000-0000000cb200'), '0/0',
  'that teacher does get their own class homework (empty class)');

-- 5 · Öğrenci
select set_config('request.jwt.claim.sub', 'c5400000-0000-0000-0000-0000000c5400', true);
select is(pg_temp.sayim('cb100000-0000-0000-0000-0000000cb100'), 'yok',
  'a student gets no class-wide count');

-- 6 · Komşu kurum
select set_config('request.jwt.claim.sub', 'c5500000-0000-0000-0000-0000000c5500', true);
select is(pg_temp.sayim('cb100000-0000-0000-0000-0000000cb100'), 'yok',
  'an admin of another institution gets no row');

-- 7 · Kilitli yönetici
reset role;
update public.profiles set must_change_password = true
 where id = 'c5100000-0000-0000-0000-0000000c5100';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c5100000-0000-0000-0000-0000000c5100', true);
select is(pg_temp.sayim('cb100000-0000-0000-0000-0000000cb100'), 'yok',
  'a locked admin gets no row');

select * from finish();
rollback;
