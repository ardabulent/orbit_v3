-- Dikkat listesi (2026-09-29): `report_attention_students`.
--
-- A sınıfında altı öğrenci; her biri bir koşulu ya da onun SINIRINI sınıyor:
--
--   Bir   devam 3/5 (%60) ve ödev 1/3 (%33)      → iki bayrak
--   İki   devam 4/5 (%80), ödev 2/3 (%67)        → ⛔ sınırda, listede YOK
--   Üç    4 dersin hepsine gelmedi (ders < 5)     → ⛔ devam bayrağı YOK
--         net 60 → 54 (−6)                       → net düşüşü
--   Dört  net 50 → 30 (−20), sınıf ort. 43,4     → düşüş + ortalama altı
--   Beş   B sınıfında tek başına 5 net           → ⛔ ortalama yok (<3 sonuç),
--         ve A'nın ortalamasına GİRMEZ
--   Altı  yalnız son deneme: 33 (ort. 43,4 → −10,4) → yalnız ortalama altı
--
-- Yetki: yönetici dördünü görür; yalnız B'yi okutan öğretmen hiçbirini
-- (Beş bayraksız); öğrenci, komşu kurum ve şifresi kilitli yönetici 0.

begin;

create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
values
  ('a0110000-0000-0000-0000-0000000a0110', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'dk-yonetici@example.test', '', now(), now()),
  ('a0120000-0000-0000-0000-0000000a0120', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'dk-ogretmen@example.test', '', now(), now()),
  ('a0130000-0000-0000-0000-0000000a0130', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'dk-ogrenci@example.test', '', now(), now()),
  ('a0140000-0000-0000-0000-0000000a0140', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'dk-komsu@example.test', '', now(), now());

insert into public.organizations (id, name, slug, code)
values
  ('a0210000-0000-0000-0000-0000000a0210', 'Dikkat Dershanesi', 'dikkat-dershanesi', 7993),
  ('a0220000-0000-0000-0000-0000000a0220', 'Dikkat Komşusu', 'dikkat-komsusu', 7994);

insert into public.organization_memberships (id, organization_id, user_id, role, status)
values
  ('a0310000-0000-0000-0000-0000000a0310', 'a0210000-0000-0000-0000-0000000a0210',
   'a0110000-0000-0000-0000-0000000a0110', 'admin', 'active'),
  ('a0320000-0000-0000-0000-0000000a0320', 'a0210000-0000-0000-0000-0000000a0210',
   'a0120000-0000-0000-0000-0000000a0120', 'teacher', 'active'),
  ('a0330000-0000-0000-0000-0000000a0330', 'a0210000-0000-0000-0000-0000000a0210',
   'a0130000-0000-0000-0000-0000000a0130', 'student', 'active'),
  ('a0340000-0000-0000-0000-0000000a0340', 'a0220000-0000-0000-0000-0000000a0220',
   'a0140000-0000-0000-0000-0000000a0140', 'admin', 'active');

insert into public.subjects (id, organization_id, name)
values ('a0400000-0000-0000-0000-0000000a0400', 'a0210000-0000-0000-0000-0000000a0210', 'Matematik');

insert into public.classes (id, organization_id, name)
values
  ('a0510000-0000-0000-0000-0000000a0510', 'a0210000-0000-0000-0000-0000000a0210', 'Dikkat A'),
  ('a0520000-0000-0000-0000-0000000a0520', 'a0210000-0000-0000-0000-0000000a0210', 'Dikkat B');

-- Öğretmen yalnız B'yi okutuyor
insert into public.class_teachers (id, organization_id, class_id, membership_id, subject_id)
values ('a0600000-0000-0000-0000-0000000a0600', 'a0210000-0000-0000-0000-0000000a0210',
        'a0520000-0000-0000-0000-0000000a0520', 'a0320000-0000-0000-0000-0000000a0320',
        'a0400000-0000-0000-0000-0000000a0400');

