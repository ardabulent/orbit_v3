-- Sınıf karşılaştırması (2026-09-29): `report_class_comparison`.
--
-- Fonksiyon `security definer` — RLS onu korumuyor, kapsam elle yazıldı.
-- Bu yüzden iddiaların yarısı olumsuz:
--
--   1. Yönetici kurumun iki sınıfını da görür.
--   2. Sayılar doğru: A'da devam 1 geldi / 1 gelmedi, ödev 1/2, net 50.
--   3. Ölçülmeyen NULL: B'nin devamı, ödevi ve denemesi boş (sıfır değil).
--   4. Pencere dışı (eski) net deneme ortalamaya girmez.
--   5. Başka sınıfa kayıtlı öğrencinin neti A'nın ortalamasına girmez.
--   6. ⛔ Öğretmen yalnız okuttuğu sınıfı görür.
--   7. ⛔ Öğrenci hiçbir satır görmez.
--   8. ⛔ Komşu kurumun yöneticisi hiçbir satır görmez (kiracı duvarı).
--   9. ⛔ Şifresini değiştirmesi gereken yönetici hiçbir satır görmez.
--  10. ⛔ Aralık dışı istek 22023.

begin;

create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
values
  ('e1100000-0000-0000-0000-00000000e110', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rk-yonetici@example.test', '', now(), now()),
  ('e1200000-0000-0000-0000-00000000e120', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rk-ogretmen@example.test', '', now(), now()),
  ('e1300000-0000-0000-0000-00000000e130', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rk-ogrenci@example.test', '', now(), now()),
  ('e1400000-0000-0000-0000-00000000e140', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rk-komsu@example.test', '', now(), now());

insert into public.organizations (id, name, slug, code)
values
  ('e2100000-0000-0000-0000-00000000e210', 'Kıyas Dershanesi', 'kiyas-dershanesi', 7991),
  ('e2200000-0000-0000-0000-00000000e220', 'Kıyas Komşusu', 'kiyas-komsusu', 7992);

insert into public.organization_memberships (id, organization_id, user_id, role, status)
values
  ('e3100000-0000-0000-0000-00000000e310', 'e2100000-0000-0000-0000-00000000e210',
   'e1100000-0000-0000-0000-00000000e110', 'admin', 'active'),
  ('e3200000-0000-0000-0000-00000000e320', 'e2100000-0000-0000-0000-00000000e210',
   'e1200000-0000-0000-0000-00000000e120', 'teacher', 'active'),
  ('e3300000-0000-0000-0000-00000000e330', 'e2100000-0000-0000-0000-00000000e210',
   'e1300000-0000-0000-0000-00000000e130', 'student', 'active'),
  ('e3400000-0000-0000-0000-00000000e340', 'e2200000-0000-0000-0000-00000000e220',
   'e1400000-0000-0000-0000-00000000e140', 'admin', 'active');

insert into public.subjects (id, organization_id, name)
values ('e4000000-0000-0000-0000-00000000e400', 'e2100000-0000-0000-0000-00000000e210', 'Matematik');

insert into public.classes (id, organization_id, name)
values
  ('e5100000-0000-0000-0000-00000000e510', 'e2100000-0000-0000-0000-00000000e210', 'Kıyas A'),
  ('e5200000-0000-0000-0000-00000000e520', 'e2100000-0000-0000-0000-00000000e210', 'Kıyas B');

insert into public.class_teachers (id, organization_id, class_id, membership_id, subject_id)
values
  ('e6000000-0000-0000-0000-00000000e600', 'e2100000-0000-0000-0000-00000000e210',
   'e5100000-0000-0000-0000-00000000e510', 'e3200000-0000-0000-0000-00000000e320',
   'e4000000-0000-0000-0000-00000000e400');

insert into public.students (id, organization_id, auth_user_id, full_name, student_number)
values
  ('e7100000-0000-0000-0000-00000000e710', 'e2100000-0000-0000-0000-00000000e210',
   'e1300000-0000-0000-0000-00000000e130', 'Kıyas Bir', '5001'),
  ('e7200000-0000-0000-0000-00000000e720', 'e2100000-0000-0000-0000-00000000e210',
   null, 'Kıyas İki', '5002'),
  ('e7300000-0000-0000-0000-00000000e730', 'e2100000-0000-0000-0000-00000000e210',
   null, 'Kıyas Üç', '5003');

-- Bir ve İki → A · Üç → B
insert into public.class_enrollments (id, organization_id, class_id, student_id)
values
  ('e8100000-0000-0000-0000-00000000e810', 'e2100000-0000-0000-0000-00000000e210',
   'e5100000-0000-0000-0000-00000000e510', 'e7100000-0000-0000-0000-00000000e710'),
  ('e8200000-0000-0000-0000-00000000e820', 'e2100000-0000-0000-0000-00000000e210',
   'e5100000-0000-0000-0000-00000000e510', 'e7200000-0000-0000-0000-00000000e720'),
  ('e8300000-0000-0000-0000-00000000e830', 'e2100000-0000-0000-0000-00000000e210',
   'e5200000-0000-0000-0000-00000000e520', 'e7300000-0000-0000-0000-00000000e730');

-- Net denemeler: biri bu hafta, biri pencerenin çok dışında
insert into public.exams (id, organization_id, name, exam_date, net_penalty)
values
  ('f1100000-0000-0000-0000-00000000f110', 'e2100000-0000-0000-0000-00000000e210',
   'Kıyas Net', date_trunc('week', public.orbit_today())::date, 4),
  ('f1200000-0000-0000-0000-00000000f120', 'e2100000-0000-0000-0000-00000000e210',
   'Kıyas Eski', public.orbit_today() - 200, 4);

select set_config('orbit.writing_exam_net', 'on', true);
insert into public.exam_results (organization_id, exam_id, student_id, score)
values
  -- A: 40 ve 60 → 50. Üç (B) 10 alıyor ama B'nin denemesi yok sayılmaz:
  -- Üç'ün sonucu B'ye gider; A'ya girmemeli.
  ('e2100000-0000-0000-0000-00000000e210', 'f1100000-0000-0000-0000-00000000f110',
   'e7100000-0000-0000-0000-00000000e710', 40),
  ('e2100000-0000-0000-0000-00000000e210', 'f1100000-0000-0000-0000-00000000f110',
   'e7200000-0000-0000-0000-00000000e720', 60),
  ('e2100000-0000-0000-0000-00000000e210', 'f1200000-0000-0000-0000-00000000f120',
   'e7100000-0000-0000-0000-00000000e710', 99);
select set_config('orbit.writing_exam_net', 'off', true);

insert into public.attendance_sessions (id, organization_id, class_id, session_date)
values ('f2100000-0000-0000-0000-00000000f210', 'e2100000-0000-0000-0000-00000000e210',
        'e5100000-0000-0000-0000-00000000e510', date_trunc('week', public.orbit_today())::date);

insert into public.attendance_records (organization_id, session_id, student_id, status)
values
  ('e2100000-0000-0000-0000-00000000e210', 'f2100000-0000-0000-0000-00000000f210',
   'e7100000-0000-0000-0000-00000000e710', 'present'),
  ('e2100000-0000-0000-0000-00000000e210', 'f2100000-0000-0000-0000-00000000f210',
   'e7200000-0000-0000-0000-00000000e720', 'absent');

insert into public.homework_assignments
  (id, organization_id, class_id, title, assigned_on, due_date, submissions_recorded_at)
values
  ('f3100000-0000-0000-0000-00000000f310', 'e2100000-0000-0000-0000-00000000e210',
   'e5100000-0000-0000-0000-00000000e510', 'A ödevi',
   date_trunc('week', public.orbit_today())::date,
   date_trunc('week', public.orbit_today())::date, now());

select set_config('request.jwt.claim.sub', 'e1100000-0000-0000-0000-00000000e110', true);
insert into public.homework_submissions (organization_id, homework_id, student_id)
values ('e2100000-0000-0000-0000-00000000e210', 'f3100000-0000-0000-0000-00000000f310',
        'e7100000-0000-0000-0000-00000000e710');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

-- 1 · Yönetici iki sınıfı da görür
select is(
  (select string_agg(class_name || ':' || student_count, ' | ' order by class_name)
     from public.report_class_comparison()),
  'Kıyas A:2 | Kıyas B:1',
  'the admin sees every class of the institution with its enrolled count'
);

-- 2 · A'nın sayıları
select is(
  (select present_count || '/' || late_count || '/' || absent_count
          || ' ' || submission_count || '/' || expected_count
          || ' ' || net_exam_count || ':' || net_average
     from public.report_class_comparison()
    where class_name = 'Kıyas A'),
  '1/0/1 1/2 1:50.00',
  'attendance, homework and net average are counted for the class'
);

-- 3 · Ölçülmeyen boş
select is(
  (select coalesce(present_count::text, 'boş') || ' '
          || coalesce(expected_count::text, 'boş') || ' '
          || coalesce(net_average::text, 'boş')
     from public.report_class_comparison()
    where class_name = 'Kıyas B'),
  'boş boş boş',
  'a class with nothing measured reports NULL, never zero'
);

-- 4 · Eski deneme 26 haftalık pencerede bile yok (200 gün önce)
select is(
  (select net_exam_count from public.report_class_comparison(26)
    where class_name = 'Kıyas A'),
  1::bigint,
  'a net exam outside the window never enters the average'
);

-- 5 · (2'de 50 çıktı; Üç'ün sonucu olsaydı değişirdi) — ayrıca açıkça:
select is(
  (select count(*) from public.report_class_comparison()
    where class_name = 'Kıyas B' and net_average is not null),
  0::bigint,
  'a student''s result belongs to their own class only'
);

-- 6 · Öğretmen yalnız A
select set_config('request.jwt.claim.sub', 'e1200000-0000-0000-0000-00000000e120', true);
select is(
  (select string_agg(class_name, ' | ') from public.report_class_comparison()),
  'Kıyas A',
  'a teacher sees only the class they teach'
);

-- 7 · Öğrenci hiçbir satır
select set_config('request.jwt.claim.sub', 'e1300000-0000-0000-0000-00000000e130', true);
select is(
  (select count(*) from public.report_class_comparison()),
  0::bigint,
  'a student sees no class comparison'
);

-- 8 · Komşu kurum
select set_config('request.jwt.claim.sub', 'e1400000-0000-0000-0000-00000000e140', true);
select is(
  (select count(*) from public.report_class_comparison()),
  0::bigint,
  'an admin of another institution sees none of these classes'
);

-- 9 · Şifre kilidi
reset role;
update public.profiles set must_change_password = true
 where id = 'e1100000-0000-0000-0000-00000000e110';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e1100000-0000-0000-0000-00000000e110', true);
select is(
  (select count(*) from public.report_class_comparison()),
  0::bigint,
  'an admin who must change their password sees nothing — the lock holds inside definer'
);

-- 10 · Aralık dışı
select throws_ok(
  'select * from public.report_class_comparison(0)',
  '22023',
  null,
  'a week range below one is rejected'
);

select * from finish();
rollback;
