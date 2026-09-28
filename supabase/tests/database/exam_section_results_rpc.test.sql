-- `record_exam_section_results` (`20261008000000`): ders ders sonuçları tek
-- işlemde yazar; yetki `record_exam_results` ile aynı; kurallar tabloda.

begin;

create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
values
  ('a1000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rpc-ogretmen@example.test', '', now(), now()),
  ('a2000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rpc-baska-ogretmen@example.test', '', now(), now()),
  ('a3000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rpc-ogrenci@example.test', '', now(), now());

insert into public.organizations (id, name, slug, code)
values ('aa000000-0000-0000-0000-0000000000aa', 'RPC Kurumu', 'rpc-kurumu', 8111);

insert into public.branches (id, organization_id, name, is_default)
values ('ac000000-0000-0000-0000-0000000000ac', 'aa000000-0000-0000-0000-0000000000aa', 'Merkez', true);

insert into public.organization_memberships
  (id, organization_id, branch_id, user_id, role, status, person_code)
values
  ('ad100000-0000-0000-0000-0000000da001', 'aa000000-0000-0000-0000-0000000000aa',
   'ac000000-0000-0000-0000-0000000000ac', 'a1000000-0000-0000-0000-0000000000a1', 'teacher', 'active', 9201),
  ('ad200000-0000-0000-0000-0000000da002', 'aa000000-0000-0000-0000-0000000000aa',
   'ac000000-0000-0000-0000-0000000000ac', 'a2000000-0000-0000-0000-0000000000a2', 'teacher', 'active', 9202),
  ('ad300000-0000-0000-0000-0000000da003', 'aa000000-0000-0000-0000-0000000000aa',
   'ac000000-0000-0000-0000-0000000000ac', 'a3000000-0000-0000-0000-0000000000a3', 'student', 'active', 9203);

insert into public.subjects (id, organization_id, name)
values ('ae000000-0000-0000-0000-0000000000ae', 'aa000000-0000-0000-0000-0000000000aa', 'Türkçe');

insert into public.classes (id, organization_id, branch_id, name)
values
  ('af100000-0000-0000-0000-0000000fa001', 'aa000000-0000-0000-0000-0000000000aa',
   'ac000000-0000-0000-0000-0000000000ac', '12-A'),
  ('af200000-0000-0000-0000-0000000fa002', 'aa000000-0000-0000-0000-0000000000aa',
   'ac000000-0000-0000-0000-0000000000ac', '12-B');

insert into public.class_teachers (organization_id, class_id, membership_id, subject_id)
values
  ('aa000000-0000-0000-0000-0000000000aa', 'af100000-0000-0000-0000-0000000fa001',
   'ad100000-0000-0000-0000-0000000da001', 'ae000000-0000-0000-0000-0000000000ae'),
  ('aa000000-0000-0000-0000-0000000000aa', 'af200000-0000-0000-0000-0000000fa002',
   'ad200000-0000-0000-0000-0000000da002', 'ae000000-0000-0000-0000-0000000000ae');

insert into public.students (id, organization_id, branch_id, auth_user_id, full_name)
values
  ('a6100000-0000-0000-0000-0000000006a1', 'aa000000-0000-0000-0000-0000000000aa',
   'ac000000-0000-0000-0000-0000000000ac', 'a3000000-0000-0000-0000-0000000000a3', 'S1'),
  ('a6200000-0000-0000-0000-0000000006a2', 'aa000000-0000-0000-0000-0000000000aa',
   'ac000000-0000-0000-0000-0000000000ac', null, 'S2');

insert into public.class_enrollments (organization_id, class_id, student_id)
values
  ('aa000000-0000-0000-0000-0000000000aa', 'af100000-0000-0000-0000-0000000fa001', 'a6100000-0000-0000-0000-0000000006a1'),
  ('aa000000-0000-0000-0000-0000000000aa', 'af100000-0000-0000-0000-0000000fa001', 'a6200000-0000-0000-0000-0000000006a2');

insert into public.exams (id, organization_id, class_id, name, exam_date, net_penalty)
values
  ('a7100000-0000-0000-0000-0000000007a1', 'aa000000-0000-0000-0000-0000000000aa',
   'af100000-0000-0000-0000-0000000fa001', 'TYT 1', public.orbit_today(), 4),
  ('a7200000-0000-0000-0000-0000000007a2', 'aa000000-0000-0000-0000-0000000000aa',
   'af100000-0000-0000-0000-0000000fa001', 'TYT 2', public.orbit_today(), 4);

