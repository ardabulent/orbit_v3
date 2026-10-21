-- Issue #27 — Platform operatörü ekseninin doğrulanması.
--
-- En kritik testler sondakiler: platform operatörünün kurum İÇERİĞİNİ
-- göremediğini kanıtlarlar. Bu, `DECISION_LOG.md`'de KVKK gerekçesiyle verilen
-- "operatör kapları yönetir, içeriği görmez" taahhüdünün çalıştırılabilir
-- karşılığıdır ve ileride yanlışlıkla gevşetilirse burada kırılır.

begin;

create extension if not exists pgtap with schema extensions;
select plan(12);

-- Kurulum: bir platform operatörü, bir de kuruma bağlı sıradan kullanıcı.
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
values
  (
    '40000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'operator@example.test',
    '',
    now(),
    now()
  ),
  (
    '50000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'kurum-admin@example.test',
    '',
    now(),
    now()
  );

insert into public.platform_operators (user_id, role, status)
values ('40000000-0000-0000-0000-000000000004', 'owner', 'active');

insert into public.organizations (id, name, slug)
values ('66000000-0000-0000-0000-000000000006', 'Kurum C', 'kurum-c');

insert into public.branches (id, organization_id, name, is_default)
values (
  '66600000-0000-0000-0000-000000000006',
  '66000000-0000-0000-0000-000000000006',
  'C Şubesi',
  true
);

insert into public.organization_memberships (
  organization_id,
  branch_id,
  user_id,
  role,
  status
)
values (
  '66000000-0000-0000-0000-000000000006',
  null,
  '50000000-0000-0000-0000-000000000005',
  'admin',
  'active'
);

insert into public.platform_audit_events (actor_user_id, action, entity_type)
values (
  '40000000-0000-0000-0000-000000000004',
  'platform.operator_added',
  'platform_operator'
);

-- anon rolü --------------------------------------------------------------

set local role anon;

select throws_ok(
  $$select public.current_user_is_platform_operator()$$,
  '42501',
  null,
  'anon cannot execute current_user_is_platform_operator'
);

select throws_ok(
  $$select count(*) from public.platform_operators$$,
  '42501',
  null,
  'anon cannot read platform_operators'
);

select throws_ok(
  $$select count(*) from public.platform_audit_events$$,
  '42501',
  null,
  'anon cannot read platform_audit_events'
);

reset role;

-- Platform operatörü ------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '40000000-0000-0000-0000-000000000004',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select ok(
  public.current_user_is_platform_operator(),
  'an active operator is recognised as a platform operator'
);

select is(
  (select count(*) from public.platform_operators where created_at >= now()),
  1::bigint,
  'operator can read the operator list'
);

select is(
  (select count(*) from public.platform_audit_events where created_at >= now()),
  1::bigint,
  'operator can read platform audit events'
);

select throws_ok(
  $$insert into public.platform_operators (user_id, role, status)
    values ('50000000-0000-0000-0000-000000000005', 'owner', 'active')$$,
  '42501',
  null,
  'operator cannot grant platform access from the client'
);

select throws_ok(
  $$insert into public.platform_audit_events (actor_user_id, action, entity_type)
    values ('50000000-0000-0000-0000-000000000005', 'forged.event', 'test')$$,
  '42501',
  null,
  'operator cannot forge platform audit events'
);

-- KVKK taahhüdü: operatör kapları yönetir, içeriği görmez.
-- Operatörün hiçbir `organization_memberships` kaydı olmadığı için mevcut
-- tenant RLS politikaları onu zaten dışarıda tutar. Bu testler o davranışın
-- ileride sessizce gevşetilmesini engeller.
--
-- Sonradan düzeltme (2026-08-24, Issue #41): aşağıdaki ilk iddia `0` idi.
-- `20260824014500_platform_operator_reads.sql` ile kurum **kabı** operatöre
-- açıldı; kurum listesi olmadan panelin işlevi yok. Sınır kaymadı, netleşti:
-- operatör kurumun var olduğunu görür, içinde ne olduğunu görmez. Alttaki iki
-- iddia (şube ve üyelik) o sınırın bekçisidir ve kapalı kalır.

select is(
  (select count(*) from public.organizations where created_at >= now()),
  1::bigint,
  'platform operator can read the organization container'
);

select is(
  (select count(*) from public.branches),
  0::bigint,
  'platform operator cannot read any branch'
);

select is(
  (select count(*) from public.organization_memberships),
  0::bigint,
  'platform operator cannot read institution memberships'
);

reset role;

-- Kurum admini ------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '50000000-0000-0000-0000-000000000005',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (select count(*) from public.platform_operators),
  0::bigint,
  'an institution admin cannot see the platform operator list'
);

reset role;

select * from finish();

rollback;
