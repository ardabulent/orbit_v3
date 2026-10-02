-- Kilitli çağıran ve maskeli veli telefonu (2026-10-03, v1.5-20 / v1.5-21).
--
--   1. Kilitsiz yönetici istek kapısından geçer.
--   2. ⛔ `must_change_password` olan yönetici durur: password_locked.
--   3. ⛔ Geçici şifresinin süresi dolmuş yönetici de durur.
--   4. ⛔ Kilitli çağıran, tamamlanmış bir çağrının tekrarını da alamaz
--      (kilit tekrar korumasından önce gelir).
--   5. Kilitsiz operatör kurum istatistiğini görür.
--   6. ⛔ Kilitli operatör göremez (null).
--   7. Yeni veli: denetim kaydında ad var, telefon YOK.
--   8. Telefon değişince kayıt "changed: [phone]" der, numarayı yazmaz.
--   9. Göçten sonra hiçbir veli denetim kaydında telefon kalmamış.

begin;

create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
values
  ('e1100000-0000-0000-0000-0000000e1100', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'kk-acik@example.test', '', now(), now()),
  ('e1200000-0000-0000-0000-0000000e1200', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'kk-kilitli@example.test', '', now(), now()),
  ('e1300000-0000-0000-0000-0000000e1300', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'kk-suresi-dolmus@example.test', '', now(), now()),
  ('e1400000-0000-0000-0000-0000000e1400', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'kk-operator@example.test', '', now(), now());

update public.profiles set must_change_password = false, password_expires_at = null
 where id in ('e1100000-0000-0000-0000-0000000e1100', 'e1400000-0000-0000-0000-0000000e1400');
update public.profiles set must_change_password = true
 where id = 'e1200000-0000-0000-0000-0000000e1200';
update public.profiles set must_change_password = false,
       password_expires_at = now() - interval '1 minute'
 where id = 'e1300000-0000-0000-0000-0000000e1300';

insert into public.platform_operators (user_id, role, status)
values ('e1400000-0000-0000-0000-0000000e1400', 'owner', 'active');

insert into public.organizations (id, name, slug, code)
values ('e2100000-0000-0000-0000-0000000e2100', 'Kilit Kurumu', 'kilit-kurumu', 8907);

-- 1 · Kilitsiz çağıran geçer
select is(
  (public.internal_begin_function_call('create-member', 'e1100000-0000-0000-0000-0000000e1100') ->> 'allowed'),
  'true',
  'an unlocked caller passes the request gate'
);

-- 2 · Şifre değiştirmesi gereken çağıran durur
select is(
  (public.internal_begin_function_call('create-member', 'e1200000-0000-0000-0000-0000000e1200') ->> 'reason'),
  'password_locked',
  'a caller who must change their password is stopped at the gate'
);

-- 3 · Süresi dolmuş geçici şifre de kilittir
select is(
  (public.internal_begin_function_call('change-member-role', 'e1300000-0000-0000-0000-0000000e1300') ->> 'reason'),
  'password_locked',
  'a caller whose temporary password expired is stopped at the gate'
);

-- 4 · Kilit tekrar korumasından önce gelir
insert into public.internal_function_calls (function_slug, caller_user_id, idempotency_key, completed_at, outcome)
values ('reset-member-password', 'e1200000-0000-0000-0000-0000000e1200', 'kk-anahtar', now(), '{"ok": true}');

select is(
  (public.internal_begin_function_call('reset-member-password', 'e1200000-0000-0000-0000-0000000e1200', 'kk-anahtar') ->> 'reason'),
  'password_locked',
  'a locked caller does not even get the replay of a finished call'
);

-- 5–6 · Operatör istatistiği
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'e1400000-0000-0000-0000-0000000e1400', true);

select isnt(
  public.platform_organization_stats('e2100000-0000-0000-0000-0000000e2100'),
  null,
  'an unlocked operator sees organization stats'
);

reset role;
update public.profiles set must_change_password = true
 where id = 'e1400000-0000-0000-0000-0000000e1400';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e1400000-0000-0000-0000-0000000e1400', true);

select is(
  public.platform_organization_stats('e2100000-0000-0000-0000-0000000e2100'),
  null,
  'a locked operator gets no stats, like every other operator read'
);

reset role;

-- 7 · Yeni velinin denetim kaydında telefon yok
insert into public.guardians (id, organization_id, full_name, phone)
values ('e3100000-0000-0000-0000-0000000e3100', 'e2100000-0000-0000-0000-0000000e2100',
        'Maskeli Veli', '0532 111 22 33');

select is(
  (select (metadata ? 'phone')::text || ' ' || (metadata ->> 'full_name')
     from public.audit_events
    where entity_id = 'e3100000-0000-0000-0000-0000000e3100' and action = 'guardian.created'),
  'false Maskeli Veli',
  'a new guardian is audited by name, the phone number is not written'
);

-- 8 · Telefon değişimi yalnız "değişti" olarak kalır
update public.guardians set phone = '0532 999 88 77'
 where id = 'e3100000-0000-0000-0000-0000000e3100';

select is(
  (select (metadata ? 'phone')::text || ' ' || (metadata -> 'changed')::text
     from public.audit_events
    where entity_id = 'e3100000-0000-0000-0000-0000000e3100' and action = 'guardian.updated'),
  'false ["phone"]',
  'a phone change is recorded as changed, without the number'
);

-- 9 · Geçmişte telefon kalmadı
select is(
  (select count(*) from public.audit_events
    where entity_type = 'guardian' and metadata ? 'phone'),
  0::bigint,
  'no guardian audit row carries a phone number'
);

select * from finish();
rollback;
