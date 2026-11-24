-- Takip sekmesi (2026-11-24): `tracking_student_metrics`.
--
-- Kurum: A (şubesiz), B (Ş1 şubesi), C (Ş2 şubesi).
--
--   Bir   A · devam: geldi, geç, gelmedi, izinli, gelmedi, gelmedi
--           → 5 ders (1/1/3), izinli 1, seri 3 (izinli zinciri kırmaz)
--         net: E1 30, E2 38, E3'e girmedi → son 38, önceki 30, son-3 34
--         ders: Mat (20 + 23) / 2 = 21,5 · sınıf ort. 20,72
--         ödev 1/2
--   İki   A · altı dersin hepsine geldi (seri 0); net 50, 50, 52 (ort. 50,67)
--   Beş   A · yalnız E2: 20 → E2'de A ortalaması (38 + 50 + 20) / 3 = 36
--   Üç    B · tek başına
--   Dört  C · tek başına
--
-- Yetki: tam yönetici beşini; B'yi okutan öğretmen yalnız Üç'ü; Ş1 şube
-- yöneticisi A (şubesiz) ve B'yi, C'yi değil; öğrenci, komşu kurum ve
-- şifresi kilitli yönetici hiçbirini.

begin;

create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
values
  ('b0110000-0000-0000-0000-0000000b0110', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'tk-yonetici@example.test', '', now(), now()),
  ('b0120000-0000-0000-0000-0000000b0120', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'tk-ogretmen@example.test', '', now(), now()),
  ('b0130000-0000-0000-0000-0000000b0130', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'tk-ogrenci@example.test', '', now(), now()),
  ('b0140000-0000-0000-0000-0000000b0140', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'tk-komsu@example.test', '', now(), now()),
  ('b0150000-0000-0000-0000-0000000b0150', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'tk-sube@example.test', '', now(), now());

insert into public.organizations (id, name, slug, code)
values
  ('b0210000-0000-0000-0000-0000000b0210', 'Takip Dershanesi', 'takip-dershanesi', 7995),
  ('b0220000-0000-0000-0000-0000000b0220', 'Takip Komşusu', 'takip-komsusu', 7996);

insert into public.branches (id, organization_id, name, is_default)
values
  ('b0230000-0000-0000-0000-0000000b0230', 'b0210000-0000-0000-0000-0000000b0210', 'Takip Ş1', true),
  ('b0240000-0000-0000-0000-0000000b0240', 'b0210000-0000-0000-0000-0000000b0210', 'Takip Ş2', false);

insert into public.organization_memberships (id, organization_id, branch_id, user_id, role, status)
values
  ('b0310000-0000-0000-0000-0000000b0310', 'b0210000-0000-0000-0000-0000000b0210', null,
   'b0110000-0000-0000-0000-0000000b0110', 'admin', 'active'),
  ('b0320000-0000-0000-0000-0000000b0320', 'b0210000-0000-0000-0000-0000000b0210', null,
   'b0120000-0000-0000-0000-0000000b0120', 'teacher', 'active'),
  ('b0330000-0000-0000-0000-0000000b0330', 'b0210000-0000-0000-0000-0000000b0210', null,
   'b0130000-0000-0000-0000-0000000b0130', 'student', 'active'),
  ('b0340000-0000-0000-0000-0000000b0340', 'b0220000-0000-0000-0000-0000000b0220', null,
   'b0140000-0000-0000-0000-0000000b0140', 'admin', 'active'),
  ('b0350000-0000-0000-0000-0000000b0350', 'b0210000-0000-0000-0000-0000000b0210',
   'b0230000-0000-0000-0000-0000000b0230',
   'b0150000-0000-0000-0000-0000000b0150', 'admin', 'active');

insert into public.subjects (id, organization_id, name)
values
  ('b0410000-0000-0000-0000-0000000b0410', 'b0210000-0000-0000-0000-0000000b0210', 'Matematik'),
  ('b0420000-0000-0000-0000-0000000b0420', 'b0210000-0000-0000-0000-0000000b0210', 'Türkçe');

insert into public.classes (id, organization_id, branch_id, name)
values
  ('b0510000-0000-0000-0000-0000000b0510', 'b0210000-0000-0000-0000-0000000b0210', null, 'Takip A'),
  ('b0520000-0000-0000-0000-0000000b0520', 'b0210000-0000-0000-0000-0000000b0210',
   'b0230000-0000-0000-0000-0000000b0230', 'Takip B'),
  ('b0530000-0000-0000-0000-0000000b0530', 'b0210000-0000-0000-0000-0000000b0210',
   'b0240000-0000-0000-0000-0000000b0240', 'Takip C');

