-- Sınavın kapsamı: sınıf, şube ya da kurum geneli (2026-10-23, ana plan 1.5).
--
--   1. ⛔ Bir sınav hem sınıfa hem şubeye bağlanamaz.
--   2. Şube geneli sınavda şubenin öğrencisine sonuç yazılır.
--   3. ⛔ Başka şubenin öğrencisine yazılamaz (ORB02) — tek puanlı ve
--   4. ⛔ netli (bölüm) sonuçta da.
--   5. Kurum geneli sınavda kurumun her öğrencisine yazılır.
--   6. ⛔ Sonucu olan kurum geneli sınav, dışarıda kalacak şubeye daraltılamaz.
--   7. Yönetici şube geneli sınav açar.
--   8. ⛔ Öğretmen şube ya da kurum geneli sınav açamaz.
--   9. Öğretmen okuttuğu sınıfa sınav açmaya devam eder.

begin;

create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
values
  ('5c110000-0000-0000-0000-00000005c110', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'kapsam-yonetici@example.test', '', now(), now()),
  ('5c120000-0000-0000-0000-00000005c120', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'kapsam-ogretmen@example.test', '', now(), now());

insert into public.organizations (id, name, slug, code)
values ('5c210000-0000-0000-0000-00000005c210', 'Kapsam Dershanesi', 'kapsam-dershanesi', 7995);

insert into public.branches (id, organization_id, name)
values
  ('5c310000-0000-0000-0000-00000005c310', '5c210000-0000-0000-0000-00000005c210', 'Merkez'),
  ('5c320000-0000-0000-0000-00000005c320', '5c210000-0000-0000-0000-00000005c210', 'Kadıköy');

insert into public.organization_memberships (id, organization_id, user_id, role, status)
values
  ('5c410000-0000-0000-0000-00000005c410', '5c210000-0000-0000-0000-00000005c210',
   '5c110000-0000-0000-0000-00000005c110', 'admin', 'active'),
  ('5c420000-0000-0000-0000-00000005c420', '5c210000-0000-0000-0000-00000005c210',
   '5c120000-0000-0000-0000-00000005c120', 'teacher', 'active');

insert into public.subjects (id, organization_id, name)
values ('5c510000-0000-0000-0000-00000005c510', '5c210000-0000-0000-0000-00000005c210', 'Matematik');

insert into public.classes (id, organization_id, branch_id, name)
values ('5c610000-0000-0000-0000-00000005c610', '5c210000-0000-0000-0000-00000005c210',
        '5c310000-0000-0000-0000-00000005c310', '12-A');

insert into public.class_teachers (organization_id, class_id, membership_id, subject_id)
values ('5c210000-0000-0000-0000-00000005c210', '5c610000-0000-0000-0000-00000005c610',
        '5c420000-0000-0000-0000-00000005c420', '5c510000-0000-0000-0000-00000005c510');

insert into public.students (id, organization_id, branch_id, full_name)
values
  ('5c710000-0000-0000-0000-00000005c710', '5c210000-0000-0000-0000-00000005c210',
   '5c310000-0000-0000-0000-00000005c310', 'Merkez Öğrencisi'),
  ('5c720000-0000-0000-0000-00000005c720', '5c210000-0000-0000-0000-00000005c210',
   '5c320000-0000-0000-0000-00000005c320', 'Kadıköy Öğrencisi');

-- 1
select throws_ok(
  $$insert into public.exams (organization_id, class_id, branch_id, name, exam_date)
    values ('5c210000-0000-0000-0000-00000005c210', '5c610000-0000-0000-0000-00000005c610',
            '5c310000-0000-0000-0000-00000005c310', 'İkisi birden', current_date)$$,
  '23514', null,
  'an exam cannot belong to a class and a branch at once'
);

insert into public.exams (id, organization_id, branch_id, name, exam_date, max_score)
values ('5c810000-0000-0000-0000-00000005c810', '5c210000-0000-0000-0000-00000005c210',
        '5c310000-0000-0000-0000-00000005c310', 'Merkez Denemesi', current_date, 100);

