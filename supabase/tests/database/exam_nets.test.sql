-- Deneme netleri (`exam_sections`, `exam_section_results`, `recompute_exam_net`,
-- `exam_averages` — `20261007000000`).
--
-- Kadro: A yönetici · T 12-A öğretmeni · U 12-B öğretmeni · S1 (hesaplı),
-- S2, S3 12-A öğrencisi · S5 (hesaplı) 12-B öğrencisi.
-- E: 12-A denemesi, YKS kuralı (4 yanlış 1 doğru), Türkçe 40 + Matematik 40.
-- F: 12-A tek puanlı sınav.
--
-- Sınanan: net veritabanında hesaplanır ve toplam exam_results.score'a
-- yazılır; tek yazar kuralı; doğru+yanlış tavanı; sınıf ve kurum sınırı;
-- kural değişince yeniden hesap; bölüm arşivi; puanlama türü kilidi;
-- ortalamanın üç sonuç eşiği ve görünürlüğü; iz defteri.

begin;

create extension if not exists pgtap with schema extensions;
select plan(23);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
values
  ('91000000-0000-0000-0000-000000000091', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'net-yonetici@example.test', '', now(), now()),
  ('92000000-0000-0000-0000-000000000092', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'net-ogretmen-t@example.test', '', now(), now()),
  ('93000000-0000-0000-0000-000000000093', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'net-ogretmen-u@example.test', '', now(), now()),
  ('94000000-0000-0000-0000-000000000094', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'net-ogrenci-s1@example.test', '', now(), now()),
  ('95000000-0000-0000-0000-000000000095', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'net-ogrenci-s5@example.test', '', now(), now());

insert into public.organizations (id, name, slug, code)
values ('9a000000-0000-0000-0000-00000000009a', 'Net Kurumu', 'net-kurumu', 8011);

insert into public.branches (id, organization_id, name, is_default)
values ('9c000000-0000-0000-0000-00000000009c', '9a000000-0000-0000-0000-00000000009a', 'Merkez', true);

insert into public.organization_memberships
  (id, organization_id, branch_id, user_id, role, status, person_code)
values
  ('9d000000-0000-0000-0000-0000000d9000', '9a000000-0000-0000-0000-00000000009a',
   '9c000000-0000-0000-0000-00000000009c', '91000000-0000-0000-0000-000000000091', 'admin', 'active', 9101),
  ('9d100000-0000-0000-0000-0000000d9001', '9a000000-0000-0000-0000-00000000009a',
   '9c000000-0000-0000-0000-00000000009c', '92000000-0000-0000-0000-000000000092', 'teacher', 'active', 9102),
  ('9d200000-0000-0000-0000-0000000d9002', '9a000000-0000-0000-0000-00000000009a',
   '9c000000-0000-0000-0000-00000000009c', '93000000-0000-0000-0000-000000000093', 'teacher', 'active', 9103),
  ('9d300000-0000-0000-0000-0000000d9003', '9a000000-0000-0000-0000-00000000009a',
   '9c000000-0000-0000-0000-00000000009c', '94000000-0000-0000-0000-000000000094', 'student', 'active', 9104),
  ('9d400000-0000-0000-0000-0000000d9004', '9a000000-0000-0000-0000-00000000009a',
   '9c000000-0000-0000-0000-00000000009c', '95000000-0000-0000-0000-000000000095', 'student', 'active', 9105);

insert into public.subjects (id, organization_id, name)
values
  ('9e100000-0000-0000-0000-00000000009e', '9a000000-0000-0000-0000-00000000009a', 'Türkçe'),
  ('9e200000-0000-0000-0000-00000000009e', '9a000000-0000-0000-0000-00000000009a', 'Matematik');

insert into public.classes (id, organization_id, branch_id, name)
values
  ('9f100000-0000-0000-0000-0000000f9001', '9a000000-0000-0000-0000-00000000009a',
   '9c000000-0000-0000-0000-00000000009c', '12-A'),
  ('9f200000-0000-0000-0000-0000000f9002', '9a000000-0000-0000-0000-00000000009a',
   '9c000000-0000-0000-0000-00000000009c', '12-B');