-- Öğretmen yalnız B'yi okutuyor
insert into public.class_teachers (id, organization_id, class_id, membership_id, subject_id)
values ('b0600000-0000-0000-0000-0000000b0600', 'b0210000-0000-0000-0000-0000000b0210',
        'b0520000-0000-0000-0000-0000000b0520', 'b0320000-0000-0000-0000-0000000b0320',
        'b0410000-0000-0000-0000-0000000b0410');

insert into public.students (id, organization_id, auth_user_id, full_name, student_number)
values
  ('b0710000-0000-0000-0000-0000000b0710', 'b0210000-0000-0000-0000-0000000b0210',
   'b0130000-0000-0000-0000-0000000b0130', 'Takip Bir', '7001'),
  ('b0720000-0000-0000-0000-0000000b0720', 'b0210000-0000-0000-0000-0000000b0210', null, 'Takip İki', '7002'),
  ('b0730000-0000-0000-0000-0000000b0730', 'b0210000-0000-0000-0000-0000000b0210', null, 'Takip Üç', '7003'),
  ('b0740000-0000-0000-0000-0000000b0740', 'b0210000-0000-0000-0000-0000000b0210', null, 'Takip Dört', '7004'),
  ('b0750000-0000-0000-0000-0000000b0750', 'b0210000-0000-0000-0000-0000000b0210', null, 'Takip Beş', '7005');

insert into public.class_enrollments (organization_id, class_id, student_id)
values
  ('b0210000-0000-0000-0000-0000000b0210', 'b0510000-0000-0000-0000-0000000b0510', 'b0710000-0000-0000-0000-0000000b0710'),
  ('b0210000-0000-0000-0000-0000000b0210', 'b0510000-0000-0000-0000-0000000b0510', 'b0720000-0000-0000-0000-0000000b0720'),
  ('b0210000-0000-0000-0000-0000000b0210', 'b0510000-0000-0000-0000-0000000b0510', 'b0750000-0000-0000-0000-0000000b0750'),
  ('b0210000-0000-0000-0000-0000000b0210', 'b0520000-0000-0000-0000-0000000b0520', 'b0730000-0000-0000-0000-0000000b0730'),
  ('b0210000-0000-0000-0000-0000000b0210', 'b0530000-0000-0000-0000-0000000b0530', 'b0740000-0000-0000-0000-0000000b0740');

-- Devam: A'da bu haftanın ilk günü altı ders (09:00..14:00)
insert into public.attendance_sessions (id, organization_id, class_id, session_date, starts_at)
select ('b08' || n || '0000-0000-0000-0000-0000000b0800')::uuid,
       'b0210000-0000-0000-0000-0000000b0210', 'b0510000-0000-0000-0000-0000000b0510',
       date_trunc('week', public.orbit_today())::date, make_time(8 + n, 0, 0)
from generate_series(1, 6) as n;

insert into public.attendance_records (organization_id, session_id, student_id, status)
select 'b0210000-0000-0000-0000-0000000b0210',
       ('b08' || n || '0000-0000-0000-0000-0000000b0800')::uuid, ogr, durum::public.attendance_status
from generate_series(1, 6) as n,
lateral (values
  ('b0710000-0000-0000-0000-0000000b0710'::uuid,
   (array['present', 'late', 'absent', 'excused', 'absent', 'absent'])[n]),
  ('b0720000-0000-0000-0000-0000000b0720'::uuid, 'present')
) as satir(ogr, durum);

-- Ödev: A'ya iki bitirilmiş ödev; Bir yalnız birini teslim etti
insert into public.homework_assignments
  (id, organization_id, class_id, title, assigned_on, due_date, submissions_recorded_at)
select ('b09' || n || '0000-0000-0000-0000-0000000b0900')::uuid,
       'b0210000-0000-0000-0000-0000000b0210', 'b0510000-0000-0000-0000-0000000b0510',
       'Takip ödevi ' || n,
       date_trunc('week', public.orbit_today())::date,
       date_trunc('week', public.orbit_today())::date, now()
from generate_series(1, 2) as n;

select set_config('request.jwt.claim.sub', 'b0110000-0000-0000-0000-0000000b0110', true);
insert into public.homework_submissions (organization_id, homework_id, student_id)
values ('b0210000-0000-0000-0000-0000000b0210', 'b0910000-0000-0000-0000-0000000b0900',
        'b0710000-0000-0000-0000-0000000b0710');

