-- Şifre değişimi denetim kaydı (2026-09-29): `record_own_password_change`.
--
-- ⚠️ Bu test ilk yazımında `auth.users`'ı oturum kimliğini elle koyarak
-- güncelliyordu ve geçiyordu — ama tarayıcıdan yapılan gerçek değişimde hiç
-- kayıt düşmedi, çünkü GoTrue şifreyi `auth.uid()` boş bir bağlantıyla yazar.
-- Test gerçekte OLMAYAN bir durumu sınıyordu. Şimdi GoTrue'nun gerçekte
-- yaptığını taklit ediyor: `auth.audit_log_entries`'e olay satırı yazıyor
-- (biçim 2026-09-29'da yerel GoTrue'dan ölçüldü).
--
--   1. `user_updated_password` → kişinin etkin üyeliği olan HER kuruma
--      `account.password_changed` (iki kurum → iki kayıt).
--   2. ⛔ Askıdaki üyeliğin kurumuna yazılmaz.
--   3. ⛔ Kayıtta şifreye dair hiçbir şey yok (`metadata` boş).
--   4. ⛔ `user_modified` (yönetici arayüzüyle konan şifre) kayıt YAZMAZ —
--      Edge Function kendi `membership.password_reset` kaydını yazıyor.
--   5. ⛔ Bozuk olay satırı (actor_id uuid değil) hata fırlatmaz — kullanıcının
--      işlemi denetim yüzünden düşmemeli.
--   6. Tetikleyiciyi istemci çağıramaz (fonksiyon hiçbir role açık değil).

begin;

create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
values
  ('d0110000-0000-0000-0000-0000000d0110', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'sd-uye@example.test', '', now(), now());

insert into public.organizations (id, name, slug, code)
values
  ('d0210000-0000-0000-0000-0000000d0210', 'Şifre Bir', 'sifre-bir', 7997),
  ('d0220000-0000-0000-0000-0000000d0220', 'Şifre İki', 'sifre-iki', 7998),
  ('d0230000-0000-0000-0000-0000000d0230', 'Şifre Askı', 'sifre-aski', 7999);

insert into public.organization_memberships (id, organization_id, user_id, role, status)
values
  ('d0310000-0000-0000-0000-0000000d0310', 'd0210000-0000-0000-0000-0000000d0210',
   'd0110000-0000-0000-0000-0000000d0110', 'teacher', 'active'),
  ('d0320000-0000-0000-0000-0000000d0320', 'd0220000-0000-0000-0000-0000000d0220',
   'd0110000-0000-0000-0000-0000000d0110', 'teacher', 'active'),
  ('d0330000-0000-0000-0000-0000000d0330', 'd0230000-0000-0000-0000-0000000d0230',
   'd0110000-0000-0000-0000-0000000d0110', 'teacher', 'suspended');

-- GoTrue: kişi kendi şifresini değiştirdi
insert into auth.audit_log_entries (instance_id, id, payload, created_at)
values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(),
        json_build_object('action', 'user_updated_password',
                          'actor_id', 'd0110000-0000-0000-0000-0000000d0110',
                          'log_type', 'user'),
        now());

-- 1 · İki etkin kuruma birer kayıt
select is(
  (select string_agg(organization_id::text, ',' order by organization_id)
     from public.audit_events
    where action = 'account.password_changed'
      and actor_user_id = 'd0110000-0000-0000-0000-0000000d0110'),
  'd0210000-0000-0000-0000-0000000d0210,d0220000-0000-0000-0000-0000000d0220',
  'a user_updated_password event leaves a trace in every active institution'
);

-- 2 · Askıdaki kuruma yok
select is(
  (select count(*) from public.audit_events
    where action = 'account.password_changed'
      and organization_id = 'd0230000-0000-0000-0000-0000000d0230'),
  0::bigint,
  'a suspended membership''s institution gets no record'
);

-- 3 · Şifreye dair hiçbir şey yok
select is(
  (select string_agg(distinct metadata::text, ',') from public.audit_events
    where action = 'account.password_changed'
      and actor_user_id = 'd0110000-0000-0000-0000-0000000d0110'),
  '{}',
  'the record carries nothing about the password'
);

-- 4 · user_modified → kayıt yok. Hem yöneticinin konduğu şifre hem kişinin
--     kendi bilgisini değiştirmesi bu olayı yazar; ikincisinde yapan
--     kişinin kendisidir, bu yüzden actor_id üyenin kendisi — süzgeç
--     kaldırılırsa kayıt çıkar ve test kırmızıya döner.
insert into auth.audit_log_entries (instance_id, id, payload, created_at)
values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(),
        json_build_object('action', 'user_modified',
                          'actor_id', 'd0110000-0000-0000-0000-0000000d0110',
                          'log_type', 'user'),
        now());

select is(
  (select count(*) from public.audit_events
    where action = 'account.password_changed'
      and organization_id in ('d0210000-0000-0000-0000-0000000d0210',
                              'd0220000-0000-0000-0000-0000000d0220',
                              'd0230000-0000-0000-0000-0000000d0230')),
  2::bigint,
  'an admin-set password (user_modified) writes no password_changed record'
);

-- 5 · Bozuk olay satırı hata fırlatmaz
select lives_ok(
  $$insert into auth.audit_log_entries (instance_id, id, payload, created_at)
    values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(),
            json_build_object('action', 'user_updated_password', 'actor_id', 'bozuk'),
            now())$$,
  'a malformed auth event never breaks the user''s own operation'
);

-- 6 · Fonksiyon hiçbir role açık değil
select is(
  (select has_function_privilege('authenticated', 'public.record_own_password_change()', 'execute')
       or has_function_privilege('anon', 'public.record_own_password_change()', 'execute')),
  false,
  'no client role can call the trigger function directly'
);

select * from finish();
rollback;
