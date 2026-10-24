-- v1.2-17 — Hız sınırı ve idempotency kapısı.
--
-- Bu dosyanın en önemli testi **tekrarın işi ikinci kez yaptırmadığını**
-- ölçendir: aynı anahtarla gelen ikinci istek `replay` almalı ve saklanan özeti
-- geri vermeli.
--
-- İkinci grup, kapının **her şeyi reddetmediğini** ölçüyor. Her çağrıyı
-- reddeden bir kapı da testi geçerdi ve ürünü kullanılamaz yapardı.
--
-- Ayrıca özetin **geçici şifre taşımadığı** ayrıca sınanıyor: idempotency'nin
-- şifreyi saklamaya dönüşmemesi bu dilimin kırmızı çizgisi.

begin;

create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
values
  ('91000000-0000-0000-0000-000000000091', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'birinci@example.test', '', now(), now()),
  ('92000000-0000-0000-0000-000000000092', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ikinci@example.test', '', now(), now());

-- Tekrar koruması ------------------------------------------------------------

select is(
  (select public.internal_begin_function_call(
     'create-member', '91000000-0000-0000-0000-000000000091', 'anahtar-a'
   ) ->> 'allowed'),
  'true',
  'the first call with a key is allowed'
);

-- Kapatılmamış bir çağrı: iş hâlâ sürüyor olabilir. İkinci kez yapmak yerine
-- çağıran bekletiliyor.
select is(
  (select public.internal_begin_function_call(
     'create-member', '91000000-0000-0000-0000-000000000091', 'anahtar-a'
   ) ->> 'reason'),
  'in_progress',
  'the same key before completion is not allowed to do the work twice'
);

select lives_ok(
  $sql$select public.internal_finish_function_call(
    (select id from public.internal_function_calls where idempotency_key = 'anahtar-a'),
    jsonb_build_object('member_created', true)
  )$sql$,
  'the call can be closed with a summary'
);

select is(
  (select public.internal_begin_function_call(
     'create-member', '91000000-0000-0000-0000-000000000091', 'anahtar-a'
   ) ->> 'reason'),
  'replay',
  'the same key after completion replays instead of repeating'
);

select is(
  (select public.internal_begin_function_call(
     'create-member', '91000000-0000-0000-0000-000000000091', 'anahtar-a'
   ) -> 'outcome' ->> 'member_created'),
  'true',
  'the replay carries the stored summary'
);

-- ⛔ Bu dilimin kırmızı çizgisi. Özet **hiçbir kimlik belirteci** taşımaz:
-- ne şifre, ne giriş numarası.
--
-- Şifre hiçbir zaman yazılmadı (`DECISION_LOG` — "Kimlik ve Giriş Bilgisi
-- Mimarisi") ve idempotency bunu değiştirmek için bir gerekçe değil. Giriş
-- numarası ise v1.4-00'da çıkarıldı: bu tablo kurum taşımıyor, dolayısıyla
-- `internal_delete_organization` onu görmüyor ve silinen kurumun satırları
-- geride kalıyordu (`PLATFORM_SETTINGS` §5).
--
-- Buradaki iddia yalnız **verilen** özeti ölçebilir; Edge Function'ların ne
-- yazdığını `supabase/tests/deployment/functionCallLedger.test.ts` ölçüyor.
select is(
  (select count(*)::int from public.internal_function_calls
   where outcome::text ilike '%password%'),
  0,
  'no stored summary carries anything that looks like a password'
);

-- Anahtar çağırana bağlı: başkasının anahtarı başkasının sonucunu açmaz.
select is(
  (select public.internal_begin_function_call(
     'create-member', '92000000-0000-0000-0000-000000000092', 'anahtar-a'
   ) ->> 'allowed'),
  'true',
  'the same key from another caller is a different request'
);

-- Anahtarsız çağrı da çalışır: sözleşme genişlerken eski istemci kırılmamalı.
select is(
  (select public.internal_begin_function_call(
     'create-member', '91000000-0000-0000-0000-000000000091', null
   ) ->> 'allowed'),
  'true',
  'a call without a key still works, it just has no replay protection'
);

select is(
  (select public.internal_begin_function_call(
     'create-member', '91000000-0000-0000-0000-000000000091', null
   ) ->> 'allowed'),
  'true',
  'two keyless calls are two calls, not a repeat'
);

-- Hız sınırı ------------------------------------------------------------------
--
-- `delete-organization` sınırı saatte 5. Beşi geçmeli, altıncısı durmalı.

select is(
  (select count(*)::int from (
     select public.internal_begin_function_call(
       'delete-organization', '92000000-0000-0000-0000-000000000092', null
     ) ->> 'allowed' as izin
     from generate_series(1, 5)
   ) as denemeler
   where denemeler.izin = 'true'),
  5,
  'calls inside the hourly limit all pass'
);

select is(
  (select public.internal_begin_function_call(
     'delete-organization', '92000000-0000-0000-0000-000000000092', null
   ) ->> 'reason'),
  'rate_limited',
  'the call past the hourly limit is stopped'
);

-- Sınır fonksiyon başına: biri dolduğunda diğeri etkilenmemeli.
select is(
  (select public.internal_begin_function_call(
     'create-member', '92000000-0000-0000-0000-000000000092', null
   ) ->> 'allowed'),
  'true',
  'one function hitting its limit does not close another'
);

-- Yetkiler --------------------------------------------------------------------

select ok(
  not has_function_privilege('anon', 'public.internal_begin_function_call(text, uuid, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.internal_begin_function_call(text, uuid, text)', 'execute'),
  'client roles cannot open a call themselves'
);

select ok(
  not has_table_privilege('anon', 'public.internal_function_calls', 'select')
  and not has_table_privilege('authenticated', 'public.internal_function_calls', 'select'),
  'client roles cannot read the call log'
);

-- Kurtarma e-postası sınırı açıkça 10 (2026-10-25, ana plan 2.8): on birinci
-- çağrı durur ve cevap sınırın kendisini taşır.
select count(*) from (
  select public.internal_begin_function_call(
    'recovery-email', '91000000-0000-0000-0000-000000000091', null
  )
  from generate_series(1, 10)
) as ilk_on;

select is(
  (select public.internal_begin_function_call(
     'recovery-email', '91000000-0000-0000-0000-000000000091', null
   ) -> 'limit'),
  '10'::jsonb,
  'recovery-email has its own explicit limit of 10 per hour'
);

select * from finish();
rollback;
