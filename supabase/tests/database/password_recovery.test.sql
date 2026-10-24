-- Kurtarma adresi ve şifremi unuttum (2026-10-13, göç 20261102000000, #118).
--
--   1–2   Kod üretimi: ⛔ `…@orbit.invalid` kurtarma adresi olamaz; kod 6 hane.
--   3–5   Yanlış kod boş döner ve denemeyi sayar; doğru kod adresi yazar;
--         kod tek kullanımlıktır.
--   6     5 yanlış denemeden sonra doğru kod da kabul edilmez.
--   7     ⛔ Kilitli hesap (geçici şifre) adres doğrulayamaz.
--   8     ⛔ İç fonksiyonlar oturumla çağrılamaz.
--   9–12  Şifremi unuttum hedefi: kurtarma adresi yoksa sentetik adrese
--         gönderilmez; varsa oraya; gerçek giriş adresi kendisine; etkin
--         üyeliği olmayana hiç.
--   13    Kişi başına saatte en çok 3 gönderim (defterden sayılır,
--         göç 20261103000000).
--   14    Kişi kendi kurtarma adresini kaldırabilir.
--   15    Defter adres, kod ya da bağlantı tutmaz; sonuç ve sebep yazılır.
--   16    Kurum yöneticisi üyesinin kurtarma adresi olup olmadığını ve son
--         e-postanın sonucunu görür (adresin kendisini değil).
--   17    ⛔ Veli bu görünümü alamaz.
--   18    ⛔ Başka kurumun yöneticisi bu kurumun üyelerini göremez.

begin;

create extension if not exists pgtap with schema extensions;
select plan(19);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('b1000000-0000-0000-0000-00000000b100', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '80010001@orbit.invalid', '', now(), now()),
  ('b2000000-0000-0000-0000-00000000b200', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '80010002@orbit.invalid', '', now(), now()),
  ('b3000000-0000-0000-0000-00000000b300', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'kurtarma-yonetici@example.test', '', now(), now()),
  ('b4000000-0000-0000-0000-00000000b400', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '80010004@orbit.invalid', '', now(), now()),
  ('b5000000-0000-0000-0000-00000000b500', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '80010005@orbit.invalid', '', now(), now()),
  ('b6000000-0000-0000-0000-00000000b600', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'baska-yonetici@example.test', '', now(), now());
-- 1 veli, kurtarma adresi yok · 2 veli, adres ekleyecek · 3 yönetici, gerçek
-- adres · 4 üyeliği yok ama adresi var · 5 geçici şifreli (kilitli)
-- 6 başka kurumun yöneticisi

insert into public.organizations (id, name, slug, code)
values ('b9000000-0000-0000-0000-00000000b900', 'Kurtarma Dershanesi', 'kurtarma-dershanesi', 8001),
       ('b9100000-0000-0000-0000-00000000b910', 'Başka Dershane', 'baska-dershane-kurtarma', 8002);

insert into public.organization_memberships (organization_id, user_id, role, status)
values ('b9000000-0000-0000-0000-00000000b900', 'b1000000-0000-0000-0000-00000000b100', 'parent', 'active'),
       ('b9000000-0000-0000-0000-00000000b900', 'b2000000-0000-0000-0000-00000000b200', 'parent', 'active'),
       ('b9000000-0000-0000-0000-00000000b900', 'b3000000-0000-0000-0000-00000000b300', 'admin', 'active'),
       ('b9000000-0000-0000-0000-00000000b900', 'b5000000-0000-0000-0000-00000000b500', 'parent', 'active'),
       ('b9100000-0000-0000-0000-00000000b910', 'b6000000-0000-0000-0000-00000000b600', 'admin', 'active');

update public.profiles set recovery_email = 'eski-uye@example.test'
where id = 'b4000000-0000-0000-0000-00000000b400';
update public.profiles set must_change_password = true
where id = 'b5000000-0000-0000-0000-00000000b500';

create function pg_temp.olarak(kisi uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', kisi::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
end $$;

-- 1
select throws_ok(
  $$select public.internal_start_recovery_email_challenge('b2000000-0000-0000-0000-00000000b200', '12345678@orbit.invalid')$$,
  '22023', null, 'a synthetic login address cannot be a recovery address');

-- 2
create temp table kod as
  select public.internal_start_recovery_email_challenge(
    'b2000000-0000-0000-0000-00000000b200', ' Veli.Iki@Example.test ') as deger;
grant select on kod to authenticated;
select ok((select deger ~ '^\d{6}$' from kod), 'the verification code has six digits');

-- 3
select pg_temp.olarak('b2000000-0000-0000-0000-00000000b200');
select ok(
  public.confirm_recovery_email(
    (select case when deger = '000000' then '111111' else '000000' end from kod)) is null,
  'a wrong code returns nothing');
reset role;

-- 4
select pg_temp.olarak('b2000000-0000-0000-0000-00000000b200');
select is(public.confirm_recovery_email((select deger from kod)), 'veli.iki@example.test',
  'the right code saves the address');
reset role;
select is((select recovery_email from public.profiles where id = 'b2000000-0000-0000-0000-00000000b200'),
  'veli.iki@example.test', 'the profile now carries the verified address');

-- 5
select pg_temp.olarak('b2000000-0000-0000-0000-00000000b200');
select throws_ok(format('select public.confirm_recovery_email(%L)', (select deger from kod)),
  'ORB08', null, 'a code works only once');
reset role;

-- 6
truncate kod;
insert into kod select public.internal_start_recovery_email_challenge(
  'b1000000-0000-0000-0000-00000000b100', 'veli.bir@example.test');
select pg_temp.olarak('b1000000-0000-0000-0000-00000000b100');
select public.confirm_recovery_email((select case when deger = '000000' then '111111' else '000000' end from kod))
from generate_series(1, 5);
select throws_ok(format('select public.confirm_recovery_email(%L)', (select deger from kod)),
  'ORB08', null, 'after five wrong attempts even the right code is refused');
reset role;
delete from public.recovery_email_challenges where user_id = 'b1000000-0000-0000-0000-00000000b100';

-- 7
truncate kod;
insert into kod select public.internal_start_recovery_email_challenge(
  'b5000000-0000-0000-0000-00000000b500', 'kilitli@example.test');
select pg_temp.olarak('b5000000-0000-0000-0000-00000000b500');
select throws_ok(format('select public.confirm_recovery_email(%L)', (select deger from kod)),
  '42501', null, 'a locked account cannot verify a recovery address');
reset role;

-- 8
select ok(
  not has_function_privilege('authenticated', 'public.internal_start_recovery_email_challenge(uuid, text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.internal_claim_password_reset(text, text, boolean)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.internal_claim_password_reset(text, text, boolean)', 'EXECUTE'),
  'the internal functions cannot be called with a session');

-- 9
select is((select count(*) from public.internal_claim_password_reset('80010001@orbit.invalid')), 0::bigint,
  'no recovery address: nothing is sent to a synthetic login address');

-- 10
select is((select destination from public.internal_claim_password_reset('80010002@orbit.invalid')),
  'veli.iki@example.test', 'a number with a verified address is sent to that address');

-- 11
select is((select destination from public.internal_claim_password_reset('Kurtarma-Yonetici@example.test')),
  'kurtarma-yonetici@example.test', 'a real login address is sent to itself');

-- 12
select is((select count(*) from public.internal_claim_password_reset('80010004@orbit.invalid')), 0::bigint,
  'an account without an active membership gets nothing');

-- 13
select public.internal_claim_password_reset('80010002@orbit.invalid') from generate_series(1, 3);
select is(
  (select count(*) from public.email_deliveries
    where kind = 'password_reset' and user_id = 'b2000000-0000-0000-0000-00000000b200'),
  3::bigint, 'at most three reset mails per person per hour');

-- 14
select pg_temp.olarak('b2000000-0000-0000-0000-00000000b200');
select public.remove_my_recovery_email();
reset role;
select is((select recovery_email from public.profiles where id = 'b2000000-0000-0000-0000-00000000b200'),
  null, 'a person can remove their own recovery address');

-- 15
select public.internal_finish_email_delivery(
  (select max(id) from public.email_deliveries where user_id = 'b2000000-0000-0000-0000-00000000b200'),
  'failed', 'smtp_535');
select ok(
  (select array_agg(column_name::text order by column_name::text)
     from information_schema.columns
    where table_schema = 'public' and table_name = 'email_deliveries')
    = array['created_at', 'finished_at', 'id', 'kind', 'reason', 'status', 'user_id']
  and (select status = 'failed' and reason = 'smtp_535' and finished_at is not null
         from public.email_deliveries
        where id = (select max(id) from public.email_deliveries
                     where user_id = 'b2000000-0000-0000-0000-00000000b200')),
  'the ledger keeps the outcome and the reason, never an address, code or link');

-- 16
select pg_temp.olarak('b3000000-0000-0000-0000-00000000b300');
select is(
  (select (has_recovery_email, last_kind, last_status, last_reason)::text
     from public.member_email_status() as durum
     join public.organization_memberships as uyelik on uyelik.id = durum.membership_id
    where uyelik.user_id = 'b2000000-0000-0000-0000-00000000b200'),
  '(f,password_reset,failed,smtp_535)',
  'the administrator sees whether a member has a recovery address and how the last mail went');
reset role;

-- 17
select pg_temp.olarak('b1000000-0000-0000-0000-00000000b100');
select is((select count(*) from public.member_email_status()), 0::bigint,
  'a guardian does not get the mail status view');
reset role;

-- 18
select pg_temp.olarak('b6000000-0000-0000-0000-00000000b600');
-- Birleştirme yapılmaz: yönetici başka kurumun üyelik satırını zaten
-- okuyamaz ve sayım her durumda 0 çıkardı. Görünümün kendisi sayılır.
select is((select count(*) from public.member_email_status()), 1::bigint,
  'another institution''s administrator sees only their own institution (one member)');
reset role;

select * from finish();
rollback;