insert into public.students (id, organization_id, auth_user_id, full_name, student_number)
values
  ('a0710000-0000-0000-0000-0000000a0710', 'a0210000-0000-0000-0000-0000000a0210',
   'a0130000-0000-0000-0000-0000000a0130', 'Dikkat Bir', '6001'),
  ('a0720000-0000-0000-0000-0000000a0720', 'a0210000-0000-0000-0000-0000000a0210', null, 'Dikkat İki', '6002'),
  ('a0730000-0000-0000-0000-0000000a0730', 'a0210000-0000-0000-0000-0000000a0210', null, 'Dikkat Üç', '6003'),
  ('a0740000-0000-0000-0000-0000000a0740', 'a0210000-0000-0000-0000-0000000a0210', null, 'Dikkat Dört', '6004'),
  ('a0750000-0000-0000-0000-0000000a0750', 'a0210000-0000-0000-0000-0000000a0210', null, 'Dikkat Beş', '6005'),
  ('a0760000-0000-0000-0000-0000000a0760', 'a0210000-0000-0000-0000-0000000a0210', null, 'Dikkat Altı', '6006');

insert into public.class_enrollments (organization_id, class_id, student_id)
select 'a0210000-0000-0000-0000-0000000a0210', 'a0510000-0000-0000-0000-0000000a0510', s
from unnest(array[
  'a0710000-0000-0000-0000-0000000a0710', 'a0720000-0000-0000-0000-0000000a0720',
  'a0730000-0000-0000-0000-0000000a0730', 'a0740000-0000-0000-0000-0000000a0740',
  'a0760000-0000-0000-0000-0000000a0760'
]::uuid[]) as s;
insert into public.class_enrollments (organization_id, class_id, student_id)
values ('a0210000-0000-0000-0000-0000000a0210', 'a0520000-0000-0000-0000-0000000a0520',
        'a0750000-0000-0000-0000-0000000a0750');

-- Devam: A'da bu hafta beş ders (09:00..13:00)
insert into public.attendance_sessions (id, organization_id, class_id, session_date, starts_at)
select ('a08' || n || '0000-0000-0000-0000-0000000a0800')::uuid,
       'a0210000-0000-0000-0000-0000000a0210', 'a0510000-0000-0000-0000-0000000a0510',
       date_trunc('week', public.orbit_today())::date, make_time(8 + n, 0, 0)
from generate_series(1, 5) as n;

insert into public.attendance_records (organization_id, session_id, student_id, status)
select 'a0210000-0000-0000-0000-0000000a0210',
       ('a08' || n || '0000-0000-0000-0000-0000000a0800')::uuid, ogr, durum::public.attendance_status
from generate_series(1, 5) as n,
lateral (values
  -- Bir: 3 geldi, 2 gelmedi → %60
  ('a0710000-0000-0000-0000-0000000a0710'::uuid,
   case when n <= 3 then 'present' else 'absent' end),
  -- İki: 4 geldi (biri geç), 1 gelmedi → %80
  ('a0720000-0000-0000-0000-0000000a0720'::uuid,
   case when n = 5 then 'absent' when n = 4 then 'late' else 'present' end),
  -- Dört ve Altı: hep geldi
  ('a0740000-0000-0000-0000-0000000a0740'::uuid, 'present'),
  ('a0760000-0000-0000-0000-0000000a0760'::uuid, 'present')
) as satir(ogr, durum);

-- Üç: yalnız ilk dört derste var, hepsinde yok → ders sayısı 4 < 5
insert into public.attendance_records (organization_id, session_id, student_id, status)
select 'a0210000-0000-0000-0000-0000000a0210',
       ('a08' || n || '0000-0000-0000-0000-0000000a0800')::uuid,
       'a0730000-0000-0000-0000-0000000a0730', 'absent'
from generate_series(1, 4) as n;

-- Ödev: A'ya üç bitirilmiş ödev
insert into public.homework_assignments
  (id, organization_id, class_id, title, assigned_on, due_date, submissions_recorded_at)