-- 2–3
select lives_ok(
  $$insert into public.exam_results (organization_id, exam_id, student_id, score)
    values ('5c210000-0000-0000-0000-00000005c210', '5c810000-0000-0000-0000-00000005c810',
            '5c710000-0000-0000-0000-00000005c710', 80)$$,
  'a branch-wide exam takes a result from that branch''s student'
);
select throws_ok(
  $$insert into public.exam_results (organization_id, exam_id, student_id, score)
    values ('5c210000-0000-0000-0000-00000005c210', '5c810000-0000-0000-0000-00000005c810',
            '5c720000-0000-0000-0000-00000005c720', 80)$$,
  'ORB02', null,
  'a branch-wide exam refuses another branch''s student'
);

-- 4 · Netli sınavın bölüm sonucu da aynı kapıdan geçer
insert into public.exams (id, organization_id, branch_id, name, exam_date, net_penalty)
values ('5c820000-0000-0000-0000-00000005c820', '5c210000-0000-0000-0000-00000005c210',
        '5c310000-0000-0000-0000-00000005c310', 'Merkez TYT', current_date, 4);
insert into public.exam_sections (id, organization_id, exam_id, subject_id, name, question_count, position)
values ('5c910000-0000-0000-0000-00000005c910', '5c210000-0000-0000-0000-00000005c210',
        '5c820000-0000-0000-0000-00000005c820', '5c510000-0000-0000-0000-00000005c510',
        'Matematik', 40, 1);
select throws_ok(
  $$insert into public.exam_section_results (organization_id, exam_id, section_id, student_id, correct, wrong)
    values ('5c210000-0000-0000-0000-00000005c210', '5c820000-0000-0000-0000-00000005c820',
            '5c910000-0000-0000-0000-00000005c910', '5c720000-0000-0000-0000-00000005c720', 10, 2)$$,
  'ORB02', null,
  'a section result is held to the branch as well'
);

-- 5–6 · Kurum geneli
insert into public.exams (id, organization_id, name, exam_date, max_score)
values ('5c830000-0000-0000-0000-00000005c830', '5c210000-0000-0000-0000-00000005c210',
        'Kurum Denemesi', current_date, 100);
select lives_ok(
  $$insert into public.exam_results (organization_id, exam_id, student_id, score)
    values ('5c210000-0000-0000-0000-00000005c210', '5c830000-0000-0000-0000-00000005c830',
            '5c720000-0000-0000-0000-00000005c720', 70)$$,
  'an institution-wide exam takes any student of the institution'
);
select throws_ok(
  $$update public.exams set branch_id = '5c310000-0000-0000-0000-00000005c310'
    where id = '5c830000-0000-0000-0000-00000005c830'$$,
  'ORB02', null,
  'a scope that would leave a result outside cannot be narrowed to'
);

-- 7–9 · Yetki
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '5c110000-0000-0000-0000-00000005c110', true);
select lives_ok(
  $$insert into public.exams (organization_id, branch_id, name, exam_date)
    values ('5c210000-0000-0000-0000-00000005c210', '5c320000-0000-0000-0000-00000005c320',
            'Kadıköy Denemesi', current_date)$$,
  'an administrator opens a branch-wide exam'
);

select set_config('request.jwt.claim.sub', '5c120000-0000-0000-0000-00000005c120', true);
select throws_ok(
  $$insert into public.exams (organization_id, branch_id, name, exam_date)
    values ('5c210000-0000-0000-0000-00000005c210', '5c310000-0000-0000-0000-00000005c310',
            'Öğretmenin şube denemesi', current_date)$$,
  '42501', null,
  'a teacher cannot open a branch-wide or institution-wide exam'
);
select lives_ok(
  $$insert into public.exams (organization_id, class_id, name, exam_date)
    values ('5c210000-0000-0000-0000-00000005c210', '5c610000-0000-0000-0000-00000005c610',
            '12-A Yazılı', current_date)$$,
  'a teacher still opens an exam for a class they teach'
);

select * from finish();
rollback;
