-- ============================================================================
-- ÖLÇÜM TOHUMU — bir dershane-yılı sentetik veri
-- ============================================================================
--
-- NEDEN VAR
--   Üretim boş (2 kurum, iş tablolarında 0 satır). Bu yüzden ROADMAP §4.15 ve
--   §4.16'daki sorgu tarafı sayılarının hepsi *yapısal* çıkarımdı: kod ve şema
--   okunarak bulundu, çalışan bir sistem üzerinden değil. §4.16 bunu açıkça
--   kayda geçirdi ve şunu yazdı: tohumlama + EXPLAIN ANALYZE turu `v1.5-08`
--   öncesinde koşmalı, aksi halde verimlilik sırası tahmine göre dizilmiş olur.
--   Bu dosya o turun girdisidir.
--
-- NEREDE KOŞAR
--   YALNIZCA yerel makinede (`supabase start` → postgres:54322). Üretime
--   uygulanmaz; `supabase/config.toml` içindeki `[db.seed].sql_paths` yalnız
--   `./seed.sql`'i listeler ve bu dosya o globa girmez. Yani `supabase db
--   reset` ve CI bu tohumu ASLA yüklemez — pgTAP testleri boş veritabanı
--   sayımlarına dayandığı için bu bilinçli bir ayrımdır.
--
--   🔴 VE BU DOSYA `supabase/tests/` ALTINDA DURAMAZ. İlk yazıldığında
--   `supabase/tests/perf/` altına konmuştu ve `supabase test db` onu bir
--   pgTAP testi sanıp koştu: "No plan found in TAP output" → Result: FAIL.
--   Yani `supabase/tests/` serbest bir test klasörü değil, pg_prove'un glob'u:
--   altındaki HER `.sql` dosyası test olarak koşulur (`.sh` ve `.ts` kardeşleri
--   toplanmadığı için bu görünmüyor). Zorunlu kontrol `Tenant RLS` bu yüzden
--   kırmızıya dönerdi. Dosya bu sebeple `supabase/perf/` altında.
--
-- NASIL KOŞAR
--   docker exec -i supabase_db_orbit_v3 psql -U postgres -v ON_ERROR_STOP=1 \
--     < supabase/perf/seed_olcum.sql
--
-- TASARIM KARARLARI
--   1. Kimlikler `md5(anahtar)::uuid` ile ÜRETİLİR, rastgele değil. Aynı tohum
--      iki kez koşarsa aynı kimlikler çıkar; ölçüm tekrarlanabilir olur ve iki
--      EXPLAIN çıktısı karşılaştırılabilir kalır.
--   2. `session_replication_role = replica` ile denetim tetikleyicileri ve FK
--      doğrulaması kapatılır. Gerekçe: 21 yazılabilir tablonun 18'inde denetim
--      tetikleyicisi var; tohum tetikleyicilerle koşsaydı yüz binlerce denetim
--      satırı üretirdi ve o satırların hiçbiri gerçek kullanıcı davranışını
--      temsil etmezdi. Denetim yükü aşağıda AYRI ve kontrollü olarak konuyor.
--   3. TEK kurum değil, 20 kurum tohumlanıyor. Tek kurumla ölçüm yanıltıcı
--      olurdu: `students` tablosunda yalnız 400 satır varken kurum süzgeci
--      bedava görünür. Gerçek soru "kiracı sınırı ölçekte hâlâ ucuz mu".
--   4. Rol başına ayrı kimlik üretiliyor (admin/öğretmen/öğrenci/veli). RLS
--      maliyeti role göre değişiyor: `students` üzerinde dört ayrı SELECT
--      politikası var ve üçü satır başına fonksiyon çağırıyor.
--
-- ÖLÇÜLEN KURUM: kod 1000, "Ölçüm Dershanesi" — tam bir öğretim yılı.
-- ============================================================================

set session_replication_role = replica;
set client_min_messages = warning;

begin;

-- Tohum iki kez koşabilsin: önce kendi kurumlarını temizler (FK'nın tersi sıra).
delete from public.audit_events             where organization_id in (select id from public.organizations where code between 1000 and 1019);
delete from public.attendance_records       where organization_id in (select id from public.organizations where code between 1000 and 1019);
delete from public.attendance_sessions      where organization_id in (select id from public.organizations where code between 1000 and 1019);
delete from public.exam_results             where organization_id in (select id from public.organizations where code between 1000 and 1019);
delete from public.exams                    where organization_id in (select id from public.organizations where code between 1000 and 1019);
delete from public.homework_submissions     where organization_id in (select id from public.organizations where code between 1000 and 1019);
delete from public.homework_assignments     where organization_id in (select id from public.organizations where code between 1000 and 1019);
delete from public.installments             where organization_id in (select id from public.organizations where code between 1000 and 1019);
delete from public.payment_plans            where organization_id in (select id from public.organizations where code between 1000 and 1019);
delete from public.daily_feed_posts         where organization_id in (select id from public.organizations where code between 1000 and 1019);
delete from public.tasks                    where organization_id in (select id from public.organizations where code between 1000 and 1019);
delete from public.schedule_entries         where organization_id in (select id from public.organizations where code between 1000 and 1019);
delete from public.class_teachers           where organization_id in (select id from public.organizations where code between 1000 and 1019);
delete from public.student_guardians        where organization_id in (select id from public.organizations where code between 1000 and 1019);
delete from public.class_enrollments        where organization_id in (select id from public.organizations where code between 1000 and 1019);
delete from public.students                 where organization_id in (select id from public.organizations where code between 1000 and 1019);
delete from public.guardians                where organization_id in (select id from public.organizations where code between 1000 and 1019);
delete from public.organization_memberships where organization_id in (select id from public.organizations where code between 1000 and 1019);
delete from public.subjects                 where organization_id in (select id from public.organizations where code between 1000 and 1019);
delete from public.classes                  where organization_id in (select id from public.organizations where code between 1000 and 1019);
delete from public.branches                 where organization_id in (select id from public.organizations where code between 1000 and 1019);
delete from public.organizations            where code between 1000 and 1019;
delete from public.profiles where id in (select id from auth.users where email like '%@olcum.invalid');
delete from auth.users where email like '%@olcum.invalid';

-- ---------------------------------------------------------------------------
-- 1. Kurumlar, şubeler, dersler, sınıflar
--    Kurum 0 = tam yıl (20 sınıf) · 1-2 = orta (15) · 3-19 = küçük (5)
-- ---------------------------------------------------------------------------
insert into public.organizations (id, name, slug, code)
select md5('org:' || k)::uuid,
       case k when 0 then 'Ölçüm Dershanesi' else 'Komşu Kurum ' || k end,
       'olcum-' || k,
       1000 + k
from generate_series(0, 19) as g(k);

insert into public.branches (id, organization_id, name, is_default)
select md5('branch:' || k || ':' || b)::uuid,
       md5('org:' || k)::uuid,
       case b when 0 then 'Merkez' else 'Şube ' || b end,
       b = 0
from generate_series(0, 19) as g(k),
     generate_series(0, case when k = 0 then 1 else 0 end) as s(b);

insert into public.subjects (id, organization_id, name)
select md5('subject:' || k || ':' || s)::uuid,
       md5('org:' || k)::uuid,
       (array['Matematik','Türkçe','Fizik','Kimya','Biyoloji','Tarih','Coğrafya','İngilizce'])[s + 1]
from generate_series(0, 19) as g(k), generate_series(0, 7) as sub(s);

insert into public.classes (id, organization_id, branch_id, name, program, capacity)
select md5('class:' || k || ':' || c)::uuid,
       md5('org:' || k)::uuid,
       md5('branch:' || k || ':' || (c % case when k = 0 then 2 else 1 end))::uuid,
       'Sınıf ' || lpad(c::text, 2, '0'),
       case when c % 2 = 0 then 'TYT' else 'AYT' end,
       24
from generate_series(0, 19) as g(k),
     generate_series(0, case when k = 0 then 19 when k <= 2 then 14 else 4 end) as cl(c);

-- ---------------------------------------------------------------------------
-- 2. Kimlikler: auth.users + profiles + üyelikler
--    Tetikleyiciler kapalı olduğu için profil satırı ELLE konuyor. Bu şart:
--    `current_user_must_change_password()` profil bulamazsa `true` döndürüyor,
--    o zaman BÜTÜN politikalar kapanır ve ölçüm 0 satır okuyup yanlış çıkar.
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
select md5('staff:' || k || ':' || p)::uuid,
       '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'staff' || k || '-' || p || '@olcum.invalid', 'x', now(), now(), now()
from generate_series(0, 19) as g(k),
     generate_series(0, case when k = 0 then 32 else 6 end) as s(p);

insert into public.organization_memberships (id, organization_id, branch_id, user_id, role, status, person_code)
select md5('staffmem:' || k || ':' || p)::uuid,
       md5('org:' || k)::uuid, null,
       md5('staff:' || k || ':' || p)::uuid,
       case when p < case when k = 0 then 3 else 1 end then 'admin'::public.app_role
            else 'teacher'::public.app_role end,
       'active'::public.membership_status,
       1000 + p
from generate_series(0, 19) as g(k),
     generate_series(0, case when k = 0 then 32 else 6 end) as s(p);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
select md5('stuser:' || k || ':' || i)::uuid,
       '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'ogr' || k || '-' || i || '@olcum.invalid', 'x', now(), now(), now()
from generate_series(0, 19) as g(k),
     generate_series(0, case when k = 0 then 399 when k <= 2 then 299 else 99 end) as st(i);

insert into public.students (id, organization_id, branch_id, auth_user_id, full_name, student_number)
select md5('student:' || k || ':' || i)::uuid,
       md5('org:' || k)::uuid,
       md5('branch:' || k || ':' || (i % case when k = 0 then 2 else 1 end))::uuid,
       md5('stuser:' || k || ':' || i)::uuid,
       (array['Ahmet','Ayşe','Mehmet','Zeynep','Mustafa','Elif','Ali','Fatma','Hasan','Emine',
              'Hüseyin','Hatice','İbrahim','Merve','Murat','Özlem','Osman','Sema','Yusuf','Büşra'])[(i % 20) + 1]
         || ' ' ||
       (array['Yılmaz','Kaya','Demir','Şahin','Çelik','Yıldız','Yıldırım','Öztürk','Aydın','Özdemir',
              'Arslan','Doğan','Kılıç','Aslan','Çetin','Kara','Koç','Kurt','Özkan','Şimşek'])[((i / 20) % 20) + 1],
       lpad((10000 + i)::text, 5, '0')
from generate_series(0, 19) as g(k),
     generate_series(0, case when k = 0 then 399 when k <= 2 then 299 else 99 end) as st(i);

insert into public.organization_memberships (id, organization_id, branch_id, user_id, role, status)
select md5('stumem:' || k || ':' || i)::uuid,
       md5('org:' || k)::uuid, null,
       md5('stuser:' || k || ':' || i)::uuid,
       'student'::public.app_role, 'active'::public.membership_status
from generate_series(0, 19) as g(k),
     generate_series(0, case when k = 0 then 399 when k <= 2 then 299 else 99 end) as st(i);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
select md5('gauser:' || k || ':' || i)::uuid,
       '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'veli' || k || '-' || i || '@olcum.invalid', 'x', now(), now(), now()
from generate_series(0, 19) as g(k),
     generate_series(0, case when k = 0 then 249 when k <= 2 then 179 else 59 end) as ga(i);

insert into public.guardians (id, organization_id, auth_user_id, full_name, phone)
select md5('guardian:' || k || ':' || i)::uuid,
       md5('org:' || k)::uuid,
       md5('gauser:' || k || ':' || i)::uuid,
       'Veli ' || i || ' ' ||
       (array['Yılmaz','Kaya','Demir','Şahin','Çelik','Yıldız','Yıldırım','Öztürk','Aydın','Özdemir'])[(i % 10) + 1],
       '05' || lpad(((i * 7919) % 100000000)::text, 8, '0')
from generate_series(0, 19) as g(k),
     generate_series(0, case when k = 0 then 249 when k <= 2 then 179 else 59 end) as ga(i);

insert into public.organization_memberships (id, organization_id, branch_id, user_id, role, status)
select md5('gamem:' || k || ':' || i)::uuid,
       md5('org:' || k)::uuid, null,
       md5('gauser:' || k || ':' || i)::uuid,
       'parent'::public.app_role, 'active'::public.membership_status
from generate_series(0, 19) as g(k),
     generate_series(0, case when k = 0 then 249 when k <= 2 then 179 else 59 end) as ga(i);

insert into public.profiles (id, display_name, must_change_password)
select u.id, split_part(u.email, '@', 1), false
from auth.users as u
where u.email like '%@olcum.invalid';

-- ---------------------------------------------------------------------------
-- 3. İlişkiler
-- ---------------------------------------------------------------------------
insert into public.class_enrollments (id, organization_id, class_id, student_id, created_at)
select md5('enroll:' || k || ':' || i || ':0')::uuid,
       md5('org:' || k)::uuid,
       md5('class:' || k || ':' || (i % (case when k = 0 then 20 when k <= 2 then 15 else 5 end)))::uuid,
       md5('student:' || k || ':' || i)::uuid,
       timestamptz '2025-09-01 09:00+03'
from generate_series(0, 19) as g(k),
     generate_series(0, case when k = 0 then 399 when k <= 2 then 299 else 99 end) as st(i);

-- Her 5 öğrenciden biri ikinci bir sınıfa da kayıtlı (etüt/takviye)
insert into public.class_enrollments (id, organization_id, class_id, student_id, created_at)
select md5('enroll:' || k || ':' || i || ':1')::uuid,
       md5('org:' || k)::uuid,
       md5('class:' || k || ':' || ((i + 1) % (case when k = 0 then 20 when k <= 2 then 15 else 5 end)))::uuid,
       md5('student:' || k || ':' || i)::uuid,
       timestamptz '2025-10-01 09:00+03'
from generate_series(0, 19) as g(k),
     generate_series(0, case when k = 0 then 399 when k <= 2 then 299 else 99 end) as st(i)
where i % 5 = 0;

-- Veli bağı: veli i → öğrenci 2i ve 2i+1
insert into public.student_guardians (id, organization_id, student_id, guardian_id)
select md5('sg:' || k || ':' || i || ':' || j)::uuid,
       md5('org:' || k)::uuid,
       md5('student:' || k || ':' || (i * 2 + j))::uuid,
       md5('guardian:' || k || ':' || i)::uuid
from generate_series(0, 19) as g(k),
     generate_series(0, case when k = 0 then 249 when k <= 2 then 179 else 59 end) as ga(i),
     generate_series(0, 1) as p(j)
where i * 2 + j <= (case when k = 0 then 399 when k <= 2 then 299 else 99 end);

-- Öğretmen ataması: her sınıfa 4 branş
insert into public.class_teachers (id, organization_id, class_id, membership_id, subject_id)
select md5('ct:' || k || ':' || c || ':' || s)::uuid,
       md5('org:' || k)::uuid,
       md5('class:' || k || ':' || c)::uuid,
       md5('staffmem:' || k || ':' ||
           (case when k = 0 then 3 + ((c * 4 + s) % 30) else 1 + ((c * 4 + s) % 6) end))::uuid,
       md5('subject:' || k || ':' || s)::uuid
from generate_series(0, 19) as g(k),
     generate_series(0, case when k = 0 then 19 when k <= 2 then 14 else 4 end) as cl(c),
     generate_series(0, 3) as sub(s);

-- Haftalık program: öğretmen çakışması olmayacak biçimde sınıf başına 5 kayıt
insert into public.schedule_entries (id, organization_id, class_id, subject_id, membership_id,
                                     day_of_week, starts_at, ends_at, room)
select md5('sched:' || k || ':' || c || ':' || d)::uuid,
       md5('org:' || k)::uuid,
       md5('class:' || k || ':' || c)::uuid,
       md5('subject:' || k || ':' || (d % 8))::uuid,
       md5('staffmem:' || k || ':' || (case when k = 0 then 3 + (c % 30) else 1 + (c % 6) end))::uuid,
       ((d + c) % 5) + 1,
       (time '08:00' + ((c % 8) || ' hours')::interval)::time,
       (time '08:00' + ((c % 8) || ' hours')::interval + interval '50 minutes')::time,
       'Derslik ' || lpad((c + 1)::text, 2, '0')
from generate_series(0, 19) as g(k),
     generate_series(0, case when k = 0 then 19 when k <= 2 then 14 else 4 end) as cl(c),
     generate_series(0, 4) as day(d);

-- ---------------------------------------------------------------------------
-- 4. Yıl boyu operasyon: yoklama
--    Kurum 0 → her hafta içi günü; 1-2 → üç günde bir; 3-19 → ayda bir.
-- ---------------------------------------------------------------------------
insert into public.attendance_sessions (id, organization_id, class_id, subject_id,
                                        session_date, starts_at, recorded_by_membership_id, created_at)
select md5('sess:' || k || ':' || c || ':' || d.gun)::uuid,
       md5('org:' || k)::uuid,
       md5('class:' || k || ':' || c)::uuid,
       md5('subject:' || k || ':' || (extract(doy from d.gun)::int % 8))::uuid,
       d.gun,
       (time '08:00' + ((c % 8) || ' hours')::interval)::time,
       md5('staffmem:' || k || ':' || (case when k = 0 then 3 + (c % 30) else 1 + (c % 6) end))::uuid,
       d.gun + time '17:00'
from generate_series(0, 19) as g(k),
     generate_series(0, case when k = 0 then 19 when k <= 2 then 14 else 4 end) as cl(c),
     lateral (
       select gun from generate_series(date '2025-09-15', date '2026-06-12', interval '1 day') as s(gun)
       where extract(isodow from gun) <= 5
         and (case when k = 0 then true
                   when k <= 2 then extract(doy from gun)::int % 3 = 0
                   else extract(day from gun)::int = 10 end)
     ) as d;

insert into public.attendance_records (id, organization_id, session_id, student_id, status, created_at)
select md5('att:' || sess.id || ':' || enr.student_id)::uuid,
       sess.organization_id,
       sess.id,
       enr.student_id,
       (case (('x' || substr(md5(sess.id::text || enr.student_id::text), 1, 2))::bit(8)::int % 20)
          when 0 then 'absent' when 1 then 'late' when 2 then 'excused' else 'present' end
       )::public.attendance_status,
       sess.created_at
from public.attendance_sessions as sess
join public.class_enrollments as enr
  on enr.class_id = sess.class_id and enr.organization_id = sess.organization_id
where sess.organization_id in (select id from public.organizations where code between 1000 and 1019);

-- ---------------------------------------------------------------------------
-- 5. Sınavlar
-- ---------------------------------------------------------------------------
insert into public.exams (id, organization_id, class_id, subject_id, name, exam_date, max_score, created_at)
select md5('exam:' || k || ':' || c || ':' || e)::uuid,
       md5('org:' || k)::uuid,
       md5('class:' || k || ':' || c)::uuid,
       md5('subject:' || k || ':' || (e % 8))::uuid,
       'Deneme ' || lpad(c::text, 2, '0') || '-' || lpad(e::text, 2, '0'),
       date '2025-09-28' + (e * 21),
       100,
       (date '2025-09-28' + (e * 21)) + time '18:00'
from generate_series(0, 19) as g(k),
     generate_series(0, case when k = 0 then 19 when k <= 2 then 14 else 4 end) as cl(c),
     generate_series(0, case when k = 0 then 11 when k <= 2 then 7 else 2 end) as ex(e);

insert into public.exam_results (id, organization_id, exam_id, student_id, score, created_at)
select md5('exres:' || ex.id || ':' || enr.student_id)::uuid,
       ex.organization_id, ex.id, enr.student_id,
       30 + (('x' || substr(md5(ex.id::text || enr.student_id::text), 1, 2))::bit(8)::int % 70),
       ex.created_at
from public.exams as ex
join public.class_enrollments as enr
  on enr.class_id = ex.class_id and enr.organization_id = ex.organization_id
where ex.organization_id in (select id from public.organizations where code between 1000 and 1019);

-- ---------------------------------------------------------------------------
-- 6. Ödev — her 5 ödevden 4'ünde teslim işaretlemesi bitmiş
-- ---------------------------------------------------------------------------
insert into public.homework_assignments (id, organization_id, class_id, subject_id, title,
                                         assigned_by_membership_id, assigned_on, due_date,
                                         submissions_recorded_at, created_at)
select md5('hw:' || k || ':' || c || ':' || h)::uuid,
       md5('org:' || k)::uuid,
       md5('class:' || k || ':' || c)::uuid,
       md5('subject:' || k || ':' || (h % 8))::uuid,
       'Ödev ' || lpad(c::text, 2, '0') || '-' || lpad(h::text, 2, '0'),
       md5('staffmem:' || k || ':' || (case when k = 0 then 3 + (c % 30) else 1 + (c % 6) end))::uuid,
       date '2025-09-16' + (h * 4),
       date '2025-09-16' + (h * 4) + 7,
       case when h % 5 = 0 then null
            else (date '2025-09-16' + (h * 4) + 8) + time '20:00' end,
       (date '2025-09-16' + (h * 4)) + time '16:00'
from generate_series(0, 19) as g(k),
     generate_series(0, case when k = 0 then 59 when k <= 2 then 29 else 9 end) as cl2(h),
     generate_series(0, case when k = 0 then 19 when k <= 2 then 14 else 4 end) as cl(c);

insert into public.homework_submissions (id, organization_id, homework_id, student_id,
                                         recorded_by_membership_id, created_at)
select md5('hwsub:' || hw.id || ':' || enr.student_id)::uuid,
       hw.organization_id, hw.id, enr.student_id,
       hw.assigned_by_membership_id,
       hw.submissions_recorded_at
from public.homework_assignments as hw
join public.class_enrollments as enr
  on enr.class_id = hw.class_id and enr.organization_id = hw.organization_id
where hw.organization_id in (select id from public.organizations where code between 1000 and 1019)
  and hw.submissions_recorded_at is not null
  and (('x' || substr(md5(hw.id::text || enr.student_id::text), 1, 2))::bit(8)::int % 4) <> 0;

-- ---------------------------------------------------------------------------
-- 7. Ödeme: öğrenci başına bir plan, 9 taksit; geçmiş taksitlerin %85'i ödenmiş
-- ---------------------------------------------------------------------------
insert into public.payment_plans (id, organization_id, student_id, name, total_amount, created_at)
select md5('plan:' || st.id)::uuid, st.organization_id, st.id,
       '2025-2026 Eğitim Ücreti', 45000, timestamptz '2025-09-05 10:00+03'
from public.students as st
where st.organization_id in (select id from public.organizations where code between 1000 and 1019);

insert into public.installments (id, organization_id, plan_id, sequence_no, due_date, amount, paid_at, created_at)
select md5('inst:' || pl.id || ':' || t)::uuid,
       pl.organization_id, pl.id, t + 1,
       date '2025-09-10' + (t * 30), 5000,
       case when date '2025-09-10' + (t * 30) < date '2026-03-01'
                 and (('x' || substr(md5(pl.id::text || t::text), 1, 2))::bit(8)::int % 20) > 2
            then (date '2025-09-10' + (t * 30)) + time '12:00'
            else null end,
       timestamptz '2025-09-05 10:00+03'
from public.payment_plans as pl,
     generate_series(0, 8) as taksit(t)
where pl.organization_id in (select id from public.organizations where code between 1000 and 1019);

-- ---------------------------------------------------------------------------
-- 8. Akış, görevler
-- ---------------------------------------------------------------------------
insert into public.daily_feed_posts (id, organization_id, class_id, title, body,
                                     author_membership_id, created_at)
select md5('feed:' || k || ':' || f)::uuid,
       md5('org:' || k)::uuid,
       case when f % 3 = 0 then null
            else md5('class:' || k || ':' || (f % (case when k = 0 then 20 when k <= 2 then 15 else 5 end)))::uuid end,
       'Duyuru ' || f,
       'Bu bir ölçüm duyurusudur. ' || repeat('İçerik metni. ', 12),
       md5('staffmem:' || k || ':' || (f % (case when k = 0 then 33 else 7 end)))::uuid,
       timestamptz '2025-09-15 08:00+03' + (f * interval '11 hours')
from generate_series(0, 19) as g(k),
     generate_series(0, case when k = 0 then 599 when k <= 2 then 199 else 39 end) as fd(f);

-- `status` 2026-09-27'den beri tamamlanmayla uyuşmak zorunda
-- (`tasks_status_matches_completion_check`); 2026-10-12'de eklendi.
insert into public.tasks (id, organization_id, owner_membership_id, title, detail, due_on, completed_at, status, created_at)
select md5('task:' || k || ':' || t)::uuid,
       md5('org:' || k)::uuid,
       md5('staffmem:' || k || ':' || (t % (case when k = 0 then 33 else 7 end)))::uuid,
       'Görev ' || t, 'Ölçüm görevi ayrıntısı.',
       date '2025-09-20' + (t % 250),
       case when t % 3 = 0 then timestamptz '2025-11-01 12:00+03' else null end,
       case when t % 3 = 0 then 'done' else 'planned' end,
       timestamptz '2025-09-15 09:00+03' + (t * interval '7 hours')
from generate_series(0, 19) as g(k),
     generate_series(0, case when k = 0 then 199 when k <= 2 then 99 else 19 end) as tk(t);

-- ---------------------------------------------------------------------------
-- 9. Denetim izi
--    Tetikleyiciler kapalı olduğu için yük buradan, kontrollü konuyor.
--    Gerçekçi oran: yıl boyunca yazılan her satır için ~1 denetim olayı.
--    Kurum 0 için 150 bin, diğerleri için ölçekli.
-- ---------------------------------------------------------------------------
insert into public.audit_events (organization_id, branch_id, actor_user_id, action,
                                 entity_type, entity_id, metadata, created_at)
select md5('org:' || k)::uuid,
       null,
       md5('staff:' || k || ':' || (a % (case when k = 0 then 33 else 7 end)))::uuid,
       (array['attendance.record','exam.result.record','student.update','payment.installment.paid',
              'homework.submission.record','feed.post.create','member.invite','class.update'])[(a % 8) + 1],
       (array['attendance_session','exam','student','installment',
              'homework_assignment','daily_feed_post','organization_membership','class'])[(a % 8) + 1],
       md5('student:' || k || ':' || (a % 100))::uuid,
       jsonb_build_object('kaynak', 'olcum_tohumu', 'sira', a),
       timestamptz '2025-09-15 08:00+03' + (a * interval '3 minutes')
from generate_series(0, 19) as g(k),
     generate_series(0, case when k = 0 then 149999 when k <= 2 then 29999 else 4999 end) as au(a);

commit;

reset session_replication_role;

-- ---------------------------------------------------------------------------
-- 10. İstatistikler
--     Bu satır atlanırsa EXPLAIN ANALYZE yanlış plan ölçer: planlayıcı boş
--     tablo varsayımıyla çalışır ve her şeye sıralı tarama der. Tohumun
--     ayrılmaz parçasıdır.
-- ---------------------------------------------------------------------------
analyze;

select 'tohum tamam' as durum;