select ('a09' || n || '0000-0000-0000-0000-0000000a0900')::uuid,
       'a0210000-0000-0000-0000-0000000a0210', 'a0510000-0000-0000-0000-0000000a0510',
       'Dikkat ödevi ' || n,
       date_trunc('week', public.orbit_today())::date,
       date_trunc('week', public.orbit_today())::date, now()
from generate_series(1, 3) as n;

select set_config('request.jwt.claim.sub', 'a0110000-0000-0000-0000-0000000a0110', true);
insert into public.homework_submissions (organization_id, homework_id, student_id)
select 'a0210000-0000-0000-0000-0000000a0210',
       ('a09' || n || '0000-0000-0000-0000-0000000a0900')::uuid, ogr
from (values
  ('a0710000-0000-0000-0000-0000000a0710'::uuid, 1),  -- Bir 1/3
  ('a0720000-0000-0000-0000-0000000a0720'::uuid, 2),  -- İki 2/3
  ('a0730000-0000-0000-0000-0000000a0730'::uuid, 3),
  ('a0740000-0000-0000-0000-0000000a0740'::uuid, 3),
  ('a0760000-0000-0000-0000-0000000a0760'::uuid, 3)
) as kac(ogr, adet),
generate_series(1, 3) as n
where n <= kac.adet;

-- Net denemeler: geçen hafta E1, bu hafta E2
insert into public.exams (id, organization_id, name, exam_date, net_penalty)
values
  ('a1010000-0000-0000-0000-0000000a1010', 'a0210000-0000-0000-0000-0000000a0210',
   'Dikkat E1', date_trunc('week', public.orbit_today())::date - 7, 4),
  ('a1020000-0000-0000-0000-0000000a1020', 'a0210000-0000-0000-0000-0000000a0210',
   'Dikkat E2', date_trunc('week', public.orbit_today())::date, 4);

select set_config('orbit.writing_exam_net', 'on', true);
insert into public.exam_results (organization_id, exam_id, student_id, score)
values
  ('a0210000-0000-0000-0000-0000000a0210', 'a1010000-0000-0000-0000-0000000a1010', 'a0710000-0000-0000-0000-0000000a0710', 50),
  ('a0210000-0000-0000-0000-0000000a0210', 'a1010000-0000-0000-0000-0000000a1010', 'a0720000-0000-0000-0000-0000000a0720', 50),
  ('a0210000-0000-0000-0000-0000000a0210', 'a1010000-0000-0000-0000-0000000a1010', 'a0730000-0000-0000-0000-0000000a0730', 60),
  ('a0210000-0000-0000-0000-0000000a0210', 'a1010000-0000-0000-0000-0000000a1010', 'a0740000-0000-0000-0000-0000000a0740', 50),
  -- E2 · A: 50, 50, 54, 30, 33 → ortalama 43,4 · B: Beş 5
  ('a0210000-0000-0000-0000-0000000a0210', 'a1020000-0000-0000-0000-0000000a1020', 'a0710000-0000-0000-0000-0000000a0710', 50),
  ('a0210000-0000-0000-0000-0000000a0210', 'a1020000-0000-0000-0000-0000000a1020', 'a0720000-0000-0000-0000-0000000a0720', 50),
  ('a0210000-0000-0000-0000-0000000a0210', 'a1020000-0000-0000-0000-0000000a1020', 'a0730000-0000-0000-0000-0000000a0730', 54),
  ('a0210000-0000-0000-0000-0000000a0210', 'a1020000-0000-0000-0000-0000000a1020', 'a0740000-0000-0000-0000-0000000a0740', 30),
  ('a0210000-0000-0000-0000-0000000a0210', 'a1020000-0000-0000-0000-0000000a1020', 'a0760000-0000-0000-0000-0000000a0760', 33),
  ('a0210000-0000-0000-0000-0000000a0210', 'a1020000-0000-0000-0000-0000000a1020', 'a0750000-0000-0000-0000-0000000a0750', 5);
