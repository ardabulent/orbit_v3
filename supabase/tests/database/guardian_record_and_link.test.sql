-- v1.4-10 — Veli önce bir kayıttır, sonra bir bağ (#275).
--
-- Dört iddia kümesi:
--
--   1. Velinin telefonu kaydın kendisinde duruyor — giriş hesabı olmadan da.
--   2. Öğrenci KENDİ velisini görüyor; başkasının velisini GÖRMÜYOR ve bu
--      ikincisi en az ilki kadar sınanmalı.
--   3. v1.2-03'ün kararı hâlâ yürürlükte: bir veli aynı öğrencinin DİĞER
--      velisini görmüyor. Bu dilim yeni bir politika ekledi; eskisini
--      bozmadığı ölçülmeli.
--   4. Kayıt ve bağ iz bırakıyor; bağın koparılması kendi eylemi olarak
--      defterde görünüyor.

begin;

create extension if not exists pgtap with schema extensions;
select plan(29);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
values
  ('e1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'veli-yonetici@example.test', '', now(), now()),
  ('e2000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'anne@example.test', '', now(), now()),
  ('e3000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'baba@example.test', '', now(), now()),
  ('e4000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'veli-ogrenci@example.test', '', now(), now()),
  ('e5000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'veli-baska-ogrenci@example.test', '', now(), now());

insert into public.organizations (id, name, slug, code)
values ('ee000000-0000-0000-0000-0000000000ee', 'Kurum V', 'kurum-v-v1410', 7601);

insert into public.branches (id, organization_id, name, is_default)
values ('e1100000-0000-0000-0000-0000000011e1', 'ee000000-0000-0000-0000-0000000000ee', 'V Merkez', true);

insert into public.organization_memberships
  (id, organization_id, branch_id, user_id, role, status, person_code)
values
  ('36000000-0000-0000-0000-000000000001', 'ee000000-0000-0000-0000-0000000000ee', null,
   'e1000000-0000-0000-0000-000000000001', 'admin', 'active', 1200),
  ('36000000-0000-0000-0000-000000000002', 'ee000000-0000-0000-0000-0000000000ee',
   'e1100000-0000-0000-0000-0000000011e1', 'e2000000-0000-0000-0000-000000000002',
   'parent', 'active', 1201),
  ('36000000-0000-0000-0000-000000000003', 'ee000000-0000-0000-0000-0000000000ee',
   'e1100000-0000-0000-0000-0000000011e1', 'e3000000-0000-0000-0000-000000000003',
   'parent', 'active', 1202),
  ('36000000-0000-0000-0000-000000000004', 'ee000000-0000-0000-0000-0000000000ee',
   'e1100000-0000-0000-0000-0000000011e1', 'e4000000-0000-0000-0000-000000000004',
   'student', 'active', 1203),
  ('36000000-0000-0000-0000-000000000005', 'ee000000-0000-0000-0000-0000000000ee',
   'e1100000-0000-0000-0000-0000000011e1', 'e5000000-0000-0000-0000-000000000005',
   'student', 'active', 1204);

-- =========================================================================
-- Velinin telefonu kaydın kendisinde
-- =========================================================================

-- Hesabı OLMAYAN veli: `auth_user_id` boş, telefon dolu. Bu dilimin asıl
-- açtığı durum — velilerin çoğunun giriş hesabı olmayacak.
insert into public.guardians (id, organization_id, full_name, phone)
values ('9a000000-0000-0000-0000-00000000a001',
        'ee000000-0000-0000-0000-0000000000ee', 'Hesapsız Veli', '0532 000 00 00');

select is(
  (select phone from public.guardians
   where id = '9a000000-0000-0000-0000-00000000a001'),
  '0532 000 00 00',
  'a guardian without a login account still carries a phone number'
);

select is(
  (select auth_user_id from public.guardians
   where id = '9a000000-0000-0000-0000-00000000a001'),
  null::uuid,
  'and that guardian has no login account at all'
);

-- Telefon zorunlu değil: elinde numara olmayan bir kurum veliyi yine de
-- kaydedebilmeli. Boş bırakmak, uydurmaktan iyidir (K-03).
insert into public.guardians (id, organization_id, full_name)
values ('9a000000-0000-0000-0000-00000000a002',
        'ee000000-0000-0000-0000-0000000000ee', 'Telefonsuz Veli');

select is(
  (select phone from public.guardians
   where id = '9a000000-0000-0000-0000-00000000a002'),
  null::text,
  'the phone is optional — a guardian can be recorded without one'
);

select throws_ok(
  $sql$insert into public.guardians (organization_id, full_name, phone)
       values ('ee000000-0000-0000-0000-0000000000ee', 'Kısa Numara', '123')$sql$,
  '23514',
  null,
  'a phone shorter than 7 characters is rejected'
);

select throws_ok(
  $sql$insert into public.guardians (organization_id, full_name, phone)
       values ('ee000000-0000-0000-0000-0000000000ee', 'Uzun Numara',
               '0532000000000000000000000000000000')$sql$,
  '23514',
  null,
  'a phone longer than 30 characters is rejected'
);

-- Biçim BİLEREK doğrulanmıyor: ülke kodu ve yurt dışı numarası meşru.
insert into public.guardians (id, organization_id, full_name, phone)
values ('9a000000-0000-0000-0000-00000000a003',
        'ee000000-0000-0000-0000-0000000000ee', 'Yurt Dışı Veli', '+49 170 1234567');

select is(
  (select phone from public.guardians
   where id = '9a000000-0000-0000-0000-00000000a003'),
  '+49 170 1234567',
  'an international number is storable — no format is enforced, deliberately'
);

-- =========================================================================
-- Kurgu: iki veli, iki öğrenci
-- =========================================================================

insert into public.guardians (id, organization_id, auth_user_id, full_name, phone)
values
  ('9b000000-0000-0000-0000-00000000b001', 'ee000000-0000-0000-0000-0000000000ee',
   'e2000000-0000-0000-0000-000000000002', 'Anne Veli', '0532 111 11 11'),
  ('9b000000-0000-0000-0000-00000000b002', 'ee000000-0000-0000-0000-0000000000ee',
   'e3000000-0000-0000-0000-000000000003', 'Baba Veli', '0532 222 22 22');

insert into public.students (id, organization_id, branch_id, auth_user_id, full_name)
values
  ('5e000000-0000-0000-0000-00000000e001', 'ee000000-0000-0000-0000-0000000000ee',
   'e1100000-0000-0000-0000-0000000011e1', 'e4000000-0000-0000-0000-000000000004', 'Bağlı Öğrenci'),
  ('5e000000-0000-0000-0000-00000000e002', 'ee000000-0000-0000-0000-0000000000ee',
   'e1100000-0000-0000-0000-0000000011e1', 'e5000000-0000-0000-0000-000000000005', 'Başka Öğrenci');

-- İki veli de AYNI öğrenciye bağlı; ikinci öğrencinin ayrı bir velisi var.
insert into public.student_guardians (id, organization_id, student_id, guardian_id)
values
  ('7c000000-0000-0000-0000-00000000c001', 'ee000000-0000-0000-0000-0000000000ee',
   '5e000000-0000-0000-0000-00000000e001', '9b000000-0000-0000-0000-00000000b001'),
  ('7c000000-0000-0000-0000-00000000c002', 'ee000000-0000-0000-0000-0000000000ee',
   '5e000000-0000-0000-0000-00000000e001', '9b000000-0000-0000-0000-00000000b002'),
  ('7c000000-0000-0000-0000-00000000c003', 'ee000000-0000-0000-0000-0000000000ee',
   '5e000000-0000-0000-0000-00000000e002', '9a000000-0000-0000-0000-00000000a001');

-- Aynı bağ iki kez kurulamaz (kısmi tekillik indeksi, v1.2-03).
select throws_ok(
  $sql$insert into public.student_guardians (organization_id, student_id, guardian_id)
       values ('ee000000-0000-0000-0000-0000000000ee',
               '5e000000-0000-0000-0000-00000000e001',
               '9b000000-0000-0000-0000-00000000b001')$sql$,
  '23505',
  null,
  'the same student-guardian link cannot be created twice'
);

-- =========================================================================
-- Öğrenci kendi velisini görür — ve yalnız kendi velisini
-- =========================================================================

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'e4000000-0000-0000-0000-000000000004', true);

select is(
  (select count(*) from public.student_guardians),
  2::bigint,
  'a student sees the links of their own record — both guardians'
);

select is(
  (select count(*) from public.student_guardians
   where student_id = '5e000000-0000-0000-0000-00000000e002'),
  0::bigint,
  'and sees nothing of another student — this half matters as much as the first'
);

select set_config('request.jwt.claim.sub', 'e5000000-0000-0000-0000-000000000005', true);

select is(
  (select count(*) from public.student_guardians),
  1::bigint,
  'the other student sees exactly their own single link'
);

-- =========================================================================
-- v1.2-03'ün kararı bozulmadı: veli, diğer veliyi görmez
-- =========================================================================

select set_config('request.jwt.claim.sub', 'e2000000-0000-0000-0000-000000000002', true);

select is(
  (select count(*) from public.student_guardians),
  1::bigint,
  'a guardian sees only their OWN link, not the co-guardian of the same student'
);

select is(
  (select guardian_id from public.student_guardians),
  '9b000000-0000-0000-0000-00000000b001'::uuid,
  'and the row they see is their own'
);

select is(
  (select count(*) from public.guardians
   where id = '9b000000-0000-0000-0000-00000000b002'),
  0::bigint,
  'the co-guardian record itself stays invisible too'
);

-- Veli kendi kaydını görüyor; telefonu da orada.
select is(
  (select phone from public.guardians
   where id = '9b000000-0000-0000-0000-00000000b001'),
  '0532 111 11 11',
  'a guardian can read their own record including the phone'
);

-- Veli veli kaydı YAZAMAZ: insert politikası yalnız admin'e ait.
select throws_ok(
  $sql$insert into public.guardians (organization_id, full_name)
       values ('ee000000-0000-0000-0000-0000000000ee', 'Kendi Eklediğim Veli')$sql$,
  '42501',
  null,
  'a guardian cannot create guardian records'
);

reset role;

-- =========================================================================
-- Denetim izi
-- =========================================================================

-- Denetim okumaları `reset role` altında: `audit_events` RLS taşıyor ve
-- `authenticated` kimliğiyle okunduğunda kapsam dışı satırlar görünmez.

select is(
  (select count(*) from public.audit_events
   where entity_id = '9b000000-0000-0000-0000-00000000b001'
     and action = 'guardian.created'),
  1::bigint,
  'recording a guardian leaves a trace'
);

-- Sonradan düzeltme (2026-10-03, v1.5-21): iz eskiden telefonun KENDİSİNİ
-- taşıyordu ("değişim görünmez kalırdı" gerekçesiyle). Telefon düz metin
-- olarak log'a gitmez (AGENTS.md); değişimin görünürlüğü artık
-- "changed": ["phone"] ile sağlanıyor (`caller_lock_and_masked_phone.test.sql`).
select is(
  (select (metadata ? 'phone')::text from public.audit_events
   where entity_id = '9b000000-0000-0000-0000-00000000b001'
     and action = 'guardian.created'),
  'false',
  'the trace names the guardian but never carries the phone number'
);

select is(
  (select count(*) from public.audit_events
   where entity_id = '7c000000-0000-0000-0000-00000000c001'
     and action = 'student_guardian.created'),
  1::bigint,
  'creating a link leaves a trace'
);

select is(
  (select metadata ->> 'guardian_id' from public.audit_events
   where entity_id = '7c000000-0000-0000-0000-00000000c001'
     and action = 'student_guardian.created'),
  '9b000000-0000-0000-0000-00000000b001',
  'and the trace says which guardian gained access'
);

update public.guardians
set phone = '0532 999 99 99'
where id = '9b000000-0000-0000-0000-00000000b001';

select ok(
  (select metadata -> 'changed' @> '["phone"]'::jsonb
   from public.audit_events
   where entity_id = '9b000000-0000-0000-0000-00000000b001'
     and action = 'guardian.updated'
   order by id desc limit 1),
  'changing the phone names phone as the changed field'
);

-- Bağın koparılması KENDİ eylemidir, bir güncelleme değil. Velinin erişimi
-- tam olarak burada bitiyor (v1.2-19: devredilmiş erişim bağla biter).
update public.student_guardians
set archived_at = now()
where id = '7c000000-0000-0000-0000-00000000c002';

select is(
  (select count(*) from public.audit_events
   where entity_id = '7c000000-0000-0000-0000-00000000c002'
     and action = 'student_guardian.archived'),
  1::bigint,
  'breaking a link is its own action — the moment access ends is in the ledger'
);

select is(
  (select count(*) from public.audit_events
   where entity_id = '7c000000-0000-0000-0000-00000000c002'
     and action = 'student_guardian.updated'),
  0::bigint,
  'and it is not recorded as an ordinary update'
);

-- Koparılan bağ gerçekten erişimi bitiriyor mu — iz yetmez, sonuç ölçülmeli
-- (K-13: mekanizma değil, bloğun SONUCU ölçülür).
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'e3000000-0000-0000-0000-000000000003', true);

-- ⚠️ Ölçüm ilk yazımda YANLIŞ yere bakıyordu ve kırmızıya döndü. `bağ satırı`
-- arşivlendikten sonra da veliye görünmeye devam ediyor, çünkü
-- `student_guardians_select_guardian` politikasında arşiv süzgeci **bilerek**
-- yok (20260908000000: "eleme istemcinin işi; iki politika aynı biçimde
-- davranmalı"). Önemli olan o satır değil, **erişimin bitip bitmediği** —
-- K-13: mekanizma değil, bloğun SONUCU ölçülür.
select is(
  (select count(*) from public.students),
  0::bigint,
  'the guardian whose link was archived can no longer see the student at all'
);

select is(
  (select count(*) from public.attendance_sessions),
  0::bigint,
  'and nothing downstream of that student either'
);

-- Bağ satırının kendisi görünmeye devam ediyor ve bu kayda geçiyor: sürpriz
-- olarak kalmasın, bir gün "arşiv neden süzülmüyor" diye ikinci kez bulunmasın.
select is(
  (select count(*) from public.student_guardians),
  1::bigint,
  'the link row itself stays visible — archive filtering is the client-side job, by design'
);

reset role;

-- Bağ geri kurulabilir ve o da kendi eylemi.
update public.student_guardians
set archived_at = null
where id = '7c000000-0000-0000-0000-00000000c002';

select is(
  (select count(*) from public.audit_events
   where entity_id = '7c000000-0000-0000-0000-00000000c002'
     and action = 'student_guardian.restored'),
  1::bigint,
  'restoring a link is its own action too'
);

-- =========================================================================
-- Realtime — iki tablo daha kurum kanalına düşüyor
-- =========================================================================

select is(
  (select count(*) from realtime.messages
   where topic = 'org:ee000000-0000-0000-0000-0000000000ee'
     and payload ->> 'table' = 'guardians'
     and payload ->> 'op' = 'INSERT'),
  4::bigint,
  'every guardian insert statement broadcasts to the organization channel'
);

select is(
  (select count(*) from realtime.messages
   where topic = 'org:ee000000-0000-0000-0000-0000000000ee'
     and payload ->> 'table' = 'student_guardians'),
  3::bigint,
  'and so does every link change — three statements: one insert, two archive toggles'
);

select is(
  (select count(*) from realtime.messages
   where topic <> 'org:ee000000-0000-0000-0000-0000000000ee'
     and payload ->> 'table' in ('guardians', 'student_guardians')),
  0::bigint,
  'no guardian message leaks to another organization channel'
);

select * from finish();
rollback;
