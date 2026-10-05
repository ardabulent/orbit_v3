-- Ekran hatası kaydı (2026-10-05, v1.5-06).
--
--   1. Kurum üyesi hata yazabilir; kurumu kayda düşer.
--   2. E-posta ve 6+ haneli sayı ayıklanır; adres yolundan sorgu atılır.
--   3. ⛔ Kullanıcı tabloyu doğrudan okuyamaz, yazamaz.
--   4. ⛔ Operatör olmayan liste fonksiyonundan satır almaz.
--   5. Platform operatörü listeyi görür (kurum adıyla).
--   6. ⛔ Kilitli operatör satır almaz.
--   7. Kişi başına saatte 30: 31. kayıt düşer.
--   8. Anonim çağrı fonksiyonu çalıştıramaz.
--   9. Bilinmeyen tür ve boş mesaj sessizce düşer.
--  10. 30 günden eski kayıt bir sonraki yazmada ayıklanır.

begin;

create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
values
  ('e1100000-0000-0000-0000-0000000e1100', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'hk-uye@example.test', '', now(), now()),
  ('e1200000-0000-0000-0000-0000000e1200', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'hk-operator@example.test', '', now(), now());

insert into public.organizations (id, name, slug, code)
values ('e2100000-0000-0000-0000-0000000e2100', 'Hata Dershanesi', 'hata-dershanesi', 8920);

insert into public.organization_memberships (organization_id, user_id, role, status)
values ('e2100000-0000-0000-0000-0000000e2100', 'e1100000-0000-0000-0000-0000000e1100', 'teacher', 'active');

insert into public.platform_operators (user_id, role, status)
values ('e1200000-0000-0000-0000-0000000e1200', 'owner', 'active');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

-- 1–2 · Üye yazar
select set_config('request.jwt.claim.sub', 'e1100000-0000-0000-0000-0000000e1100', true);
select lives_ok(
  $$select public.report_client_error(
      'error',
      'Ayşe ayse.koc@example.test için 78018106 kaydı bulunamadı',
      'at x (app.js:1:1)',
      '/ogrenciler?ara=78018106#detay',
      'abc123',
      'Mozilla/5.0'
    )$$,
  'a member can report an error'
);

reset role;
select is(
  (select message from public.client_error_reports
    where user_id = 'e1100000-0000-0000-0000-0000000e1100'),
  'Ayşe [e-posta] için [sayı] kaydı bulunamadı',
  'e-mail and long numbers are scrubbed on the server'
);
select is(
  (select path from public.client_error_reports
    where user_id = 'e1100000-0000-0000-0000-0000000e1100'),
  '/ogrenciler',
  'query string and fragment are dropped from the path'
);
select is(
  (select organization_id from public.client_error_reports
    where user_id = 'e1100000-0000-0000-0000-0000000e1100'),
  'e2100000-0000-0000-0000-0000000e2100'::uuid,
  'the reporter''s institution is recorded'
);

-- 3 · Doğrudan erişim yok
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e1100000-0000-0000-0000-0000000e1100', true);
select throws_ok(
  $$select count(*) from public.client_error_reports$$,
  '42501', null,
  'a user cannot read the table directly'
);
select throws_ok(
  $$insert into public.client_error_reports (kind, message) values ('error', 'x')$$,
  '42501', null,
  'a user cannot write the table directly'
);

-- 4 · Operatör olmayan
select is(
  (select count(*) from public.list_client_error_reports()),
  0::bigint,
  'a non-operator gets no rows from the list'
);

-- 5 · Operatör
select set_config('request.jwt.claim.sub', 'e1200000-0000-0000-0000-0000000e1200', true);
select is(
  (select organization_name from public.list_client_error_reports()
    where message like 'Ayşe%'),
  'Hata Dershanesi',
  'a platform operator sees the report with the institution name'
);

-- 6 · Kilitli operatör
reset role;
update public.profiles set must_change_password = true
 where id = 'e1200000-0000-0000-0000-0000000e1200';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e1200000-0000-0000-0000-0000000e1200', true);
select is(
  (select count(*) from public.list_client_error_reports()),
  0::bigint,
  'a locked operator gets no rows'
);

-- 7 · Hız sınırı (bir kayıt zaten var; 35 deneme daha → toplam 30)
select set_config('request.jwt.claim.sub', 'e1100000-0000-0000-0000-0000000e1100', true);
select public.report_client_error('error', 'tekrar ' || n) from generate_series(1, 35) as n;
reset role;
select is(
  (select count(*) from public.client_error_reports
    where user_id = 'e1100000-0000-0000-0000-0000000e1100'),
  30::bigint,
  'at most thirty reports per person per hour'
);

-- 8 · Anonim
set local role anon;
select throws_ok(
  $$select public.report_client_error('error', 'x')$$,
  '42501', null,
  'anon cannot report'
);

-- 9 · Geçersiz girdi düşer (hız sınırının dışında, yeni kullanıcıyla)
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e1200000-0000-0000-0000-0000000e1200', true);
select public.report_client_error('başka', 'x');
select public.report_client_error('error', '   ');
reset role;
select is(
  (select count(*) from public.client_error_reports
    where user_id = 'e1200000-0000-0000-0000-0000000e1200'),
  0::bigint,
  'an unknown kind and an empty message are dropped'
);

-- 10 · Saklama
update public.client_error_reports
   set created_at = now() - interval '31 days'
 where message = 'tekrar 1';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e1200000-0000-0000-0000-0000000e1200', true);
select public.report_client_error('render', 'yeni kayıt');
reset role;
select is(
  (select count(*) from public.client_error_reports where message = 'tekrar 1'),
  0::bigint,
  'a report older than thirty days is pruned on the next write'
);

select * from finish();
rollback;
