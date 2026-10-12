-- Issue #18 — Fonksiyon ve tablo yetkilerinin doğrulanması.
--
-- Negatif testler: anon ve authenticated rolleri ayrıcalıklı fonksiyonları
-- çağıramaz. (workspace_documents denetimleri tablo düşürülünce kaldırıldı,
-- göç 20261028000000, #148.)
-- Pozitif testler: RLS'in bağımlı olduğu yardımcı fonksiyon ve auth trigger'ı
-- revoke sonrasında çalışmaya devam eder.
--
-- ⚠️ **Aynı hata ikinci kez yaşandı (v1.3).** Postgres her yeni fonksiyona
-- `PUBLIC` için varsayılan bir EXECUTE yetkisi veriyor ve `grant ... to
-- authenticated` onu kaldırmıyor. v1.3'ün sekiz migration'ından **yedisi**
-- `revoke` satırını atladı; üç `SECURITY DEFINER` fonksiyon giriş yapmadan
-- çağrılabilir hale geldi (sızıntı olmadı — guard'lar `auth.uid()`'e dayandığı
-- için `anon` boş döndü, ölçüldü).
--
-- Bu dosya o zaman da vardı ve dersi #18'den biliyordu. Eksik olan, kuralı
-- **fonksiyon fonksiyon değil şema genelinde** ölçen bir iddiaydı; aşağıdaki
-- son iki test onu kapatıyor. Yeni bir migration `revoke` yazmayı unutursa
-- artık zorunlu `Tenant RLS` kontrolü kırmızı yanar.

begin;

create extension if not exists pgtap with schema extensions;
select plan(8);

-- Kurulum sahibi rolüyle yapılır. Bu insert `on_auth_user_created` trigger'ını
-- tetikler; trigger revoke sonrasında da profil oluşturmalıdır.
insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  created_at,
  updated_at
)
values (
  '30000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'grant-probe@example.test',
  '',
  now(),
  now()
);

select is(
  (
    select count(*)
    from public.profiles
    where id = '30000000-0000-0000-0000-000000000003'
  ),
  1::bigint,
  'handle_new_auth_user trigger still creates a profile after EXECUTE revoke'
);

-- anon rolü ------------------------------------------------------------------

set local role anon;

select throws_ok(
  $$select public.internal_bootstrap_organization(
      'Kurum', 'kurum', 1042, 'Sube',
      '30000000-0000-0000-0000-000000000003'::uuid,
      1000,
      '30000000-0000-0000-0000-000000000003'::uuid
    )$$,
  '42501',
  null,
  'anon cannot execute internal_bootstrap_organization'
);

select throws_ok(
  $$select public.current_user_has_membership(
      '11000000-0000-0000-0000-000000000001'::uuid
    )$$,
  '42501',
  null,
  'anon cannot execute current_user_has_membership'
);

reset role;

-- authenticated rolü ---------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '30000000-0000-0000-0000-000000000003',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  $$select public.internal_bootstrap_organization(
      'Kurum', 'kurum', 1042, 'Sube',
      '30000000-0000-0000-0000-000000000003'::uuid,
      1000,
      '30000000-0000-0000-0000-000000000003'::uuid
    )$$,
  '42501',
  null,
  'authenticated cannot execute internal_bootstrap_organization'
);

-- RLS politikaları bu fonksiyonu çağıran rolün ayrıcalıklarıyla değerlendirir;
-- yetkinin korunduğu doğrulanmazsa tüm tenant okuma akışı sessizce kırılır.
select lives_ok(
  $$select public.current_user_has_membership(
      '11000000-0000-0000-0000-000000000001'::uuid
    )$$,
  'authenticated can still execute current_user_has_membership (RLS depends on it)'
);

-- `set_updated_at`'in EXECUTE yetkisi 2026-09-09'da `public, anon,
-- authenticated`'dan alındı. Bu test o yüzden artık daha değerli: Postgres
-- tetikleyici fonksiyonunun yetkisini tetikleyici KURULURKEN denetliyor,
-- ateşlenirken değil — ve bu iddia onu ölçüyor.
select lives_ok(
  $$update public.profiles
      set display_name = 'Guncellenmis Ad'
    where id = '30000000-0000-0000-0000-000000000003'$$,
  'authenticated can still update own profile and fire the updated_at trigger'
);

reset role;

-- Şema geneli — v1.3'te açılan boşluğun kalıcı kapağı --------------------------

-- ⛔ Tek tek fonksiyon saymak yerine kuralın kendisi ölçülüyor. Başarısız
-- olursa mesaj hangi fonksiyonların açık kaldığını söyler; sayı tek başına
-- bir sonraki kişiye yetmez.
select is(
  (
    select coalesce(string_agg(p.proname, ', ' order by p.proname), '')
    from pg_proc as p
    where p.pronamespace = 'public'::regnamespace
      and p.prokind = 'f'
      and has_function_privilege('anon', p.oid, 'execute')
  ),
  '',
  'no function in public is executable by anon — revoke comes before grant'
);

-- ⛔ Ayrı bir tuzak: `search_path`'i sabitlenmemiş bir `security definer`
-- fonksiyon çağıranın şema sırasıyla çalışır ve sahte bir tabloyla
-- kandırılabilir.
select is(
  (
    select coalesce(string_agg(p.proname, ', ' order by p.proname), '')
    from pg_proc as p
    where p.pronamespace = 'public'::regnamespace
      and p.prosecdef
      and (p.proconfig is null or not (p.proconfig::text like '%search_path=%'))
  ),
  '',
  'every security definer function pins its search_path'
);

select * from finish();

rollback;
