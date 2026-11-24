-- Takip sekmesi (2026-11-24): kurum varsayılan sınırları.
--
-- Yalnız tam yönetici yazar; kurumun yönetici ve öğretmenleri okur; öğrenci
-- ve komşu kurum görmez. Yön kuralı veritabanında; "son değiştiren" alanı
-- istemciden verilemez; her yazı iz bırakır.

begin;

create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
values
  ('c0110000-0000-0000-0000-0000000c0110', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'tv-yonetici@example.test', '', now(), now()),
  ('c0120000-0000-0000-0000-0000000c0120', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'tv-ogretmen@example.test', '', now(), now()),
  ('c0130000-0000-0000-0000-0000000c0130', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'tv-ogrenci@example.test', '', now(), now()),
  ('c0140000-0000-0000-0000-0000000c0140', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'tv-komsu@example.test', '', now(), now()),
  ('c0150000-0000-0000-0000-0000000c0150', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'tv-sube@example.test', '', now(), now());

insert into public.organizations (id, name, slug, code)
values
  ('c0210000-0000-0000-0000-0000000c0210', 'Varsayılan Dershanesi', 'varsayilan-dershanesi', 7997),
  ('c0220000-0000-0000-0000-0000000c0220', 'Varsayılan Komşusu', 'varsayilan-komsusu', 7998);

insert into public.branches (id, organization_id, name, is_default)
values ('c0230000-0000-0000-0000-0000000c0230', 'c0210000-0000-0000-0000-0000000c0210', 'V Ş1', true);

insert into public.organization_memberships (id, organization_id, branch_id, user_id, role, status)
values
  ('c0310000-0000-0000-0000-0000000c0310', 'c0210000-0000-0000-0000-0000000c0210', null,
   'c0110000-0000-0000-0000-0000000c0110', 'admin', 'active'),
  ('c0320000-0000-0000-0000-0000000c0320', 'c0210000-0000-0000-0000-0000000c0210', null,
   'c0120000-0000-0000-0000-0000000c0120', 'teacher', 'active'),
  ('c0330000-0000-0000-0000-0000000c0330', 'c0210000-0000-0000-0000-0000000c0210', null,
   'c0130000-0000-0000-0000-0000000c0130', 'student', 'active'),
  ('c0340000-0000-0000-0000-0000000c0340', 'c0220000-0000-0000-0000-0000000c0220', null,
   'c0140000-0000-0000-0000-0000000c0140', 'admin', 'active'),
  ('c0350000-0000-0000-0000-0000000c0350', 'c0210000-0000-0000-0000-0000000c0210',
   'c0230000-0000-0000-0000-0000000c0230',
   'c0150000-0000-0000-0000-0000000c0150', 'admin', 'active');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

-- 1 · Tam yönetici yazar
select set_config('request.jwt.claim.sub', 'c0110000-0000-0000-0000-0000000c0110', true);
select lives_ok(
  $$insert into public.tracking_threshold_defaults (organization_id, metric, risk_limit, safe_limit)
    values ('c0210000-0000-0000-0000-0000000c0210', 'attendance_pct', 75, 85)$$,
  'a full admin sets an institution default'
);

-- 2 · Son değiştiren çağırandan doldurulur
select is(
  (select updated_by_membership_id::text from public.tracking_threshold_defaults
    where metric = 'attendance_pct'),
  'c0310000-0000-0000-0000-0000000c0310',
  'the updater is filled from the caller''s membership'
);

-- 3 · ⛔ Son değiştiren istemciden verilemez (sütun yetkisi yok)
select throws_ok(
  $$insert into public.tracking_threshold_defaults
      (organization_id, metric, risk_limit, safe_limit, updated_by_membership_id)
    values ('c0210000-0000-0000-0000-0000000c0210', 'homework_pct', 60, 80,
            'c0320000-0000-0000-0000-0000000c0320')$$,
  '42501',
  null,
  'the client cannot claim who changed a default'
);

-- 4 · ⛔ Yön kuralı: "yüksek olan iyi" ölçütte riskli > güvenli olamaz
select throws_ok(
  $$insert into public.tracking_threshold_defaults (organization_id, metric, risk_limit, safe_limit)
    values ('c0210000-0000-0000-0000-0000000c0210', 'homework_pct', 90, 80)$$,
  '23514',
  null,
  'a higher-is-better metric refuses a risk limit above the safe limit'
);

-- 5 · ⛔ Yön kuralı: "düşük olan iyi" ölçütte riskli < güvenli olamaz
select throws_ok(
  $$insert into public.tracking_threshold_defaults (organization_id, metric, risk_limit, safe_limit)
    values ('c0210000-0000-0000-0000-0000000c0210', 'late_count', 1, 3)$$,
  '23514',
  null,
  'a lower-is-better metric refuses a risk limit below the safe limit'
);

-- 6 · İstemcinin yazma biçimi (PostgREST upsert: çakışmada her sütun)
select lives_ok(
  $$insert into public.tracking_threshold_defaults (organization_id, metric, risk_limit, safe_limit)
    values ('c0210000-0000-0000-0000-0000000c0210', 'attendance_pct', 70, 85),
           ('c0210000-0000-0000-0000-0000000c0210', 'late_count', 3, 1)
    on conflict (organization_id, metric) do update set
      organization_id = excluded.organization_id, metric = excluded.metric,
      risk_limit = excluded.risk_limit, safe_limit = excluded.safe_limit$$,
  'a full admin saves every metric in one upsert'
);

-- 7 · Her yazı iz bırakır: ekleme, güncelleme, ekleme
select is(
  (select count(*) from public.audit_events
    where entity_type = 'tracking_threshold_default'
      and organization_id = 'c0210000-0000-0000-0000-0000000c0210'),
  3::bigint,
  'setting a default leaves a trace in the audit log'
);

-- 8 · Öğretmen okur
select set_config('request.jwt.claim.sub', 'c0120000-0000-0000-0000-0000000c0120', true);
select is(
  (select count(*) from public.tracking_threshold_defaults),
  2::bigint,
  'a teacher reads the institution defaults'
);

-- 9 · ⛔ Öğretmen yazamaz
select throws_ok(
  $$insert into public.tracking_threshold_defaults (organization_id, metric, risk_limit, safe_limit)
    values ('c0210000-0000-0000-0000-0000000c0210', 'net_avg', 40, 60)$$,
  '42501',
  null,
  'a teacher cannot set an institution default'
);

-- 10 · ⛔ Şube yöneticisi yazamaz (kurum geneli ayar)
select set_config('request.jwt.claim.sub', 'c0150000-0000-0000-0000-0000000c0150', true);
update public.tracking_threshold_defaults set risk_limit = 60
 where metric = 'attendance_pct';
select is(
  (select risk_limit::text from public.tracking_threshold_defaults
    where metric = 'attendance_pct'),
  '70.00',
  'a branch admin cannot change an institution-wide default'
);

-- 11 · ⛔ Öğrenci görmez
select set_config('request.jwt.claim.sub', 'c0130000-0000-0000-0000-0000000c0130', true);
select is(
  (select count(*) from public.tracking_threshold_defaults),
  0::bigint,
  'a student does not see tracking defaults'
);

-- 12 · ⛔ Komşu kurum görmez
select set_config('request.jwt.claim.sub', 'c0140000-0000-0000-0000-0000000c0140', true);
select is(
  (select count(*) from public.tracking_threshold_defaults),
  0::bigint,
  'an admin of another institution does not see these defaults'
);

select * from finish();
rollback;