-- Üç net deneme, A'ya açık: iki hafta önce, geçen hafta, bu hafta
insert into public.exams (id, organization_id, class_id, name, exam_date, net_penalty)
values
  ('b1010000-0000-0000-0000-0000000b1010', 'b0210000-0000-0000-0000-0000000b0210',
   'b0510000-0000-0000-0000-0000000b0510', 'Takip E1',
   date_trunc('week', public.orbit_today())::date - 14, 4),
  ('b1020000-0000-0000-0000-0000000b1020', 'b0210000-0000-0000-0000-0000000b0210',
   'b0510000-0000-0000-0000-0000000b0510', 'Takip E2',
   date_trunc('week', public.orbit_today())::date - 7, 4),
  ('b1030000-0000-0000-0000-0000000b1030', 'b0210000-0000-0000-0000-0000000b0210',
   'b0510000-0000-0000-0000-0000000b0510', 'Takip E3',
   date_trunc('week', public.orbit_today())::date, 4);

-- Her denemede iki bölüm: Matematik (m) ve Türkçe (t), 40'ar soru
insert into public.exam_sections (id, organization_id, exam_id, subject_id, name, question_count, position)
select ('b11' || e || k || '000-0000-0000-0000-0000000b1100')::uuid,
       'b0210000-0000-0000-0000-0000000b0210',
       ('b10' || e || '0000-0000-0000-0000-0000000b10' || e || '0')::uuid,
       case k when 1 then 'b0410000-0000-0000-0000-0000000b0410'::uuid
              else 'b0420000-0000-0000-0000-0000000b0420'::uuid end,
       case k when 1 then 'Matematik' else 'Türkçe' end,
       40, k
from generate_series(1, 3) as e, generate_series(1, 2) as k;

-- Bölüm sonuçları (toplam net tetikleyiciyle hesaplanır)
insert into public.exam_section_results
  (organization_id, exam_id, section_id, student_id, correct, wrong)
select 'b0210000-0000-0000-0000-0000000b0210',
       ('b10' || e || '0000-0000-0000-0000-0000000b10' || e || '0')::uuid,
       ('b11' || e || k || '000-0000-0000-0000-0000000b1100')::uuid,
       ogr, dogru, yanlis
from (values
  -- Bir: E1 Mat 20/0, Tür 10/0 (30) · E2 Mat 24/4, Tür 16/4 (38)
  ('b0710000-0000-0000-0000-0000000b0710'::uuid, 1, 1, 20, 0),
  ('b0710000-0000-0000-0000-0000000b0710'::uuid, 1, 2, 10, 0),
  ('b0710000-0000-0000-0000-0000000b0710'::uuid, 2, 1, 24, 4),
  ('b0710000-0000-0000-0000-0000000b0710'::uuid, 2, 2, 16, 4),
  -- İki: 50, 50, 52
  ('b0720000-0000-0000-0000-0000000b0720'::uuid, 1, 1, 30, 0),
  ('b0720000-0000-0000-0000-0000000b0720'::uuid, 1, 2, 20, 0),
  ('b0720000-0000-0000-0000-0000000b0720'::uuid, 2, 1, 30, 0),
  ('b0720000-0000-0000-0000-0000000b0720'::uuid, 2, 2, 20, 0),
  ('b0720000-0000-0000-0000-0000000b0720'::uuid, 3, 1, 32, 0),
  ('b0720000-0000-0000-0000-0000000b0720'::uuid, 3, 2, 20, 0),
  -- Beş: yalnız E2, 20
  ('b0750000-0000-0000-0000-0000000b0750'::uuid, 2, 1, 10, 0),
  ('b0750000-0000-0000-0000-0000000b0750'::uuid, 2, 2, 10, 0)
) as satir(ogr, e, k, dogru, yanlis);

-- Bir E3'e girmedi
insert into public.exam_absences (organization_id, exam_id, student_id)
values ('b0210000-0000-0000-0000-0000000b0210', 'b1030000-0000-0000-0000-0000000b1030',
        'b0710000-0000-0000-0000-0000000b0710');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

create temp table sonuc on commit drop as
select * from public.tracking_student_metrics();

-- 1 · Tam yönetici beş öğrenciyi de görür, bayrak süzgeci yok
select is(
  (select string_agg(student_name, ' | ' order by student_name) from sonuc),
  (select string_agg(ad, ' | ' order by ad)
     from unnest(array['Takip Bir', 'Takip İki', 'Takip Üç', 'Takip Dört', 'Takip Beş']) as ad),
  'a full admin sees every enrolled student, flagged or not'
);

-- 2 · Bir: devam sayıları ve seri
select is(
  (select lesson_count || ' ' || present_count || ' ' || late_count || ' ' || absent_count
          || ' ' || excused_count || ' ' || absence_streak
     from sonuc where student_name = 'Takip Bir'),
  '5 1 1 3 1 3',
  'excused lessons are counted apart and do not break the absence streak'
);

