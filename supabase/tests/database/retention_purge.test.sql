-- 30 günlük saklama gerçekten uygulanır (2026-10-23, ana plan 2.3 ve 2.14).
--
--   1. 31 günlük mesaj silinir, 29 günlük kalır.
--   2. 31 günlük mesaj bildirimi silinir; aynı yaştaki ödev bildirimi kalır.
--   3. Mesajı kalmamış eski sohbet silinir; yeni mesajlı sohbet kalır.
--   4. Eski ekran hata kaydı ve e-posta defteri satırı silinir, yenisi kalır.
--   5. Hata paneli 30 günden eskiyi göstermez.
--   6. Gece işi tanımlı, her gün 00:00 UTC.
--   7. ⛔ Fonksiyon oturum açmış kullanıcıya kapalı.
--   8. Silinen gecede denetim kaydına sayılar yazılır; boş gecede yazılmaz.

begin;

create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
select ('5a' || n || '00000-0000-0000-0000-0000000005a' || n)::uuid,
       '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'saklama-' || n || '@example.test', '', now(), now()
from generate_series(1, 3) as n;

insert into public.organizations (id, name, slug, code)
values ('5a900000-0000-0000-0000-0000000005a9', 'Saklama Dershanesi', 'saklama-dershanesi', 7993);

insert into public.organization_memberships (id, organization_id, user_id, role, status)
select ('5a' || n || '10000-0000-0000-0000-0000000005a' || n)::uuid,
       '5a900000-0000-0000-0000-0000000005a9',
       ('5a' || n || '00000-0000-0000-0000-0000000005a' || n)::uuid,
       (array['admin','teacher','teacher'])[n]::public.app_role,
       'active'
from generate_series(1, 3) as n;

-- Eski sohbet (1↔2): tek mesajı 31 günlük. Yeni sohbet (1↔3): biri 31,
-- biri 29 günlük. Uçlar küçük/büyük sırada (`conversations_pair_check`).
insert into public.conversations (id, organization_id, member_low, member_high, last_message_at, created_at)
values
  ('5ac10000-0000-0000-0000-0000000005c1', '5a900000-0000-0000-0000-0000000005a9',
   '5a110000-0000-0000-0000-0000000005a1', '5a210000-0000-0000-0000-0000000005a2',
   now() - interval '31 days', now() - interval '40 days'),
  ('5ac20000-0000-0000-0000-0000000005c2', '5a900000-0000-0000-0000-0000000005a9',
   '5a110000-0000-0000-0000-0000000005a1', '5a310000-0000-0000-0000-0000000005a3',
   now() - interval '29 days', now() - interval '40 days');

insert into public.messages (id, organization_id, conversation_id, sender_membership_id, body, created_at)
values
  ('5ad10000-0000-0000-0000-0000000005d1', '5a900000-0000-0000-0000-0000000005a9',
   '5ac10000-0000-0000-0000-0000000005c1', '5a110000-0000-0000-0000-0000000005a1',
   'Eski', now() - interval '31 days'),
  ('5ad20000-0000-0000-0000-0000000005d2', '5a900000-0000-0000-0000-0000000005a9',
   '5ac20000-0000-0000-0000-0000000005c2', '5a110000-0000-0000-0000-0000000005a1',
   'Eski ama sohbet sürüyor', now() - interval '31 days'),
  ('5ad30000-0000-0000-0000-0000000005d3', '5a900000-0000-0000-0000-0000000005a9',
   '5ac20000-0000-0000-0000-0000000005c2', '5a310000-0000-0000-0000-0000000005a3',
   'Yeni', now() - interval '29 days');

insert into public.notifications (organization_id, user_id, kind, title, body, created_at)
values
  ('5a900000-0000-0000-0000-0000000005a9', '5a200000-0000-0000-0000-0000000005a2',
   'message', 'Yeni mesaj', 'Eski', now() - interval '31 days'),
  ('5a900000-0000-0000-0000-0000000005a9', '5a300000-0000-0000-0000-0000000005a3',
   'message', 'Yeni mesaj', 'Yeni', now() - interval '29 days'),
  ('5a900000-0000-0000-0000-0000000005a9', '5a200000-0000-0000-0000-0000000005a2',
   'homework', 'Ödev', null, now() - interval '31 days');