select set_config('orbit.writing_exam_net', 'off', true);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

create temp table sonuc on commit drop as
select * from public.report_attention_students();

-- 1 · Listede tam olarak dört öğrenci
select is(
  (select string_agg(student_name, ' | ' order by student_name) from sonuc),
  (select string_agg(ad, ' | ' order by ad)
     from unnest(array['Dikkat Bir', 'Dikkat Üç', 'Dikkat Dört', 'Dikkat Altı']) as ad),
  'exactly the four students who cross a threshold are listed'
);

-- 2 · Bir: iki bayrak, ham sayılar
select is(
  (select attended_count || '/' || lesson_count || ' ' || homework_submitted || '/'
          || homework_expected || ' ' || low_attendance || ' ' || low_homework
     from sonuc where student_name = 'Dikkat Bir'),
  '3/5 1/3 true true',
  'low attendance and low homework are flagged with their raw counts'
);

-- 3 · İki sınırda: %80 ve %67 listeye girmez
select is(
  (select count(*) from sonuc where student_name = 'Dikkat İki'),
  0::bigint,
  'exactly 80% attendance and 67% homework are not below the thresholds'
);

-- 4 · Üç: dört dersin hepsine gelmedi ama ders sayısı yetmez; yalnız düşüş
select is(
  (select low_attendance || ' ' || net_drop || ' ' || previous_net || '→' || last_net
     from sonuc where student_name = 'Dikkat Üç'),
  'false true 60.00→54.00',
  'fewer than five lessons never raise the attendance flag; a six-net drop does'
);

-- 5 · Dört: düşüş + ortalama altı; ortalama B'deki Beş'i içermez (43,40)
select is(
  (select net_drop || ' ' || below_average || ' ' || class_average
     from sonuc where student_name = 'Dikkat Dört'),
  'true true 43.40',
  'a drop and a below-average result both flag, and the average is the class''s own'
);

-- 6 · Altı: tek deneme, yalnız ortalama altı
select is(
  (select coalesce(previous_net::text, 'yok') || ' ' || net_drop || ' ' || below_average
     from sonuc where student_name = 'Dikkat Altı'),
  'yok false true',
  'a single exam cannot drop, but can be below the class average'
);

-- 7 · Çok bayraklı önce
select is(
  (select (low_attendance::int + low_homework::int + net_drop::int + below_average::int)
     from public.report_attention_students() limit 1),
  2,
  'students with more flags come first'
);

-- 8 · ⛔ Yalnız B'yi okutan öğretmen: Beş bayraksız → boş
select set_config('request.jwt.claim.sub', 'a0120000-0000-0000-0000-0000000a0120', true);
select is(
  (select count(*) from public.report_attention_students()),
  0::bigint,
  'a teacher sees only students of classes they teach — class A is out of reach'
);

-- 9 · ⛔ Öğrenci
select set_config('request.jwt.claim.sub', 'a0130000-0000-0000-0000-0000000a0130', true);
select is(
  (select count(*) from public.report_attention_students()),
  0::bigint,
  'a student sees no attention list — not even their own row'
);

-- 10 · ⛔ Komşu kurum
select set_config('request.jwt.claim.sub', 'a0140000-0000-0000-0000-0000000a0140', true);
select is(
  (select count(*) from public.report_attention_students()),
  0::bigint,
  'an admin of another institution sees none of these students'
);

-- 11 · ⛔ Şifre kilidi
reset role;
update public.profiles set must_change_password = true
 where id = 'a0110000-0000-0000-0000-0000000a0110';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0110000-0000-0000-0000-0000000a0110', true);
select is(
  (select count(*) from public.report_attention_students()),
  0::bigint,
  'an admin who must change their password sees nothing'
);

-- 12 · Aralık dışı
select throws_ok(
  'select * from public.report_attention_students(27)',
  '22023',
  null,
  'a week range above 26 is rejected'
);

select * from finish();
rollback;