insert into public.class_teachers (organization_id, class_id, membership_id, subject_id)
values
  ('9a000000-0000-0000-0000-00000000009a', '9f100000-0000-0000-0000-0000000f9001',
   '9d100000-0000-0000-0000-0000000d9001', '9e100000-0000-0000-0000-00000000009e'),
  ('9a000000-0000-0000-0000-00000000009a', '9f200000-0000-0000-0000-0000000f9002',
   '9d200000-0000-0000-0000-0000000d9002', '9e100000-0000-0000-0000-00000000009e');

insert into public.students (id, organization_id, branch_id, auth_user_id, full_name)
values
  ('96100000-0000-0000-0000-000000000961', '9a000000-0000-0000-0000-00000000009a',
   '9c000000-0000-0000-0000-00000000009c', '94000000-0000-0000-0000-000000000094', 'S1'),
  ('96200000-0000-0000-0000-000000000962', '9a000000-0000-0000-0000-00000000009a',
   '9c000000-0000-0000-0000-00000000009c', null, 'S2'),
  ('96300000-0000-0000-0000-000000000963', '9a000000-0000-0000-0000-00000000009a',
   '9c000000-0000-0000-0000-00000000009c', null, 'S3'),
  ('96500000-0000-0000-0000-000000000965', '9a000000-0000-0000-0000-00000000009a',
   '9c000000-0000-0000-0000-00000000009c', '95000000-0000-0000-0000-000000000095', 'S5');

insert into public.class_enrollments (organization_id, class_id, student_id)
values
  ('9a000000-0000-0000-0000-00000000009a', '9f100000-0000-0000-0000-0000000f9001', '96100000-0000-0000-0000-000000000961'),
  ('9a000000-0000-0000-0000-00000000009a', '9f100000-0000-0000-0000-0000000f9001', '96200000-0000-0000-0000-000000000962'),
  ('9a000000-0000-0000-0000-00000000009a', '9f100000-0000-0000-0000-0000000f9001', '96300000-0000-0000-0000-000000000963'),
  ('9a000000-0000-0000-0000-00000000009a', '9f200000-0000-0000-0000-0000000f9002', '96500000-0000-0000-0000-000000000965');

insert into public.exams (id, organization_id, class_id, name, exam_date, net_penalty)
values
  ('97100000-0000-0000-0000-000000000971', '9a000000-0000-0000-0000-00000000009a',
   '9f100000-0000-0000-0000-0000000f9001', 'TYT Deneme 1', public.orbit_today(), 4),
  ('97200000-0000-0000-0000-000000000972', '9a000000-0000-0000-0000-00000000009a',
   '9f100000-0000-0000-0000-0000000f9001', 'Yazılı', public.orbit_today(), null);

insert into public.exam_sections (id, organization_id, exam_id, subject_id, name, question_count, position)
values
  ('98100000-0000-0000-0000-000000000981', '9a000000-0000-0000-0000-00000000009a',
   '97100000-0000-0000-0000-000000000971', '9e100000-0000-0000-0000-00000000009e', 'Türkçe', 40, 1),
  ('98200000-0000-0000-0000-000000000982', '9a000000-0000-0000-0000-00000000009a',
   '97100000-0000-0000-0000-000000000971', '9e200000-0000-0000-0000-00000000009e', 'Matematik', 40, 2),
  -- Tek puanlı sınava eklenmiş bir bölüm: sonuç yazılamamalı.
  ('98300000-0000-0000-0000-000000000983', '9a000000-0000-0000-0000-00000000009a',
   '97200000-0000-0000-0000-000000000972', null, 'Genel', 20, 1);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '92000000-0000-0000-0000-000000000092', true);

-- =========================================================================
-- 1. Net hesabı
-- =========================================================================

insert into public.exam_section_results (organization_id, exam_id, section_id, student_id, correct, wrong)
values ('9a000000-0000-0000-0000-00000000009a', '97100000-0000-0000-0000-000000000971',
        '98100000-0000-0000-0000-000000000981', '96100000-0000-0000-0000-000000000961', 30, 8);

select is(
  (select score from public.exam_results
   where exam_id = '97100000-0000-0000-0000-000000000971' and student_id = '96100000-0000-0000-0000-000000000961'),
  28.00::numeric,
  'Türkçe 30 doğru 8 yanlış: net 28 and the total is written to exam_results.score'
);

insert into public.exam_section_results (organization_id, exam_id, section_id, student_id, correct, wrong)
values ('9a000000-0000-0000-0000-00000000009a', '97100000-0000-0000-0000-000000000971',
        '98200000-0000-0000-0000-000000000982', '96100000-0000-0000-0000-000000000961', 20, 10);

