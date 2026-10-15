-- v1.5-18 · 3/3 (#314) — Kurum geneli toplamaların yetki sınırları.
--
-- `report_exam_averages` ve `payment_overview_counts` bu dilimde
-- `security definer` oldu, yani **RLS artık onları koruMUyor**. Koruma elle
-- yazıldı ve bu dosya o yazının kanıtı.
--
-- İki fonksiyonun kesişimi FARKLI ve testler bunu ayırıyor:
--
--   rapor : exams KURUM kapsamlı (her rol) · exam_results ÖĞRENCİ kapsamlı
--           → ortalama ÇAĞIRANA GÖRE DEĞİŞİR; öğretmen kendi öğrencilerinin,
--             yönetici hepsinin ortalamasını görür
--   ödeme : yalnız admin VEYA velisi (`current_user_can_see_payment_plan`)
--           → öğretmen ve öğrenci HİÇ SATIR almaz, "0" da almaz (K-22)
--
-- Kurgu: bir kurum, iki sınıf, iki öğretmen, iki öğrenci, bir veli,
-- bir komşu kurum yöneticisi. İki sınav: biri her iki sınıfın öğrencisinden
-- sonuç taşıyor, biri yalnız C sınıfından.

begin;

create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
values
  ('a1100000-0000-0000-0000-00000000a110', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rap-yonetici@example.test', '', now(), now()),
  ('a1200000-0000-0000-0000-00000000a120', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rap-ogretmen-c@example.test', '', now(), now()),
  ('a1300000-0000-0000-0000-00000000a130', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rap-ogrenci-1@example.test', '', now(), now()),
  ('a1400000-0000-0000-0000-00000000a140', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rap-veli@example.test', '', now(), now()),
  ('a1500000-0000-0000-0000-00000000a150', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rap-komsu-yonetici@example.test', '', now(), now());

insert into public.organizations (id, name, slug, code)
values
  ('a2100000-0000-0000-0000-00000000a210', 'Rapor Dershanesi', 'rapor-dershanesi', 7701),
  ('a2200000-0000-0000-0000-00000000a220', 'Rapor Komşusu', 'rapor-komsusu', 7702);

insert into public.organization_memberships (id, organization_id, user_id, role, status)
values
  ('a3100000-0000-0000-0000-00000000a310', 'a2100000-0000-0000-0000-00000000a210',
   'a1100000-0000-0000-0000-00000000a110', 'admin', 'active'),
  ('a3200000-0000-0000-0000-00000000a320', 'a2100000-0000-0000-0000-00000000a210',
   'a1200000-0000-0000-0000-00000000a120', 'teacher', 'active'),
  ('a3300000-0000-0000-0000-00000000a330', 'a2100000-0000-0000-0000-00000000a210',
   'a1300000-0000-0000-0000-00000000a130', 'student', 'active'),
  ('a3400000-0000-0000-0000-00000000a340', 'a2100000-0000-0000-0000-00000000a210',
   'a1400000-0000-0000-0000-00000000a140', 'parent', 'active'),
  ('a3500000-0000-0000-0000-00000000a350', 'a2200000-0000-0000-0000-00000000a220',
   'a1500000-0000-0000-0000-00000000a150', 'admin', 'active');

insert into public.subjects (id, organization_id, name)
values ('a4000000-0000-0000-0000-00000000a400', 'a2100000-0000-0000-0000-00000000a210', 'Matematik');

insert into public.classes (id, organization_id, name)
values
  ('a5100000-0000-0000-0000-00000000a510', 'a2100000-0000-0000-0000-00000000a210', 'Rapor C'),
  ('a5200000-0000-0000-0000-00000000a520', 'a2100000-0000-0000-0000-00000000a210', 'Rapor D');

-- Öğretmen yalnız C sınıfını okutuyor
insert into public.class_teachers (id, organization_id, class_id, membership_id, subject_id)
values
  ('a6000000-0000-0000-0000-00000000a600', 'a2100000-0000-0000-0000-00000000a210',
   'a5100000-0000-0000-0000-00000000a510', 'a3200000-0000-0000-0000-00000000a320',
   'a4000000-0000-0000-0000-00000000a400');

insert into public.students (id, organization_id, auth_user_id, full_name, student_number)
values
  ('a7100000-0000-0000-0000-00000000a710', 'a2100000-0000-0000-0000-00000000a210',
   'a1300000-0000-0000-0000-00000000a130', 'Rapor Bir', '3001'),
  ('a7200000-0000-0000-0000-00000000a720', 'a2100000-0000-0000-0000-00000000a210',
   null, 'Rapor İki', '3002');

insert into public.guardians (id, organization_id, auth_user_id, full_name)
values
  ('a8000000-0000-0000-0000-00000000a800', 'a2100000-0000-0000-0000-00000000a210',
   'a1400000-0000-0000-0000-00000000a140', 'Rapor Velisi');

insert into public.student_guardians (id, organization_id, student_id, guardian_id)
values
  ('a8100000-0000-0000-0000-00000000a810', 'a2100000-0000-0000-0000-00000000a210',
   'a7100000-0000-0000-0000-00000000a710', 'a8000000-0000-0000-0000-00000000a800');

-- Öğrenci 1 → C sınıfı (öğretmenin sınıfı) · Öğrenci 2 → D sınıfı
insert into public.class_enrollments (id, organization_id, class_id, student_id)
values
  ('a9100000-0000-0000-0000-00000000a910', 'a2100000-0000-0000-0000-00000000a210',
   'a5100000-0000-0000-0000-00000000a510', 'a7100000-0000-0000-0000-00000000a710'),
  ('a9200000-0000-0000-0000-00000000a920', 'a2100000-0000-0000-0000-00000000a210',
   'a5200000-0000-0000-0000-00000000a520', 'a7200000-0000-0000-0000-00000000a720');

-- Sınavlar: ikisi de kurum geneli (class_id null olamaz mı? olabilir ama
-- sonuç tetikleyicisi öğrencinin sınıfa kayıtlı olmasını istiyor, o yüzden
-- her sınav kendi sınıfına bağlanıyor).
insert into public.exams (id, organization_id, class_id, subject_id, name, exam_date, max_score)
values
  ('b1100000-0000-0000-0000-00000000b110', 'a2100000-0000-0000-0000-00000000a210',
   'a5100000-0000-0000-0000-00000000a510', 'a4000000-0000-0000-0000-00000000a400',
   'Rapor Deneme C', '2026-03-10', 100),
  ('b1200000-0000-0000-0000-00000000b120', 'a2100000-0000-0000-0000-00000000a210',
   'a5200000-0000-0000-0000-00000000a520', 'a4000000-0000-0000-0000-00000000a400',
   'Rapor Deneme D', '2026-03-20', 100),
  -- ARŞİVLİ ve en geç: hiçbir çağıranın dört sınavına girmemeli
  ('b1300000-0000-0000-0000-00000000b130', 'a2100000-0000-0000-0000-00000000a210',
   'a5100000-0000-0000-0000-00000000a510', 'a4000000-0000-0000-0000-00000000a400',
   'Rapor Deneme Arşivli', '2026-03-30', 100);

insert into public.exam_results (id, organization_id, exam_id, student_id, score)
values
  ('b2100000-0000-0000-0000-00000000b210', 'a2100000-0000-0000-0000-00000000a210',
   'b1100000-0000-0000-0000-00000000b110', 'a7100000-0000-0000-0000-00000000a710', 60),
  ('b2200000-0000-0000-0000-00000000b220', 'a2100000-0000-0000-0000-00000000a210',
   'b1200000-0000-0000-0000-00000000b120', 'a7200000-0000-0000-0000-00000000a720', 90),
  ('b2300000-0000-0000-0000-00000000b230', 'a2100000-0000-0000-0000-00000000a210',
   'b1300000-0000-0000-0000-00000000b130', 'a7100000-0000-0000-0000-00000000a710', 99);

update public.exams set archived_at = now()
 where id = 'b1300000-0000-0000-0000-00000000b130';

-- Ödeme: öğrenci 1'in planı (velisi görebilir), öğrenci 2'nin planı
insert into public.payment_plans (id, organization_id, student_id, name, total_amount)
values
  ('b3100000-0000-0000-0000-00000000b310', 'a2100000-0000-0000-0000-00000000a210',
   'a7100000-0000-0000-0000-00000000a710', 'Plan Bir', 1000),
  ('b3200000-0000-0000-0000-00000000b320', 'a2100000-0000-0000-0000-00000000a210',
   'a7200000-0000-0000-0000-00000000a720', 'Plan İki', 2000);

insert into public.installments (id, organization_id, plan_id, sequence_no, due_date, amount, paid_at)
values
  -- Öğrenci 1: biri vadesi geçmiş ödenmemiş, biri bu ay ödenmiş
  ('b4100000-0000-0000-0000-00000000b410', 'a2100000-0000-0000-0000-00000000a210',
   'b3100000-0000-0000-0000-00000000b310', 1, public.orbit_today() - 30, 500, null),
  ('b4200000-0000-0000-0000-00000000b420', 'a2100000-0000-0000-0000-00000000a210',
   'b3100000-0000-0000-0000-00000000b310', 2, public.orbit_today() - 1, 500,
   date_trunc('month', public.orbit_today())::timestamptz + interval '10 hours'),
  -- Öğrenci 2: biri yaklaşan
  ('b4300000-0000-0000-0000-00000000b430', 'a2100000-0000-0000-0000-00000000a210',
   'b3200000-0000-0000-0000-00000000b320', 1, public.orbit_today() + 3, 700, null);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

-- ===========================================================================
-- RAPOR — ortalama çağırana göre değişir
-- ===========================================================================

select set_config('request.jwt.claim.sub', 'a1100000-0000-0000-0000-00000000a110', true);

-- 1 · Yönetici iki sınavı da görür; arşivli olan (en geç tarihli) YOK.
select is(
  (select string_agg(exam_name || '=' || average_percent, ' | ' order by exam_date)
   from public.report_exam_averages()),
  'Rapor Deneme C=60.0 | Rapor Deneme D=90.0',
  'the admin averages both classes and the archived exam is excluded even though it is the newest'
);

-- 2 · Sonuç sayısı da doğru.
select is(
  (select sum(result_count)::bigint from public.report_exam_averages()),
  2::bigint,
  'the admin counts both results'
);

select set_config('request.jwt.claim.sub', 'a1200000-0000-0000-0000-00000000a120', true);

-- 3 · 🔴 Kesişimin kendisi. Öğretmen yalnız C sınıfını okutuyor, yani yalnız
--     öğrenci 1'in sonucunu görüyor. `exams` kurum kapsamlı olduğu için D
--     sınavını GÖREBİLİR ama o sınavda görünür sonucu yok → listeye girmez.
select is(
  (select string_agg(exam_name || '=' || average_percent, ' | ' order by exam_date)
   from public.report_exam_averages()),
  'Rapor Deneme C=60.0',
  'the teacher averages only their own students — the D exam has no visible result for them'
);

select set_config('request.jwt.claim.sub', 'a1300000-0000-0000-0000-00000000a130', true);

-- 4 · Öğrenci yalnız kendi sonucunu görür.
select is(
  (select string_agg(exam_name || '=' || average_percent, ' | ' order by exam_date)
   from public.report_exam_averages()),
  'Rapor Deneme C=60.0',
  'a student averages only their own result'
);

select set_config('request.jwt.claim.sub', 'a1400000-0000-0000-0000-00000000a140', true);

-- 5 · Veli bağlı olduğu öğrencinin sonucunu görür.
select is(
  (select string_agg(exam_name || '=' || average_percent, ' | ' order by exam_date)
   from public.report_exam_averages()),
  'Rapor Deneme C=60.0',
  'a guardian averages only their own child result'
);

select set_config('request.jwt.claim.sub', 'a1500000-0000-0000-0000-00000000a150', true);

-- 6 · ⛔ Komşu kurumun yöneticisi hiçbir şey görmez. `definer` RLS'i atlıyor,
--     kiracı duvarı `uye_kurum` ile elle yazıldı.
select is(
  (select count(*) from public.report_exam_averages()),
  0::bigint,
  'an admin of a different institution gets no exam average — the tenant wall is written by hand here'
);

-- ===========================================================================
-- ÖDEME — yalnız admin ve veli, 20260908050000 kararı korunuyor
-- ===========================================================================

select set_config('request.jwt.claim.sub', 'a1100000-0000-0000-0000-00000000a110', true);

-- 7 · Yönetici: bu ay 500 tahsil, 1 yaklaşan (öğrenci 2), 1 vadesi geçmiş.
select is(
  (select collected_this_month || '|' || upcoming_count || '|' || overdue_count
   from public.payment_overview_counts()),
  '500.00|1|1',
  'the admin sees this month collection, the upcoming window and the overdue count'
);

select set_config('request.jwt.claim.sub', 'a1400000-0000-0000-0000-00000000a140', true);

-- 8 · 🔴 Veli YALNIZ kendi çocuğunun taksitlerini sayar: öğrenci 2'nin
--     yaklaşan taksiti onun sayısına girmez.
select is(
  (select collected_this_month || '|' || upcoming_count || '|' || overdue_count
   from public.payment_overview_counts()),
  '500.00|0|1',
  'a guardian counts only their own child installments — the other student upcoming one is invisible'
);

select set_config('request.jwt.claim.sub', 'a1200000-0000-0000-0000-00000000a120', true);

-- 9 · ⛔ Öğretmen HİÇ SATIR almaz — "0 tahsil edildi" bile almaz (K-22).
--     20260908050000: "ödeme, kurum ile aile arasındadır."
select is(
  (select count(*) from public.payment_overview_counts()),
  0::bigint,
  'a teacher gets no row at all, not even zeros — payment stays between the institution and the family'
);

select set_config('request.jwt.claim.sub', 'a1300000-0000-0000-0000-00000000a130', true);

-- 10 · ⛔ Öğrencinin kendisi de almaz.
select is(
  (select count(*) from public.payment_overview_counts()),
  0::bigint,
  'the student themself gets no payment row either'
);

select set_config('request.jwt.claim.sub', 'a1500000-0000-0000-0000-00000000a150', true);

-- 11 · ⛔ Komşu kurumun yöneticisi de almaz.
select is(
  (select count(*) from public.payment_overview_counts()),
  0::bigint,
  'an admin of a different institution gets no payment row'
);

-- ===========================================================================
-- Arşivli plan sayıya girmiyor (eski gövdenin `archived_at` süzgeci korundu)
-- ===========================================================================

reset role;
update public.payment_plans set archived_at = now()
 where id = 'b3200000-0000-0000-0000-00000000b320';

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a1100000-0000-0000-0000-00000000a110', true);

-- 12 · Öğrenci 2'nin planı arşivlendi: yaklaşan sayısı 1 → 0 olmalı.
select is(
  (select collected_this_month || '|' || upcoming_count || '|' || overdue_count
   from public.payment_overview_counts()),
  '500.00|0|1',
  'an archived plan drops out of the counts'
);

-- ===========================================================================
-- Yapı: `as materialized` davranışla görünmüyor
-- ===========================================================================

reset role;

-- 13 · 🔴 Kaçış kalıbını kullanan dört fonksiyonun hepsi CTE'lerini açıkça
--      materyalize ediyor mu.
--
--      Neden davranışsal bir iddia yetmiyor: `as materialized` sonucu
--      değiştirmiyor, yalnız planı değiştiriyor. Kaldırıldığında planlayıcı
--      yetki süzgecini kümeleme sınırının altına itiyor ve "girdi başına bir
--      kez" sessizce satır başına dönüyor. Bu bir kez yaşandı ve ölçüldü:
--      öğretmen yolu 4,2 s'den 11,9 s'ye çıkıp PostgREST'in 8 saniyelik
--      sınırını aşarak HTTP 500 döndürdü (ROADMAP §4.17).
--
--      ⚠️ Bu iddia `v1.5-18` 1/3'te (#310) açılan bir boşluğu da kapatıyor:
--      o dilim `as materialized`'a dayanıyordu ama kapısını koymamıştı.
--      ⚠️ İddia VARLIĞI değil ADEDİNİ sayıyor, ve bu bilinçli. İlk yazımda
--      `prosrc like '%as materialized%'` yazmıştım; mutasyonla sınandığında
--      **yeşil kaldı**, çünkü dört CTE'den birini sade `as (…)` yapmak
--      diğerlerini yerinde bırakıyor ve LIKE hâlâ eşleşiyor. Varlığı sınayan
--      bir kapı, tek tek bozulmayı görmüyor.
--
--      Beklenen adet: yoklama 2 · sınav puanı 2 · rapor 4 · ödeme 2 = 10.
--      **Sonradan düzeltme (2026-10-14, göç 20261104000000):** yoklama 3 —
--      yetki dizileri (`yetki`), velinin sınıfları (`veli_siniflari`) ve
--      (öğrenci, sınıf) toplamları (`toplam`). Toplam 11.
--      Yeni bir CTE eklendiğinde bu iddia kırılır — istenen de o: ekleyen kişi
--      onu materyalize etmesi gerekip gerekmediğini düşünmek zorunda kalsın.
select is(
  (select sum(
     (length(prosrc) - length(replace(prosrc, 'as materialized', '')))
       / length('as materialized')
   )::bigint
   from pg_proc
   where pronamespace = 'public'::regnamespace
     and proname in (
       'student_attendance_counts',
       'student_latest_exam_scores',
       'report_exam_averages',
       'payment_overview_counts'
     )),
  11::bigint,
  'every CTE in the authorize-once pattern is still materialised — counted, not merely present, because presence stayed green under mutation'
);

select * from finish();
rollback;
