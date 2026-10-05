-- "Sınava girmedi" (2026-10-05).
--
-- Netli sınav (TYT, iki ders) ve puanlı sınav (Quiz). S1 iki sınavda da
-- sonuç alır; S2 yalnız netlide.
--
--   1. Öğretmen S1'i netli sınavda "girmedi" işaretler; ders ve net satırları çıkar.
--   2. Kopya iki dersi tam taşır; sebep kaydedilir.
--   3. S1 artık ortalamaya katılmaz (yalnız S2 sayılır).
--   4. ⛔ Aynı öğrenci ikinci kez işaretlenemez.
--   5. ⛔ "Girmedi" öğrenciye sonuç yazılamaz.
--   6. Geri al: ders sonuçları döner, net yeniden hesaplanır (aynı net).
--   7. Puanlı sınavda işaretle + geri al: puan aynen döner.
--   8. ⛔ İşaret yokken geri alma P0002.
--   9. ⛔ Başka sınıfın öğretmeni işaretleyemez (42501).
--  10. ⛔ Öğrenci işaretleyemez (42501).
--  11. Veli kendi çocuğunun "girmedi" kaydını görür.
--  12. Denetim kaydı sebebi YAZMAZ (KVKK), işaretlendiğini yazar.

begin;

create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
values
  ('b9100000-0000-0000-0000-0000000b9100', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'sg-ogretmen@example.test', '', now(), now()),
  ('b9200000-0000-0000-0000-0000000b9200', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'sg-baska@example.test', '', now(), now()),
  ('b9300000-0000-0000-0000-0000000b9300', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'sg-ogrenci@example.test', '', now(), now()),
  ('b9400000-0000-0000-0000-0000000b9400', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'sg-veli@example.test', '', now(), now());

insert into public.organizations (id, name, slug, code)
values ('ba000000-0000-0000-0000-0000000000ba', 'Girmedi Kurumu', 'girmedi-kurumu', 8909);

insert into public.branches (id, organization_id, name, is_default)
values ('bb000000-0000-0000-0000-0000000000bb', 'ba000000-0000-0000-0000-0000000000ba', 'Merkez', true);

insert into public.organization_memberships
  (id, organization_id, branch_id, user_id, role, status, person_code)
values
  ('bc100000-0000-0000-0000-0000000bc100', 'ba000000-0000-0000-0000-0000000000ba',
   'bb000000-0000-0000-0000-0000000000bb', 'b9100000-0000-0000-0000-0000000b9100', 'teacher', 'active', 9301),
  ('bc200000-0000-0000-0000-0000000bc200', 'ba000000-0000-0000-0000-0000000000ba',
   'bb000000-0000-0000-0000-0000000000bb', 'b9200000-0000-0000-0000-0000000b9200', 'teacher', 'active', 9302),
  ('bc300000-0000-0000-0000-0000000bc300', 'ba000000-0000-0000-0000-0000000000ba',
   'bb000000-0000-0000-0000-0000000000bb', 'b9300000-0000-0000-0000-0000000b9300', 'student', 'active', 9303),
  ('bc400000-0000-0000-0000-0000000bc400', 'ba000000-0000-0000-0000-0000000000ba',
   'bb000000-0000-0000-0000-0000000000bb', 'b9400000-0000-0000-0000-0000000b9400', 'parent', 'active', 9304);

insert into public.subjects (id, organization_id, name)
values ('bd000000-0000-0000-0000-0000000000bd', 'ba000000-0000-0000-0000-0000000000ba', 'Matematik');

insert into public.classes (id, organization_id, branch_id, name)
values
  ('be100000-0000-0000-0000-0000000be100', 'ba000000-0000-0000-0000-0000000000ba',
   'bb000000-0000-0000-0000-0000000000bb', '12-A'),
  ('be200000-0000-0000-0000-0000000be200', 'ba000000-0000-0000-0000-0000000000ba',
   'bb000000-0000-0000-0000-0000000000bb', '12-B');

insert into public.class_teachers (organization_id, class_id, membership_id, subject_id)
values
  ('ba000000-0000-0000-0000-0000000000ba', 'be100000-0000-0000-0000-0000000be100',
   'bc100000-0000-0000-0000-0000000bc100', 'bd000000-0000-0000-0000-0000000000bd'),
  ('ba000000-0000-0000-0000-0000000000ba', 'be200000-0000-0000-0000-0000000be200',
   'bc200000-0000-0000-0000-0000000bc200', 'bd000000-0000-0000-0000-0000000000bd');