insert into public.exam_sections (id, organization_id, exam_id, name, question_count)
values
  ('a8100000-0000-0000-0000-0000000008a1', 'aa000000-0000-0000-0000-0000000000aa',
   'a7100000-0000-0000-0000-0000000007a1', 'Türkçe', 40),
  ('a8200000-0000-0000-0000-0000000008a2', 'aa000000-0000-0000-0000-0000000000aa',
   'a7200000-0000-0000-0000-0000000007a2', 'Türkçe', 40);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-0000000000a1', true);

select is(
  public.record_exam_section_results(
    'a7100000-0000-0000-0000-0000000007a1',
    '[{"section_id": "a8100000-0000-0000-0000-0000000008a1", "student_id": "a6100000-0000-0000-0000-0000000006a1", "correct": 30, "wrong": 8},
      {"section_id": "a8100000-0000-0000-0000-0000000008a1", "student_id": "a6200000-0000-0000-0000-0000000006a2", "correct": 20, "wrong": 0}]'::jsonb
  ),
  2,
  'the class teacher saves two students in one call'
);

select results_eq(
  $$ select student_id::text, score from public.exam_results
     where exam_id = 'a7100000-0000-0000-0000-0000000007a1' order by score $$,
  $$ values ('a6200000-0000-0000-0000-0000000006a2', 20.00::numeric),
            ('a6100000-0000-0000-0000-0000000006a1', 28.00::numeric) $$,
  'the totals are computed by the database'
);

select is(
  public.record_exam_section_results(
    'a7100000-0000-0000-0000-0000000007a1',
    '[{"section_id": "a8100000-0000-0000-0000-0000000008a1", "student_id": "a6100000-0000-0000-0000-0000000006a1", "correct": 30, "wrong": 8},
      {"section_id": "a8100000-0000-0000-0000-0000000008a1", "student_id": "a6200000-0000-0000-0000-0000000006a2", "correct": 21, "wrong": 0}]'::jsonb
  ),
  1,
  'saving again touches only the row that changed'
);

select throws_ok(
  $$ select public.record_exam_section_results(
       'a7100000-0000-0000-0000-0000000007a1',
       '[{"section_id": "a8200000-0000-0000-0000-0000000008a2", "student_id": "a6100000-0000-0000-0000-0000000006a1", "correct": 1, "wrong": 0}]'::jsonb) $$,
  '23503', null,
  'a section of another exam is rejected'
);

select throws_ok(
  $$ select public.record_exam_section_results(
       'a7100000-0000-0000-0000-0000000007a1',
       '[{"section_id": "a8100000-0000-0000-0000-0000000008a1", "student_id": "a6100000-0000-0000-0000-0000000006a1", "correct": 35, "wrong": 6}]'::jsonb) $$,
  'ORB06', null,
  'the table rule (correct + wrong ≤ questions) still holds inside the function'
);

select set_config('request.jwt.claim.sub', 'a2000000-0000-0000-0000-0000000000a2', true);

select throws_ok(
  $$ select public.record_exam_section_results(
       'a7100000-0000-0000-0000-0000000007a1',
       '[{"section_id": "a8100000-0000-0000-0000-0000000008a1", "student_id": "a6100000-0000-0000-0000-0000000006a1", "correct": 40, "wrong": 0}]'::jsonb) $$,
  '42501', null,
  'the teacher of another class cannot save'
);

select set_config('request.jwt.claim.sub', 'a3000000-0000-0000-0000-0000000000a3', true);

select throws_ok(
  $$ select public.record_exam_section_results(
       'a7100000-0000-0000-0000-0000000007a1',
       '[{"section_id": "a8100000-0000-0000-0000-0000000008a1", "student_id": "a6100000-0000-0000-0000-0000000006a1", "correct": 40, "wrong": 0}]'::jsonb) $$,
  '42501', null,
  'a student cannot save their own result'
);

reset role;
set local role anon;

select throws_ok(
  $$ select public.record_exam_section_results('a7100000-0000-0000-0000-0000000007a1', '[]'::jsonb) $$,
  '42501', null,
  'anon cannot call record_exam_section_results'
);

select * from finish();
rollback;