select is(
  (select score from public.exam_results
   where exam_id = '97100000-0000-0000-0000-000000000971' and student_id = '96100000-0000-0000-0000-000000000961'),
  45.50::numeric,
  'adding Matematik 20/10 (net 17,5) brings the total to 45,5'
);

update public.exam_section_results set correct = 32, wrong = 4
where section_id = '98100000-0000-0000-0000-000000000981'
  and student_id = '96100000-0000-0000-0000-000000000961';

select is(
  (select score from public.exam_results
   where exam_id = '97100000-0000-0000-0000-000000000971' and student_id = '96100000-0000-0000-0000-000000000961'),
  48.50::numeric,
  'correcting a section recomputes the total'
);

-- =========================================================================
-- 2. Kurallar
-- =========================================================================

select throws_ok(
  $$ update public.exam_section_results set correct = 35, wrong = 6
     where section_id = '98100000-0000-0000-0000-000000000981'
       and student_id = '96100000-0000-0000-0000-000000000961' $$,
  'ORB06', null,
  'correct + wrong cannot exceed the question count'
);

select throws_ok(
  $$ insert into public.exam_results (organization_id, exam_id, student_id, score)
     values ('9a000000-0000-0000-0000-00000000009a', '97100000-0000-0000-0000-000000000971',
             '96200000-0000-0000-0000-000000000962', 50) $$,
  'ORB06', null,
  'the total of a net exam cannot be written by hand'
);

select lives_ok(
  $$ insert into public.exam_results (organization_id, exam_id, student_id, score)
     values ('9a000000-0000-0000-0000-00000000009a', '97200000-0000-0000-0000-000000000972',
             '96200000-0000-0000-0000-000000000962', 70) $$,
  'a single-score exam is still written by hand, as before'
);

select throws_ok(
  $$ insert into public.exam_section_results (organization_id, exam_id, section_id, student_id, correct, wrong)
     values ('9a000000-0000-0000-0000-00000000009a', '97200000-0000-0000-0000-000000000972',
             '98300000-0000-0000-0000-000000000983', '96200000-0000-0000-0000-000000000962', 10, 2) $$,
  'ORB06', null,
  'a single-score exam takes no section results'
);

reset role;

select throws_ok(
  $$ insert into public.exam_section_results (organization_id, exam_id, section_id, student_id, correct, wrong)
     values ('9a000000-0000-0000-0000-00000000009a', '97100000-0000-0000-0000-000000000971',
             '98100000-0000-0000-0000-000000000981', '96500000-0000-0000-0000-000000000965', 10, 2) $$,
  'ORB02', null,
  'a student of another class cannot get a result in a class exam'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '93000000-0000-0000-0000-000000000093', true);

select throws_ok(
  $$ insert into public.exam_section_results (organization_id, exam_id, section_id, student_id, correct, wrong)
     values ('9a000000-0000-0000-0000-00000000009a', '97100000-0000-0000-0000-000000000971',
             '98100000-0000-0000-0000-000000000981', '96200000-0000-0000-0000-000000000962', 10, 2) $$,
  '42501', null,
  'the teacher of another class cannot enter results'
);

-- =========================================================================
-- 3. Kural değişimi, bölüm arşivi, puanlama türü kilidi
-- =========================================================================

select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000091', true);

update public.exams set net_penalty = 3 where id = '97100000-0000-0000-0000-000000000971';

select is(
  (select score from public.exam_results
   where exam_id = '97100000-0000-0000-0000-000000000971' and student_id = '96100000-0000-0000-0000-000000000961'),
  47.33::numeric,
  'switching to the LGS rule (3 wrong cancel 1) recomputes: 32 − 4/3 + 20 − 10/3 = 47,33'
);

update public.exam_sections set archived_at = now()
where id = '98200000-0000-0000-0000-000000000982';

select is(
  (select score from public.exam_results
   where exam_id = '97100000-0000-0000-0000-000000000971' and student_id = '96100000-0000-0000-0000-000000000961'),
  30.67::numeric,
  'an archived section drops out of the total'
);

select throws_ok(
  $$ update public.exams set net_penalty = null where id = '97100000-0000-0000-0000-000000000971' $$,
  'ORB06', null,
  'a net exam with results cannot be turned into a single-score exam'
);