insert into public.students (id, organization_id, branch_id, auth_user_id, full_name)
values
  ('bf100000-0000-0000-0000-0000000bf100', 'ba000000-0000-0000-0000-0000000000ba',
   'bb000000-0000-0000-0000-0000000000bb', 'b9300000-0000-0000-0000-0000000b9300', 'S1'),
  ('bf200000-0000-0000-0000-0000000bf200', 'ba000000-0000-0000-0000-0000000000ba',
   'bb000000-0000-0000-0000-0000000000bb', null, 'S2');

insert into public.class_enrollments (organization_id, class_id, student_id)
values
  ('ba000000-0000-0000-0000-0000000000ba', 'be100000-0000-0000-0000-0000000be100', 'bf100000-0000-0000-0000-0000000bf100'),
  ('ba000000-0000-0000-0000-0000000000ba', 'be100000-0000-0000-0000-0000000be100', 'bf200000-0000-0000-0000-0000000bf200');

insert into public.guardians (id, organization_id, full_name, auth_user_id)
values ('b8100000-0000-0000-0000-0000000b8100', 'ba000000-0000-0000-0000-0000000000ba',
        'Veli', 'b9400000-0000-0000-0000-0000000b9400');
insert into public.student_guardians (organization_id, student_id, guardian_id)
values ('ba000000-0000-0000-0000-0000000000ba', 'bf100000-0000-0000-0000-0000000bf100',
        'b8100000-0000-0000-0000-0000000b8100');

insert into public.exams (id, organization_id, class_id, name, exam_date, net_penalty, max_score)
values
  ('b7100000-0000-0000-0000-0000000b7100', 'ba000000-0000-0000-0000-0000000000ba',
   'be100000-0000-0000-0000-0000000be100', 'TYT', public.orbit_today(), 4, null),
  ('b7200000-0000-0000-0000-0000000b7200', 'ba000000-0000-0000-0000-0000000000ba',
   'be100000-0000-0000-0000-0000000be100', 'Quiz', public.orbit_today(), null, 100);

insert into public.exam_sections (id, organization_id, exam_id, name, question_count)
values
  ('b6100000-0000-0000-0000-0000000b6100', 'ba000000-0000-0000-0000-0000000000ba',
   'b7100000-0000-0000-0000-0000000b7100', 'Türkçe', 40),
  ('b6200000-0000-0000-0000-0000000b6200', 'ba000000-0000-0000-0000-0000000000ba',
   'b7100000-0000-0000-0000-0000000b7100', 'Matematik', 40);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'b9100000-0000-0000-0000-0000000b9100', true);

select public.record_exam_section_results('b7100000-0000-0000-0000-0000000b7100',
  '[{"section_id": "b6100000-0000-0000-0000-0000000b6100", "student_id": "bf100000-0000-0000-0000-0000000bf100", "correct": 30, "wrong": 8},
    {"section_id": "b6200000-0000-0000-0000-0000000b6200", "student_id": "bf100000-0000-0000-0000-0000000bf100", "correct": 20, "wrong": 4},
    {"section_id": "b6100000-0000-0000-0000-0000000b6100", "student_id": "bf200000-0000-0000-0000-0000000bf200", "correct": 10, "wrong": 0}]'::jsonb);
select public.record_exam_results('b7200000-0000-0000-0000-0000000b7200',
  '[{"student_id": "bf100000-0000-0000-0000-0000000bf100", "score": 72.5}]'::jsonb);

create temp table net_once on commit drop as
select score from public.exam_results
 where exam_id = 'b7100000-0000-0000-0000-0000000b7100'
   and student_id = 'bf100000-0000-0000-0000-0000000bf100';

-- 1 · İşaretle: satırlar çıkar
select public.mark_exam_absent('b7100000-0000-0000-0000-0000000b7100',
  'bf100000-0000-0000-0000-0000000bf100', '  raporlu  ');

select is(
  (select count(*) from public.exam_section_results
    where exam_id = 'b7100000-0000-0000-0000-0000000b7100'
      and student_id = 'bf100000-0000-0000-0000-0000000bf100')
  + (select count(*) from public.exam_results
    where exam_id = 'b7100000-0000-0000-0000-0000000b7100'
      and student_id = 'bf100000-0000-0000-0000-0000000bf100'),
  0::bigint,
  'marking absent takes the student''s section and net rows out of the results'
);

