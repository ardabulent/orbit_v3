-- v1.5-19 (#317) — Kurum düzeyi ön süzgeç: daraltmadığının kanıtı.
--
-- On tabloya `as restrictive` bir politika eklendi:
--
--     organization_id = any((select public.current_user_scope_org_ids())::uuid[])
--
-- Üst kümenin **üç dalı** var — aktif üyelik, öğrenci kaydı, veli kaydı — ve bu
-- dosyanın asıl işi son ikisinin gerekli olduğunu göstermek.
--
-- 🔴 Yalnız üyelik alınsaydı yetki **DARALIRDI**: `current_user_owns_student_record`
-- ve `current_user_guards_student` üyeliğe değil `auth_user_id`'ye bakıyor.
-- Üyeliği askıya alınmış ama öğrenci kaydı hâlâ bağlı olan biri bugün kendi
-- satırlarını görüyor; üyelik-yalnız bir üst küme onu **sessizce** kapatırdı.
-- 3. ve 4. iddialar tam olarak o vakayı tutuyor.
--
-- ⚠️ Konjonksiyonun kendisi mantıksal olarak gereksizdir (her mevcut ayrık onu
-- ima eder — ispat migration başlığında). Yani kaldırıldığında hiçbir
-- davranışsal iddia kırılmaz, yalnız okuma yavaşlar. Karşılığı son iddia:
-- on politikanın da durduğunu **şemadan** sınıyor. Aynı durum #312'de de
-- yaşandı ve orada da kapı yapısal kurulmuştu.

begin;

create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('e1100000-0000-0000-0000-00000000e110', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'suz-yonetici@example.test', '', now(), now()),
  -- 🔴 Üyeliği ASKIYA ALINMIŞ öğrenci: students.auth_user_id bağlı duruyor
  ('e1200000-0000-0000-0000-00000000e120', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'suz-askidaki-ogrenci@example.test', '', now(), now()),
  -- 🔴 HİÇ üyeliği olmayan veli: yalnız guardians.auth_user_id bağlı
  ('e1300000-0000-0000-0000-00000000e130', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'suz-uyeliksiz-veli@example.test', '', now(), now()),
  ('e1400000-0000-0000-0000-00000000e140', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'suz-komsu-yonetici@example.test', '', now(), now());

insert into public.organizations (id, name, slug, code)
values
  ('e2100000-0000-0000-0000-00000000e210', 'Süzgeç Dershanesi', 'suzgec-dershanesi', 7901),
  ('e2200000-0000-0000-0000-00000000e220', 'Süzgeç Komşusu', 'suzgec-komsusu', 7902);

insert into public.organization_memberships (id, organization_id, user_id, role, status)
values
  ('e3100000-0000-0000-0000-00000000e310', 'e2100000-0000-0000-0000-00000000e210',
   'e1100000-0000-0000-0000-00000000e110', 'admin', 'active'),
  -- Askıya alınmış: aktif üyelik dalı bu kişiyi KAPSAMAZ
  ('e3200000-0000-0000-0000-00000000e320', 'e2100000-0000-0000-0000-00000000e210',
   'e1200000-0000-0000-0000-00000000e120', 'student', 'suspended'),
  ('e3400000-0000-0000-0000-00000000e340', 'e2200000-0000-0000-0000-00000000e220',
   'e1400000-0000-0000-0000-00000000e140', 'admin', 'active');
-- ⚠️ Veli için üyelik satırı YOK. Bilinçli: veli dalının tek dayanağı
--    guardians.auth_user_id olsun.

insert into public.subjects (id, organization_id, name)
values ('e4000000-0000-0000-0000-00000000e400', 'e2100000-0000-0000-0000-00000000e210', 'Matematik');

insert into public.classes (id, organization_id, name)
values ('e5000000-0000-0000-0000-00000000e500', 'e2100000-0000-0000-0000-00000000e210', 'Süzgeç A');

insert into public.students (id, organization_id, auth_user_id, full_name, student_number)
values
  ('e6100000-0000-0000-0000-00000000e610', 'e2100000-0000-0000-0000-00000000e210',
   'e1200000-0000-0000-0000-00000000e120', 'Askıdaki Öğrenci', '5001'),
  ('e6200000-0000-0000-0000-00000000e620', 'e2100000-0000-0000-0000-00000000e210',
   null, 'Velinin Çocuğu', '5002');

insert into public.guardians (id, organization_id, auth_user_id, full_name)
values ('e7000000-0000-0000-0000-00000000e700', 'e2100000-0000-0000-0000-00000000e210',
        'e1300000-0000-0000-0000-00000000e130', 'Üyeliksiz Veli');

insert into public.student_guardians (id, organization_id, student_id, guardian_id)
values ('e7100000-0000-0000-0000-00000000e710', 'e2100000-0000-0000-0000-00000000e210',
        'e6200000-0000-0000-0000-00000000e620', 'e7000000-0000-0000-0000-00000000e700');

insert into public.class_enrollments (id, organization_id, class_id, student_id)
values
  ('e8100000-0000-0000-0000-00000000e810', 'e2100000-0000-0000-0000-00000000e210',
   'e5000000-0000-0000-0000-00000000e500', 'e6100000-0000-0000-0000-00000000e610'),
  ('e8200000-0000-0000-0000-00000000e820', 'e2100000-0000-0000-0000-00000000e210',
   'e5000000-0000-0000-0000-00000000e500', 'e6200000-0000-0000-0000-00000000e620');

insert into public.attendance_sessions (id, organization_id, class_id, subject_id, session_date, starts_at)
values ('e9000000-0000-0000-0000-00000000e900', 'e2100000-0000-0000-0000-00000000e210',
        'e5000000-0000-0000-0000-00000000e500', 'e4000000-0000-0000-0000-00000000e400',
        '2026-03-02', '09:00');

insert into public.attendance_records (id, organization_id, session_id, student_id, status)
values
  ('ea100000-0000-0000-0000-00000000ea10', 'e2100000-0000-0000-0000-00000000e210',
   'e9000000-0000-0000-0000-00000000e900', 'e6100000-0000-0000-0000-00000000e610', 'present'),
  ('ea200000-0000-0000-0000-00000000ea20', 'e2100000-0000-0000-0000-00000000e210',
   'e9000000-0000-0000-0000-00000000e900', 'e6200000-0000-0000-0000-00000000e620', 'absent');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

-- ===========================================================================
-- Yönetici: kendi kurumu görünür, komşu görünmez
-- ===========================================================================

select set_config('request.jwt.claim.sub', 'e1100000-0000-0000-0000-00000000e110', true);

-- 1
select is(
  (select count(*) from public.students
   where organization_id = 'e2100000-0000-0000-0000-00000000e210'),
  2::bigint,
  'the admin still sees every student of their own institution'
);

-- 2
select is(
  (select count(*) from public.attendance_records),
  2::bigint,
  'and every attendance record of their own institution'
);

-- ===========================================================================
-- 🔴 Askıya alınmış üyelik + bağlı öğrenci kaydı — ÖĞRENCİ dalının kanıtı
-- ===========================================================================

select set_config('request.jwt.claim.sub', 'e1200000-0000-0000-0000-00000000e120', true);

-- 3 · Üyelik `suspended`, yani AKTİF ÜYELİK dalı bu kişiyi kapsamıyor. Ama
--     `students.auth_user_id` bağlı ve bugün kendi kaydını görüyor. Üst küme
--     yalnız üyelikten türetilseydi burada 0 dönerdi — sessiz bir daralma.
select is(
  (select count(*) from public.students),
  1::bigint,
  'a suspended member whose student record is still linked sees their own row — the student branch of the superset is what keeps this'
);

-- 4 · Aynı kişi kendi yoklamasını da görüyor.
select is(
  (select count(*) from public.attendance_records),
  1::bigint,
  'and their own attendance record — a membership-only superset would have closed both'
);

-- ===========================================================================
-- 🔴 Hiç üyeliği olmayan veli — VELİ dalının kanıtı
-- ===========================================================================

select set_config('request.jwt.claim.sub', 'e1300000-0000-0000-0000-00000000e130', true);

-- 5 · Bu kişinin `organization_memberships`'te HİÇ satırı yok; yalnız
--     `guardians.auth_user_id` bağlı. Çocuğunu görüyor.
select is(
  (select count(*) from public.students),
  1::bigint,
  'a guardian with no membership row at all still sees their child — the guardian branch of the superset'
);

-- 6 · Çocuğunun yoklamasını da görüyor.
select is(
  (select count(*) from public.attendance_records),
  1::bigint,
  'and their child attendance record'
);

-- 7 · ⛔ Ama velisi olmadığı öğrenciyi görmüyor: ön süzgeç KURUM düzeyinde,
--     satır düzeyindeki yetkiyi gevşetmiyor.
select is(
  (select count(*) from public.students
   where id = 'e6100000-0000-0000-0000-00000000e610'),
  0::bigint,
  'but not the other student — the prefilter narrows to the org, it does not loosen the row-level rule'
);

-- ===========================================================================
-- Komşu kurum: hiçbir şey
-- ===========================================================================

select set_config('request.jwt.claim.sub', 'e1400000-0000-0000-0000-00000000e140', true);

-- 8
select is(
  (select count(*) from public.students
   where organization_id = 'e2100000-0000-0000-0000-00000000e210'),
  0::bigint,
  'an admin of a different institution sees no student'
);

-- 9
select is(
  (select count(*) from public.attendance_records),
  0::bigint,
  'and no attendance record'
);

-- ===========================================================================
-- Yapı: davranışla görünmeyen konjonksiyonun tek kapısı
-- ===========================================================================

reset role;

-- 10 · 🔴 On bir tablonun hepsinde de (2026-10-05'e kadar on) kısıtlayıcı ön süzgeç duruyor mu.
--
--      Neden davranışsal bir iddia yetmiyor: konjonksiyon mantıksal olarak
--      gereksiz (her mevcut ayrık onu ima ediyor — ispat migration
--      başlığında). Kaldırıldığında yukarıdaki dokuz iddianın hiçbiri
--      kırılmaz; yalnız okuma yavaşlar. Ölçülen: komşu kurum yöneticisinin
--      `attendance_records` okuması 252 ms yerine 19.802 ms sürerdi.
select is(
  (select count(*) from pg_policy p
   join pg_class c on c.oid = p.polrelid
   where p.polname = c.relname || '_tenant_prefilter'
     and not p.polpermissive
     and pg_get_expr(p.polqual, p.polrelid) like '%current_user_scope_org_ids%'),
  -- Sonradan düzeltme (2026-10-05): 11. tablo `exam_absences` ("Sınava
  -- girmedi") aynı ön süzgeçle doğdu; sayı bilinçli olarak 10 → 11.
  11::bigint,
  'all eleven restrictive tenant prefilters are still in place — behaviour cannot detect their removal, only the schema can'
);

select * from finish();
rollback;