select throws_ok(
  $$ update public.exams set net_penalty = 4 where id = '97200000-0000-0000-0000-000000000972' $$,
  'ORB06', null,
  'a single-score exam with results cannot be turned into a net exam'
);

-- =========================================================================
-- 4. Ortalama: üç sonuç eşiği, görünürlük
-- =========================================================================

select set_config('request.jwt.claim.sub', '92000000-0000-0000-0000-000000000092', true);

insert into public.exam_section_results (organization_id, exam_id, section_id, student_id, correct, wrong)
values ('9a000000-0000-0000-0000-00000000009a', '97100000-0000-0000-0000-000000000971',
        '98100000-0000-0000-0000-000000000981', '96200000-0000-0000-0000-000000000962', 20, 0);

select is(
  (select average from public.exam_averages(array['97100000-0000-0000-0000-000000000971'::uuid])
   where section_id is null),
  null::numeric,
  'with two results the average is withheld'
);

insert into public.exam_section_results (organization_id, exam_id, section_id, student_id, correct, wrong)
values ('9a000000-0000-0000-0000-00000000009a', '97100000-0000-0000-0000-000000000971',
        '98100000-0000-0000-0000-000000000981', '96300000-0000-0000-0000-000000000963', 10, 3);

-- S1 30,67 · S2 20 · S3 10 − 3/3 = 9 → (30,6667 + 20 + 9) / 3 = 19,89
select results_eq(
  $$ select section_id is null, result_count, average
     from public.exam_averages(array['97100000-0000-0000-0000-000000000971'::uuid])
     order by section_id nulls first $$,
  $$ values (true, 3::bigint, 19.89::numeric), (false, 3::bigint, 19.89::numeric) $$,
  'with three results the total and the Türkçe section averages appear; the archived section is gone'
);

-- S2 ve S3'ün tek sonucu Türkçe'de: Türkçe kaldırılırsa toplamları
-- dayanaksız kalırdı. Silme yok — kaldırma engellenir.
select throws_ok(
  $$ update public.exam_sections set archived_at = now()
     where id = '98100000-0000-0000-0000-000000000981' $$,
  'ORB06', null,
  'a section that is some student''s only result cannot be removed'
);

-- Öğrenci S1: kendi sonucu + ortalama, başkasının puanı değil.
select set_config('request.jwt.claim.sub', '94000000-0000-0000-0000-000000000094', true);

select is(
  (select count(*) from public.exam_results where exam_id = '97100000-0000-0000-0000-000000000971'),
  1::bigint,
  'the student reads only their own total'
);

select is(
  (select count(*) from public.exam_section_results where exam_id = '97100000-0000-0000-0000-000000000971'),
  2::bigint,
  'the student reads only their own section results (Türkçe and the archived Matematik row)'
);

select is(
  (select average from public.exam_averages(array['97100000-0000-0000-0000-000000000971'::uuid])
   where section_id is null),
  19.89::numeric,
  'the student sees the class average'
);

-- Öğrenci kendi sonucunu değiştiremez: RLS güncellemeyi sessizce süzer.
update public.exam_section_results set correct = 40, wrong = 0
where section_id = '98100000-0000-0000-0000-000000000981'
  and student_id = '96100000-0000-0000-0000-000000000961';

select is(
  (select correct from public.exam_section_results
   where section_id = '98100000-0000-0000-0000-000000000981'
     and student_id = '96100000-0000-0000-0000-000000000961'),
  32::smallint,
  'a student cannot change their own result'
);

-- Başka sınıfın öğrencisi S5: ortalamayı göremez.
select set_config('request.jwt.claim.sub', '95000000-0000-0000-0000-000000000095', true);

select is(
  (select count(*) from public.exam_averages(array['97100000-0000-0000-0000-000000000971'::uuid])),
  0::bigint,
  'a student of another class gets no average for this class exam'
);

reset role;

select ok(
  (select count(*) from public.audit_events
   where entity_type = 'exam_section_result' and action = 'exam_section_result.created') = 4,
  'every section result entry leaves a trace'
);

set local role anon;

select throws_ok(
  $$ select * from public.exam_averages(array['97100000-0000-0000-0000-000000000971'::uuid]) $$,
  '42501', null,
  'anon cannot call exam_averages'
);

select * from finish();
rollback;
