-- Dışa aktarma iz bırakır (2026-10-24, ana plan 2.4).
--
--   1. Yönetici dışa aktarmayı kaydeder; satır kim/ne/kaç taşır.
--   2. ⛔ Öğretmen kaydedemez (42501).
--   3. ⛔ Başka kurumun yöneticisi bu kurum adına kaydedemez (42501).
--   4. ⛔ Bilinmeyen veri kümesi reddedilir (22023).
--   5. ⛔ Boş seçim reddedilir (22023).
--   6. ⛔ İlk giriş kilidi açık yönetici kaydedemez (42501).
--   7. ⛔ Anonim çağıran fonksiyonu çalıştıramaz.

begin;

create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
select ('e' || n || '000000-0000-0000-0000-00000000e' || n || '00')::uuid,
       '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'disa-' || n || '@example.test', '', now(), now()
from generate_series(1, 4) as n;
-- 1 yönetici · 2 öğretmen · 3 başka kurumun yöneticisi · 4 kilitli yönetici

insert into public.organizations (id, name, slug, code)
values ('e9100000-0000-0000-0000-00000000e910', 'Dışa Aktarma Dershanesi', 'disa-aktarma', 7992),
       ('e9200000-0000-0000-0000-00000000e920', 'Komşu Dershane', 'komsu-disa', 7991);

insert into public.organization_memberships (organization_id, user_id, role, status)
values
  ('e9100000-0000-0000-0000-00000000e910', 'e1000000-0000-0000-0000-00000000e100', 'admin', 'active'),
  ('e9100000-0000-0000-0000-00000000e910', 'e2000000-0000-0000-0000-00000000e200', 'teacher', 'active'),
  ('e9200000-0000-0000-0000-00000000e920', 'e3000000-0000-0000-0000-00000000e300', 'admin', 'active'),
  ('e9100000-0000-0000-0000-00000000e910', 'e4000000-0000-0000-0000-00000000e400', 'admin', 'active');

update public.profiles set must_change_password = true
where id = 'e4000000-0000-0000-0000-00000000e400';

create function pg_temp.olarak(kisi uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', kisi::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
end;
$$;

set local role authenticated;

-- 1
select pg_temp.olarak('e1000000-0000-0000-0000-00000000e100');
select lives_ok(
  $$select public.record_data_export('e9100000-0000-0000-0000-00000000e910',
      array['students', 'payments'], '{"students": 120, "payments": 340}')$$,
  'an administrator records an export'
);
reset role;
select is(
  (select jsonb_build_object('actor', actor_user_id, 'action', action, 'meta', metadata)
     from public.audit_events
    where organization_id = 'e9100000-0000-0000-0000-00000000e910'
      and action = 'organization.data_exported'),
  jsonb_build_object(
    'actor', 'e1000000-0000-0000-0000-00000000e100',
    'action', 'organization.data_exported',
    'meta', '{"datasets": ["students", "payments"], "rows": {"students": 120, "payments": 340}}'::jsonb
  ),
  'the audit row says who exported which datasets and how many rows'
);
set local role authenticated;

-- 2
select pg_temp.olarak('e2000000-0000-0000-0000-00000000e200');
select throws_ok(
  $$select public.record_data_export('e9100000-0000-0000-0000-00000000e910', array['students'])$$,
  '42501', null,
  'a teacher cannot record an export'
);

-- 3
select pg_temp.olarak('e3000000-0000-0000-0000-00000000e300');
select throws_ok(
  $$select public.record_data_export('e9100000-0000-0000-0000-00000000e910', array['students'])$$,
  '42501', null,
  'another institution''s administrator cannot record an export here'
);

-- 4–5
select pg_temp.olarak('e1000000-0000-0000-0000-00000000e100');
select throws_ok(
  $$select public.record_data_export('e9100000-0000-0000-0000-00000000e910', array['passwords'])$$,
  '22023', null,
  'an unknown dataset is refused'
);
select throws_ok(
  $$select public.record_data_export('e9100000-0000-0000-0000-00000000e910', array[]::text[])$$,
  '22023', null,
  'an empty selection is refused'
);

-- 6
select pg_temp.olarak('e4000000-0000-0000-0000-00000000e400');
select throws_ok(
  $$select public.record_data_export('e9100000-0000-0000-0000-00000000e910', array['students'])$$,
  '42501', null,
  'an administrator still behind the first-login lock cannot record an export'
);

-- 7
reset role;
select ok(
  not has_function_privilege('anon', 'public.record_data_export(uuid, text[], jsonb)', 'EXECUTE'),
  'an anonymous caller cannot run the function'
);

select * from finish();
rollback;
