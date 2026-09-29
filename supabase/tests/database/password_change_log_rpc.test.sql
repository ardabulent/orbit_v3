-- `log_own_password_change` (2026-09-30): şifre izi uygulamadan yazılır,
-- çünkü üretimde auth.audit_log_entries hiç yazılmıyor (0 satır, ölçüldü).
--
--   1. Hesabı yeni güncellenmiş kişi çağırınca etkin kurumlarına iz düşer.
--   2. ⛔ Hemen ikinci çağrı yazmaz (2 dakika kuralı — iz yağdırılamaz).
--   3. ⛔ GoTrue tetikleyicisi aynı olayı ikinci kez yazmaz (tek iz).
--   4. ⛔ Hesabı 5 dakikadan eski güncellenmiş kişi yazamaz (sahte iz zor).
--   5. ⛔ Oturumsuz çağrı 42501.
--   6. ⛔ anon çağıramaz.

begin;

create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
values
  ('e0110000-0000-0000-0000-0000000e0110', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'lp-yeni@example.test', '', now(), now()),
  ('e0120000-0000-0000-0000-0000000e0120', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'lp-eski@example.test', '', now() - interval '1 day',
   now() - interval '1 day');

insert into public.organizations (id, name, slug, code)
values
  ('e0210000-0000-0000-0000-0000000e0210', 'İz Bir', 'iz-bir', 8901),
  ('e0220000-0000-0000-0000-0000000e0220', 'İz İki', 'iz-iki', 8902);

insert into public.organization_memberships (id, organization_id, user_id, role, status)
values
  ('e0310000-0000-0000-0000-0000000e0310', 'e0210000-0000-0000-0000-0000000e0210',
   'e0110000-0000-0000-0000-0000000e0110', 'teacher', 'active'),
  ('e0320000-0000-0000-0000-0000000e0320', 'e0220000-0000-0000-0000-0000000e0220',
   'e0110000-0000-0000-0000-0000000e0110', 'parent', 'active'),
  ('e0330000-0000-0000-0000-0000000e0330', 'e0210000-0000-0000-0000-0000000e0210',
   'e0120000-0000-0000-0000-0000000e0120', 'teacher', 'active');

-- Oturum açılmadan önce: kayıt kurulumu `profiles` tetikleyicisi updated_at'i
-- değiştirmiş olabilir; eski kişinin damgasını yeniden geriye çek.
update auth.users set updated_at = now() - interval '1 day'
 where id = 'e0120000-0000-0000-0000-0000000e0120';

create temp table sonuc (adim int, deger boolean) on commit drop;
grant all on sonuc to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'e0110000-0000-0000-0000-0000000e0110', true);
insert into sonuc values (1, public.log_own_password_change());
insert into sonuc values (2, public.log_own_password_change());
reset role;

-- 1 · İki etkin kuruma iz
select is(
  (select (select deger from sonuc where adim = 1)::text || ' ' ||
          (select count(*) from public.audit_events
            where action = 'account.password_changed'
              and actor_user_id = 'e0110000-0000-0000-0000-0000000e0110')),
  'true 2',
  'a user whose account was just updated leaves a trace in every active institution'
);

-- 2 · Hemen ikinci çağrı yazmaz
select is(
  (select (select deger from sonuc where adim = 2)::text || ' ' ||
          (select count(*) from public.audit_events
            where action = 'account.password_changed'
              and actor_user_id = 'e0110000-0000-0000-0000-0000000e0110')),
  'false 2',
  'a second call within two minutes writes nothing'
);

-- 3 · GoTrue tetikleyicisi aynı olayı ikinci kez yazmaz
insert into auth.audit_log_entries (instance_id, id, payload, created_at)
values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(),
        json_build_object('action', 'user_updated_password',
                          'actor_id', 'e0110000-0000-0000-0000-0000000e0110'),
        now());
select is(
  (select count(*) from public.audit_events
    where action = 'account.password_changed'
      and actor_user_id = 'e0110000-0000-0000-0000-0000000e0110'),
  2::bigint,
  'the auth-log trigger and the app call never write the same change twice'
);

-- 4 · Eski güncelleme → yazmaz
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e0120000-0000-0000-0000-0000000e0120', true);
insert into sonuc values (4, public.log_own_password_change());
reset role;
select is(
  (select (select deger from sonuc where adim = 4)::text || ' ' ||
          (select count(*) from public.audit_events
            where actor_user_id = 'e0120000-0000-0000-0000-0000000e0120')),
  'false 0',
  'a user whose account was not recently updated cannot write a password trace'
);

-- 5 · Oturumsuz
set local role authenticated;
select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  'select public.log_own_password_change()',
  '42501',
  null,
  'without a session the call is refused'
);

-- 6 · anon çağıramaz
reset role;
select is(
  has_function_privilege('anon', 'public.log_own_password_change()', 'execute'),
  false,
  'anon cannot call it'
);

select * from finish();
rollback;