-- 2 · Kopya ve sebep
select is(
  (select jsonb_array_length(saved_result -> 'sections') || ' ' || reason
     from public.exam_absences
    where exam_id = 'b7100000-0000-0000-0000-0000000b7100' and archived_at is null),
  '2 raporlu',
  'the absence keeps a full copy of both sections and the trimmed reason'
);

-- 3 · Ortalamaya katılmaz
select is(
  (select result_count from public.exam_averages(array['b7100000-0000-0000-0000-0000000b7100']::uuid[])
    where section_id is null),
  1::bigint,
  'the absent student is no longer counted in the exam average'
);

-- 4 · İkinci kez işaretlenemez
select throws_ok(
  $$select public.mark_exam_absent('b7100000-0000-0000-0000-0000000b7100', 'bf100000-0000-0000-0000-0000000bf100')$$,
  '22023', null,
  'a student cannot be marked absent twice'
);

-- 5 · "Girmedi" öğrenciye sonuç yazılamaz
select throws_ok(
  $$select public.record_exam_section_results('b7100000-0000-0000-0000-0000000b7100',
      '[{"section_id": "b6100000-0000-0000-0000-0000000b6100", "student_id": "bf100000-0000-0000-0000-0000000bf100", "correct": 1, "wrong": 0}]'::jsonb)$$,
  '22023', null,
  'no result can be written for a student marked absent'
);

-- 6 · Geri al: net aynen
select public.restore_exam_result('b7100000-0000-0000-0000-0000000b7100',
  'bf100000-0000-0000-0000-0000000bf100');

select is(
  (select score from public.exam_results
    where exam_id = 'b7100000-0000-0000-0000-0000000b7100'
      and student_id = 'bf100000-0000-0000-0000-0000000bf100'),
  (select score from net_once),
  'restoring writes the sections back and the net is recomputed to the same value'
);

-- 7 · Puanlı sınav
select public.mark_exam_absent('b7200000-0000-0000-0000-0000000b7200', 'bf100000-0000-0000-0000-0000000bf100');
select public.restore_exam_result('b7200000-0000-0000-0000-0000000b7200', 'bf100000-0000-0000-0000-0000000bf100');

select is(
  (select score from public.exam_results
    where exam_id = 'b7200000-0000-0000-0000-0000000b7200'
      and student_id = 'bf100000-0000-0000-0000-0000000bf100'),
  72.50::numeric,
  'a scored exam gets its score back after undo'
);

-- 8 · İşaret yokken geri alma
select throws_ok(
  $$select public.restore_exam_result('b7200000-0000-0000-0000-0000000b7200', 'bf200000-0000-0000-0000-0000000bf200')$$,
  'P0002', null,
  'there is nothing to restore without an absence'
);

-- 9 · Başka sınıfın öğretmeni
select set_config('request.jwt.claim.sub', 'b9200000-0000-0000-0000-0000000b9200', true);
select throws_ok(
  $$select public.mark_exam_absent('b7100000-0000-0000-0000-0000000b7100', 'bf200000-0000-0000-0000-0000000bf200')$$,
  '42501', null,
  'a teacher of another class cannot mark absence'
);

-- 10 · Öğrenci
select set_config('request.jwt.claim.sub', 'b9300000-0000-0000-0000-0000000b9300', true);
select throws_ok(
  $$select public.mark_exam_absent('b7100000-0000-0000-0000-0000000b7100', 'bf200000-0000-0000-0000-0000000bf200')$$,
  '42501', null,
  'a student cannot mark absence'
);

-- 11 · Veli görür
select set_config('request.jwt.claim.sub', 'b9100000-0000-0000-0000-0000000b9100', true);
select public.mark_exam_absent('b7100000-0000-0000-0000-0000000b7100', 'bf100000-0000-0000-0000-0000000bf100', 'raporlu');
select set_config('request.jwt.claim.sub', 'b9400000-0000-0000-0000-0000000b9400', true);
select is(
  (select count(*) from public.exam_absences where archived_at is null),
  1::bigint,
  'the guardian sees their child''s absence'
);

-- 12 · Denetimde sebep yok
reset role;
select is(
  (select bool_and(not (metadata ? 'reason')) and count(*) >= 2
     from public.audit_events where entity_type = 'exam_absence'
       and organization_id = 'ba000000-0000-0000-0000-0000000000ba'),
  true,
  'the audit trail records the absence but never the reason'
);

select * from finish();
rollback;