-- 3 · İki: hep geldi
select is(
  (select lesson_count || ' ' || absence_streak from sonuc where student_name = 'Takip İki'),
  '6 0',
  'a student who attended every lesson has no streak'
);

-- 4 · Bir: son, önceki ve son-3 net
select is(
  (select last_net || ' ' || previous_net || ' ' || net_avg3
     from sonuc where student_name = 'Takip Bir'),
  '38.00 30.00 34.00',
  'last, previous and three-exam average come from net trials only'
);

-- 5 · Bir: son denemede sınıf ortalaması; beklenen ve girilmeyen deneme
select is(
  (select class_avg_last || ' ' || exam_expected || ' ' || exam_missed
     from sonuc where student_name = 'Takip Bir'),
  '36.00 3 1',
  'the class average of the last trial and the missed trial are counted'
);

-- 6 · Bir: Matematik neti ve sınıf ortalaması
select is(
  (select d ->> 'avg_net' || ' ' || (d ->> 'class_avg') || ' ' || (d ->> 'exam_count')
     from sonuc, jsonb_array_elements(subject_nets) as d
    where student_name = 'Takip Bir' and d ->> 'subject_name' = 'Matematik'),
  '21.50 20.72 2',
  'a subject net is averaged over trials and compared with the class'
);

-- 7 · İki: üç denemenin ortalaması
select is(
  (select net_avg3::text from sonuc where student_name = 'Takip İki'),
  '50.67',
  'the three-exam average is rounded to two places'
);

-- 8 · Bir: ödev
select is(
  (select homework_expected || '/' || homework_submitted from sonuc where student_name = 'Takip Bir'),
  '2/1',
  'only finished homework is counted'
);

-- 9 · Sınıfla daraltma
select is(
  (select string_agg(student_name, ',') from public.tracking_student_metrics(4, 'b0520000-0000-0000-0000-0000000b0520')),
  'Takip Üç',
  'a class filter narrows the list to that class'
);

-- 10 · Öğretmen yalnız okuttuğu sınıfı görür
select set_config('request.jwt.claim.sub', 'b0120000-0000-0000-0000-0000000b0120', true);
select is(
  (select string_agg(student_name, ',') from public.tracking_student_metrics()),
  'Takip Üç',
  'a teacher sees only the students of classes they teach'
);

-- 11 · ⛔ Kapsam dışı öğrenci: hata değil, boş
select is(
  (select count(*) from public.tracking_student_metrics(4, null, 'b0710000-0000-0000-0000-0000000b0710')),
  0::bigint,
  'asking for a student out of reach returns nothing rather than an error'
);

-- 12 · ⛔ Kapsam dışı sınıf: boş
select is(
  (select count(*) from public.tracking_student_metrics(4, 'b0510000-0000-0000-0000-0000000b0510')),
  0::bigint,
  'asking for a class out of reach returns nothing'
);

-- 13 · Ş1 şube yöneticisi: şubesiz A ve kendi B'si, C değil
select set_config('request.jwt.claim.sub', 'b0150000-0000-0000-0000-0000000b0150', true);
select is(
  (select string_agg(student_name, ' | ' order by student_name) from public.tracking_student_metrics()),
  (select string_agg(ad, ' | ' order by ad)
     from unnest(array['Takip Bir', 'Takip İki', 'Takip Üç', 'Takip Beş']) as ad),
  'a branch admin sees unbranched classes and their own branch, not another branch'
);

-- 14 · ⛔ Öğrenci
select set_config('request.jwt.claim.sub', 'b0130000-0000-0000-0000-0000000b0130', true);
select is(
  (select count(*) from public.tracking_student_metrics()),
  0::bigint,
  'a student sees no tracking rows — not even their own'
);

-- 15 · ⛔ Komşu kurum
select set_config('request.jwt.claim.sub', 'b0140000-0000-0000-0000-0000000b0140', true);
select is(
  (select count(*) from public.tracking_student_metrics()),
  0::bigint,
  'an admin of another institution sees none of these students'
);

-- 16 · Aralık sınırı
select throws_ok(
  'select * from public.tracking_student_metrics(0)',
  '22023',
  'Takip aralığı 1 ile 26 hafta arasında olmalı',
  'a range outside 1..26 weeks is refused'
);

-- 17 · ⛔ Şifre kilidi
reset role;
update public.profiles set must_change_password = true
 where id = 'b0110000-0000-0000-0000-0000000b0110';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b0110000-0000-0000-0000-0000000b0110', true);
select is(
  (select count(*) from public.tracking_student_metrics()),
  0::bigint,
  'an admin who must change their password sees nothing'
);

select * from finish();
rollback;
