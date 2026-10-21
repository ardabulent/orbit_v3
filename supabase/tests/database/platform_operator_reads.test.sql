-- Issue #41 — Platform panelinin okuma yolunun sınırlarının doğrulanması.
--
-- `20260824014500_platform_operator_reads.sql` operatöre iki yeni okuma izni
-- verir. Bu dosyanın asıl işi izinlerin çalıştığını göstermek değil,
-- **nerede bittiğini** göstermektir. En kritik test, operatörün kurum
-- kullanıcılarının adını okuyamadığını kanıtlayandır: `profiles` politikasının
-- sağ koşulu düşerse operatör sistemdeki her öğrencinin ve velinin adını
-- görebilir hale gelir ve bu test o anda kırılır.

begin;

create extension if not exists pgtap with schema extensions;
select plan(9);

-- Kurulum: iki operatör (biri askıya alınmış), bir kurum, bir kurum kullanıcısı.
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
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'aktif-operator@example.test',
    '',
    now(),
    now()
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'askidaki-operator@example.test',
    '',
    now(),
    now()
  ),
  (
    '30000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    '90001000@orbit.invalid',
    '',
    now(),
    now()
  );

-- `handle_new_auth_user` tetikleyicisi profilleri kendisi oluşturur; adları
-- testin okunabilirliği için sabitliyoruz.
update public.profiles
set display_name = 'Aktif Operatör'
where id = '10000000-0000-0000-0000-000000000001';

update public.profiles
set display_name = 'Askıdaki Operatör'
where id = '20000000-0000-0000-0000-000000000002';

update public.profiles
set display_name = 'Kurum Öğrencisi'
where id = '30000000-0000-0000-0000-000000000003';

insert into public.platform_operators (user_id, role, status)
values
  ('10000000-0000-0000-0000-000000000001', 'owner', 'active'),
  ('20000000-0000-0000-0000-000000000002', 'operator', 'suspended');

insert into public.organizations (id, name, slug)
values ('77000000-0000-0000-0000-000000000007', 'Kurum D', 'kurum-d');

insert into public.branches (organization_id, name, is_default)
values ('77000000-0000-0000-0000-000000000007', 'D Merkez', true);

insert into public.organization_memberships (
  organization_id,
  branch_id,
  user_id,
  role,
  status
)
values (
  '77000000-0000-0000-0000-000000000007',
  null,
  '30000000-0000-0000-0000-000000000003',
  'student',
  'active'
);

-- Aktif operatör ----------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (select count(*) from public.organizations where created_at >= now()),
  1::bigint,
  'active operator can list organizations'
);

select is(
  (select code from public.organizations limit 1) between 1000 and 9999,
  true,
  'the organization code the panel displays is readable'
);

-- Kap açıldı, içerik açılmadı.
select is(
  (select count(*) from public.branches),
  0::bigint,
  'opening organizations did not open branches'
);

select is(
  (select count(*) from public.organization_memberships),
  0::bigint,
  'opening organizations did not open memberships'
);

select is(
  (select count(*) from public.profiles where id = '10000000-0000-0000-0000-000000000001'),
  1::bigint,
  'operator can read their own profile'
);

select is(
  (select count(*) from public.profiles where id = '20000000-0000-0000-0000-000000000002'),
  1::bigint,
  'operator can read another operator profile for the operator list'
);

-- 🔴 En kritik iddia. Politikanın sağ koşulu düşerse burası kırılır.
select is(
  (select count(*) from public.profiles where id = '30000000-0000-0000-0000-000000000003'),
  0::bigint,
  'operator cannot read the profile of an institution user'
);

reset role;

-- Askıya alınmış operatör -------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '20000000-0000-0000-0000-000000000002',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- `current_user_is_platform_operator()` yalnızca `status = 'active'` sayar.
-- Askıya almanın erişimi gerçekten kestiğini burada sabitliyoruz; aksi halde
-- "askıya aldık" demek yalnızca bir etiket olurdu.
select is(
  (select count(*) from public.organizations),
  0::bigint,
  'a suspended operator loses the organization list'
);

select is(
  (select count(*) from public.profiles where id = '10000000-0000-0000-0000-000000000001'),
  0::bigint,
  'a suspended operator loses the operator directory'
);

reset role;

select * from finish();

rollback;
