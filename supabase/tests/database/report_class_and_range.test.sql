-- Raporlar (2026-09-29): sınıf süzgeci, 4/8/12 aralık, net deneme.
--
-- Sınanan iddialar:
--   1. Net deneme rapora GİRER — ortalama NET olarak, yüzde boş.
--   2. Puanlı sınav yüzdeyle kalır, net sütunu boş.
--   3. Tavanı da cezası da olmayan sınav hâlâ girmez (K-04).
--   4. Sınır tür başına: p_limit = 1 → bir net + bir puanlı.
--   5. Deneme sınıf süzgeci sınıfa KAYITLI öğrencilere daralır.
--   6. Devam sınıf süzgeci diğer sınıfın oturumunu dışarıda bırakır.
--   7. Ödev sınıf süzgeci diğer sınıfın ödevini dışarıda bırakır.
--   8. p_weeks = 8 → tam sekiz satır.
--   9–10. ⛔ Aralık dışı istek 22023 ile reddedilir (sessizce kırpılmaz).
--  11. ⛔ Süzgeç GENİŞLETMEZ: öğretmen okutmadığı sınıfı seçince deneme boş.
--  12. ⛔ Aynı durum devamda: RLS önce, süzgeç sonra.

begin;

create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
values
  ('c1100000-0000-0000-0000-00000000c110', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ra-yonetici@example.test', '', now(), now()),
  ('c1200000-0000-0000-0000-00000000c120', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ra-ogretmen@example.test', '', now(), now());

insert into public.organizations (id, name, slug, code)
values ('c2100000-0000-0000-0000-00000000c210', 'Aralık Dershanesi', 'aralik-dershanesi', 7981);

insert into public.organization_memberships (id, organization_id, user_id, role, status)
values
  ('c3100000-0000-0000-0000-00000000c310', 'c2100000-0000-0000-0000-00000000c210',
   'c1100000-0000-0000-0000-00000000c110', 'admin', 'active'),
  ('c3200000-0000-0000-0000-00000000c320', 'c2100000-0000-0000-0000-00000000c210',
   'c1200000-0000-0000-0000-00000000c120', 'teacher', 'active');

insert into public.subjects (id, organization_id, name)
values ('c4000000-0000-0000-0000-00000000c400', 'c2100000-0000-0000-0000-00000000c210', 'Matematik');

insert into public.classes (id, organization_id, name)
values
  ('c5100000-0000-0000-0000-00000000c510', 'c2100000-0000-0000-0000-00000000c210', 'Aralık A'),
  ('c5200000-0000-0000-0000-00000000c520', 'c2100000-0000-0000-0000-00000000c210', 'Aralık B');

-- Öğretmen yalnız A'yı okutuyor
insert into public.class_teachers (id, organization_id, class_id, membership_id, subject_id)
values
  ('c6000000-0000-0000-0000-00000000c600', 'c2100000-0000-0000-0000-00000000c210',
   'c5100000-0000-0000-0000-00000000c510', 'c3200000-0000-0000-0000-00000000c320',
   'c4000000-0000-0000-0000-00000000c400');

insert into public.students (id, organization_id, full_name, student_number)
values
  ('c7100000-0000-0000-0000-00000000c710', 'c2100000-0000-0000-0000-00000000c210', 'Aralık Bir', '4001'),
  ('c7200000-0000-0000-0000-00000000c720', 'c2100000-0000-0000-0000-00000000c210', 'Aralık İki', '4002'),
  ('c7300000-0000-0000-0000-00000000c730', 'c2100000-0000-0000-0000-00000000c210', 'Aralık Üç', '4003');

-- Bir ve İki → A · Üç → B
insert into public.class_enrollments (id, organization_id, class_id, student_id)
values
  ('c8100000-0000-0000-0000-00000000c810', 'c2100000-0000-0000-0000-00000000c210',
   'c5100000-0000-0000-0000-00000000c510', 'c7100000-0000-0000-0000-00000000c710'),
  ('c8200000-0000-0000-0000-00000000c820', 'c2100000-0000-0000-0000-00000000c210',
   'c5100000-0000-0000-0000-00000000c510', 'c7200000-0000-0000-0000-00000000c720'),
  ('c8300000-0000-0000-0000-00000000c830', 'c2100000-0000-0000-0000-00000000c210',
   'c5200000-0000-0000-0000-00000000c520', 'c7300000-0000-0000-0000-00000000c730');

-- Sınavlar (kurum geneli, class_id boş):
--   Net 1 (eski), Net 2 (yeni) · Puanlı (tavan 50) · Tavansız ve cezasız
insert into public.exams (id, organization_id, name, exam_date, max_score, net_penalty)
values
  ('d1100000-0000-0000-0000-00000000d110', 'c2100000-0000-0000-0000-00000000c210',
   'Aralık Net 1', '2026-04-01', null, 4),
  ('d1200000-0000-0000-0000-00000000d120', 'c2100000-0000-0000-0000-00000000c210',
   'Aralık Net 2', '2026-04-15', null, 4),
  ('d1300000-0000-0000-0000-00000000d130', 'c2100000-0000-0000-0000-00000000c210',
   'Aralık Yazılı', '2026-04-10', 50, null),
  ('d1400000-0000-0000-0000-00000000d140', 'c2100000-0000-0000-0000-00000000c210',
   'Aralık Tavansız', '2026-04-12', null, null);

-- Net sonuçlar normalde ders ders kaydedilir; bu test yalnız toplamı okur.
select set_config('orbit.writing_exam_net', 'on', true);

insert into public.exam_results (organization_id, exam_id, student_id, score)
values
  -- Net 2: Bir 60, İki 70 (A) · Üç 20 (B) → hepsi 50, yalnız A 65
  ('c2100000-0000-0000-0000-00000000c210', 'd1200000-0000-0000-0000-00000000d120',
   'c7100000-0000-0000-0000-00000000c710', 60),
  ('c2100000-0000-0000-0000-00000000c210', 'd1200000-0000-0000-0000-00000000d120',
   'c7200000-0000-0000-0000-00000000c720', 70),
  ('c2100000-0000-0000-0000-00000000c210', 'd1200000-0000-0000-0000-00000000d120',
   'c7300000-0000-0000-0000-00000000c730', 20),
  ('c2100000-0000-0000-0000-00000000c210', 'd1100000-0000-0000-0000-00000000d110',
   'c7100000-0000-0000-0000-00000000c710', 40),
  -- Yazılı: 40/50 = %80
  ('c2100000-0000-0000-0000-00000000c210', 'd1300000-0000-0000-0000-00000000d130',
   'c7100000-0000-0000-0000-00000000c710', 40),
  ('c2100000-0000-0000-0000-00000000c210', 'd1400000-0000-0000-0000-00000000d140',
   'c7100000-0000-0000-0000-00000000c710', 10);

select set_config('orbit.writing_exam_net', 'off', true);

-- Devam: bu hafta A'da bir "geldi", B'de bir "gelmedi"
insert into public.attendance_sessions (id, organization_id, class_id, session_date)
values
  ('d2100000-0000-0000-0000-00000000d210', 'c2100000-0000-0000-0000-00000000c210',
   'c5100000-0000-0000-0000-00000000c510', date_trunc('week', public.orbit_today())::date),
  ('d2200000-0000-0000-0000-00000000d220', 'c2100000-0000-0000-0000-00000000c210',
   'c5200000-0000-0000-0000-00000000c520', date_trunc('week', public.orbit_today())::date);

insert into public.attendance_records (organization_id, session_id, student_id, status)
values
  ('c2100000-0000-0000-0000-00000000c210', 'd2100000-0000-0000-0000-00000000d210',
   'c7100000-0000-0000-0000-00000000c710', 'present'),
  ('c2100000-0000-0000-0000-00000000c210', 'd2200000-0000-0000-0000-00000000d220',
   'c7300000-0000-0000-0000-00000000c730', 'absent');

-- Ödev: bu hafta B sınıfına, bitirilmiş, teslim yok
insert into public.homework_assignments
  (id, organization_id, class_id, title, assigned_on, due_date, submissions_recorded_at)
values
  ('d3100000-0000-0000-0000-00000000d310', 'c2100000-0000-0000-0000-00000000c210',
   'c5200000-0000-0000-0000-00000000c520', 'B ödevi',
   date_trunc('week', public.orbit_today())::date,
   date_trunc('week', public.orbit_today())::date, now());

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'c1100000-0000-0000-0000-00000000c110', true);

-- 1 · Net deneme girer, ortalama net olarak: (60 + 70 + 20) / 3 = 50
select is(
  (select average_net::text || '|' || coalesce(average_percent::text, 'boş') || '|' || is_net
     from public.report_exam_averages()
    where exam_name = 'Aralık Net 2'),
  '50.00|boş|true',
  'a net-scored trial exam enters the report as an average net, never as a percentage'
);

-- 2 · Puanlı sınav yüzdeyle: 40 / 50 = %80
select is(
  (select average_percent::text || '|' || coalesce(average_net::text, 'boş') || '|' || is_net
     from public.report_exam_averages()
    where exam_name = 'Aralık Yazılı'),
  '80.0|boş|false',
  'a scored exam keeps its percentage and carries no net'
);

-- 3 · Tavansız ve cezasız sınav girmez
select is(
  (select count(*) from public.report_exam_averages() where exam_name = 'Aralık Tavansız'),
  0::bigint,
  'an exam with neither a max score nor a net penalty never enters the report'
);

-- 4 · Sınır tür başına
select is(
  (select string_agg(exam_name, ' | ' order by exam_date)
     from public.report_exam_averages(1)),
  'Aralık Yazılı | Aralık Net 2',
  'the limit applies per kind: the latest net exam and the latest scored exam'
);

-- 5 · Sınıf süzgeci: yalnız A'nın öğrencileri → (60 + 70) / 2 = 65
select is(
  (select average_net from public.report_exam_averages(4, 'c5100000-0000-0000-0000-00000000c510')
    where exam_name = 'Aralık Net 2'),
  65.00::numeric,
  'the class filter averages only the students enrolled in that class'
);

-- 6 · Devam sınıf süzgeci: B seçilince yalnız B'nin "gelmedi"si
select is(
  (select present_count || '/' || absent_count
     from public.report_attendance_weeks(4, 'c5200000-0000-0000-0000-00000000c520')
    where week_start = date_trunc('week', public.orbit_today())::date),
  '0/1',
  'the attendance class filter leaves out the other class''s sessions'
);

-- 7 · Ödev sınıf süzgeci: A seçilince B'nin ödevi yok → hafta ölçülmedi
select is(
  (select count(*) from public.report_homework_weeks(4, 'c5100000-0000-0000-0000-00000000c510')
    where expected_count is not null),
  0::bigint,
  'the homework class filter leaves out the other class''s homework'
);

-- 8 · Sekiz hafta, sekiz satır
select is(
  (select count(*) from public.report_attendance_weeks(8)),
  8::bigint,
  'an eight-week range returns exactly eight weeks'
);

-- 9 · Aralık dışı hafta reddedilir
select throws_ok(
  'select * from public.report_homework_weeks(27)',
  '22023',
  null,
  'a week range above 26 is rejected, not silently clipped'
);

-- 10 · Aralık dışı sınav sayısı reddedilir
select throws_ok(
  'select * from public.report_exam_averages(0)',
  '22023',
  null,
  'an exam limit below one is rejected'
);

-- Öğretmen: yalnız A'yı okutuyor
select set_config('request.jwt.claim.sub', 'c1200000-0000-0000-0000-00000000c120', true);

-- 11 · Süzgeç genişletmez: B seçen öğretmen hiç deneme görmez
select is(
  (select count(*) from public.report_exam_averages(4, 'c5200000-0000-0000-0000-00000000c520')),
  0::bigint,
  'a teacher who picks a class they do not teach sees no exam average — the filter only narrows'
);

-- 12 · Aynısı devamda
select is(
  (select count(*) from public.report_attendance_weeks(4, 'c5200000-0000-0000-0000-00000000c520')
    where absent_count is not null),
  0::bigint,
  'a teacher who picks a class they do not teach sees no attendance — RLS still comes first'
);

select * from finish();
rollback;