insert into public.client_error_reports (organization_id, kind, message, created_at)
values
  ('5a900000-0000-0000-0000-0000000005a9', 'error', 'saklama-eski', now() - interval '31 days'),
  ('5a900000-0000-0000-0000-0000000005a9', 'error', 'saklama-yeni', now() - interval '29 days');

insert into public.email_deliveries (user_id, kind, status, created_at)
values
  ('5a100000-0000-0000-0000-0000000005a1', 'password_reset', 'sent', now() - interval '31 days'),
  ('5a100000-0000-0000-0000-0000000005a1', 'password_reset', 'sent', now() - interval '29 days');

-- 5 · Panel süzgeci: temizlikten ÖNCE, eski kayıt tabloda dururken.
create function pg_temp.panelde(metin text) returns boolean language sql as $$
  select exists (
    select 1 from public.list_client_error_reports(null, 200) as r where r.message = metin
  );
$$;
-- Operatör kimliği taşımayan postgres rolüyle fonksiyon boş döner; süzgeci
-- operatör gibi sınamak için kimlik fonksiyonu geçici olarak doğru döndürülür.
create or replace function public.current_user_is_platform_operator()
returns boolean language sql stable as $$ select true $$;
create or replace function public.current_user_must_change_password()
returns boolean language sql stable as $$ select false $$;
select ok(pg_temp.panelde('saklama-yeni'), 'the error panel shows a 29-day-old report');
select ok(not pg_temp.panelde('saklama-eski'), 'the error panel hides a 31-day-old report before the purge runs');

select public.internal_purge_expired_records();

-- 8 · Silme izsiz kalmaz (20261116000000): yalnız sayılar yazılır.
select is(
  (select metadata from public.platform_audit_events
    where action = 'platform.retention_purged' and created_at >= now()),
  jsonb_build_object('messages', 2, 'message_notifications', 1, 'conversations', 1,
                     'client_error_reports', 1, 'email_deliveries', 1,
                     -- Kapı defteri (20261118000000): bu testte eski satır yok.
                     'function_calls', 0),
  'a purge that deleted something leaves a receipt with the counts only'
);
select public.internal_purge_expired_records();
select is(
  (select count(*) from public.platform_audit_events
    where action = 'platform.retention_purged' and created_at >= now()),
  1::bigint,
  'a purge that deleted nothing writes no receipt'
);

-- 1
select is(
  (select array_agg(body order by body) from public.messages
    where organization_id = '5a900000-0000-0000-0000-0000000005a9'),
  array['Yeni'],
  'messages older than 30 days are gone, younger ones stay'
);
-- 2
select is(
  (select array_agg(kind || ':' || coalesce(body, '-') order by kind, body) from public.notifications
    where organization_id = '5a900000-0000-0000-0000-0000000005a9'),
  array['homework:-', 'message:Yeni'],
  'old message notifications go with the message; other kinds stay'
);
-- 3
select is(
  (select array_agg(id) from public.conversations
    where organization_id = '5a900000-0000-0000-0000-0000000005a9'),
  array['5ac20000-0000-0000-0000-0000000005c2']::uuid[],
  'a conversation with no message left is gone; one with a recent message stays'
);
-- 4
select is(
  (select count(*) from public.client_error_reports where message like 'saklama-%'),
  1::bigint,
  'old screen error reports are purged without waiting for a new write'
);
select is(
  (select count(*) from public.email_deliveries where user_id = '5a100000-0000-0000-0000-0000000005a1'),
  1::bigint,
  'old mail ledger rows are purged without waiting for a new write'
);
-- 6
select is(
  (select schedule from cron.job where jobname = 'orbit-saklama-temizligi'),
  '0 0 * * *',
  'the nightly purge is scheduled at 00:00 UTC (03:00 Türkiye)'
);
select is(
  (select command from cron.job where jobname = 'orbit-saklama-temizligi'),
  'select public.internal_purge_expired_records()',
  'the nightly job calls the purge function and nothing else'
);
-- 7
select ok(
  not has_function_privilege('authenticated', 'public.internal_purge_expired_records()', 'EXECUTE'),
  'a signed-in user cannot run the purge'
);
select ok(
  not has_function_privilege('anon', 'public.internal_purge_expired_records()', 'EXECUTE'),
  'an anonymous caller cannot run the purge'
);

select * from finish();
rollback;
