-- v1.4-09 — Şube açılabilir; kapatılmadan önce boşaltılmalı (#284).
--
-- Dört iddia kümesi:
--
--   1. Yazma yolu açıldı ama YALNIZ yöneticiye; okuma herkese açık kaldı.
--   2. Ad tekilliği artık kısmi — arşivlenen şube adını bırakıyor. Bu,
--      `installments`'ta ölçülen tuzağın aynısıydı.
--   3. `is_default` bir anlam kazandı: kurum başına en fazla bir aktif
--      varsayılan ve devretmek TEK işlemde oluyor (arada varsayılansız
--      kalınmıyor).
--   4. Dolu şube kapatılamıyor — ve asıl ölçüm bu: `RESTRICT` yabancı
--      anahtarları yalnız DELETE'i engelliyordu, arşivi hiçbir şey sınamıyordu.

begin;

create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
values
  ('c1100000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'sube-yonetici@example.test', '', now(), now()),
  ('c2200000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'sube-ogretmen@example.test', '', now(), now());

insert into public.organizations (id, name, slug, code)
values ('cd000000-0000-0000-0000-0000000000cd', 'Kurum Sube', 'kurum-sube-v1409', 8001);

insert into public.branches (id, organization_id, name, is_default)
values ('cd100000-0000-0000-0000-0000000011cd', 'cd000000-0000-0000-0000-0000000000cd',
        'Merkez Sube', true);

insert into public.organization_memberships
  (id, organization_id, branch_id, user_id, role, status, person_code)
values
  ('3b000000-0000-0000-0000-000000000001', 'cd000000-0000-0000-0000-0000000000cd', null,
   'c1100000-0000-0000-0000-0000000000c1', 'admin', 'active', 1700),
  ('3b000000-0000-0000-0000-000000000002', 'cd000000-0000-0000-0000-0000000000cd',
   'cd100000-0000-0000-0000-0000000011cd', 'c2200000-0000-0000-0000-0000000000c2',
   'teacher', 'active', 1701);

-- =========================================================================
-- Yazma yolu: yalnız yönetici
-- =========================================================================

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'c2200000-0000-0000-0000-0000000000c2', true);

select is(
  (select count(*) from public.branches),
  1::bigint,
  'a teacher can still READ the branches of their organization'
);

select throws_ok(
  $sql$insert into public.branches (organization_id, name)
       values ('cd000000-0000-0000-0000-0000000000cd', 'Ogretmenin Subesi')$sql$,
  '42501',
  null,
  'but a teacher cannot open a branch'
);

select set_config('request.jwt.claim.sub', 'c1100000-0000-0000-0000-0000000000c1', true);

select lives_ok(
  $sql$insert into public.branches (organization_id, name)
       values ('cd000000-0000-0000-0000-0000000000cd', 'Kadikoy Subesi')$sql$,
  'an administrator can open a second branch — this is what the slice unlocks'
);

-- `id` salt okunur: istemci kimlik göndermez.
select throws_ok(
  $sql$insert into public.branches (id, organization_id, name)
       values ('cd900000-0000-0000-0000-0000000099cd',
               'cd000000-0000-0000-0000-0000000000cd', 'Kimlikli Sube')$sql$,
  '42501',
  null,
  'and cannot supply the id — the database owns identity'
);

reset role;

-- =========================================================================
-- Ad tekilliği kısmi
-- =========================================================================

select throws_ok(
  $sql$insert into public.branches (organization_id, name)
       values ('cd000000-0000-0000-0000-0000000000cd', 'Kadikoy Subesi')$sql$,
  '23505',
  null,
  'two ACTIVE branches cannot share a name'
);

-- =========================================================================
-- Varsayılan şube — en fazla bir tane, devir tek işlemde
-- =========================================================================

select is(
  (select count(*) from public.branches
   where organization_id = 'cd000000-0000-0000-0000-0000000000cd'
     and is_default and archived_at is null),
  1::bigint,
  'exactly one branch is the default after the second one is opened'
);

select is(
  (select name from public.branches
   where organization_id = 'cd000000-0000-0000-0000-0000000000cd'
     and is_default and archived_at is null),
  'Merkez Sube',
  'and it is still the first one — opening a branch does not steal the default'
);

-- Devir TEK bir UPDATE ile. Tetikleyici eskisini temizliyor; istemci iki
-- adımda yapsaydı arada kurum varsayılansız kalırdı.
update public.branches
set is_default = true
where organization_id = 'cd000000-0000-0000-0000-0000000000cd'
  and name = 'Kadikoy Subesi';

select is(
  (select count(*) from public.branches
   where organization_id = 'cd000000-0000-0000-0000-0000000000cd'
     and is_default and archived_at is null),
  1::bigint,
  'handing the default over leaves exactly one default — never zero, never two'
);

select is(
  (select name from public.branches
   where organization_id = 'cd000000-0000-0000-0000-0000000000cd'
     and is_default and archived_at is null),
  'Kadikoy Subesi',
  'and it is the new one'
);

select is(
  (select count(*) from public.audit_events
   where entity_type = 'branch' and action = 'branch.updated'
     and metadata -> 'changed' @> '["is_default"]'::jsonb),
  2::bigint,
  'both sides of the handover are in the ledger — who lost it and who gained it'
);

-- =========================================================================
-- Dolu şube kapatılamaz — asıl ölçüm
-- =========================================================================

insert into public.students (id, organization_id, branch_id, full_name)
values ('5c000000-0000-0000-0000-00000000c001', 'cd000000-0000-0000-0000-0000000000cd',
        'cd100000-0000-0000-0000-0000000011cd', 'Merkezin Ogrencisi');

select throws_ok(
  $sql$update public.branches set archived_at = now()
       where id = 'cd100000-0000-0000-0000-0000000011cd'$sql$,
  'ORB03',
  null,
  'a branch holding an active student cannot be archived'
);

select is(
  (select archived_at from public.branches
   where id = 'cd100000-0000-0000-0000-0000000011cd'),
  null::timestamptz,
  'and the refusal really left it open'
);

-- Öğrenci taşınınca öğretmen üyeliği hâlâ orada: sayım üç kaynağı da topluyor.
update public.students
set branch_id = (select id from public.branches
                 where organization_id = 'cd000000-0000-0000-0000-0000000000cd'
                   and name = 'Kadikoy Subesi')
where id = '5c000000-0000-0000-0000-00000000c001';

select throws_ok(
  $sql$update public.branches set archived_at = now()
       where id = 'cd100000-0000-0000-0000-0000000011cd'$sql$,
  'ORB03',
  null,
  'the membership still there blocks it — the count sums students, classes AND memberships'
);

-- Askıya alınmış üyelik sayılmıyor: kurumdan çıkarılmış biri şubeyi tutmaz.
update public.organization_memberships
set status = 'suspended'
where id = '3b000000-0000-0000-0000-000000000002';

select lives_ok(
  $sql$update public.branches set archived_at = now()
       where id = 'cd100000-0000-0000-0000-0000000011cd'$sql$,
  'once emptied, the branch can be archived — a suspended membership does not hold it'
);

select is(
  (select count(*) from public.audit_events
   where entity_id = 'cd100000-0000-0000-0000-0000000011cd'
     and action = 'branch.archived'),
  1::bigint,
  'archiving a branch is its own action in the ledger'
);

-- Arşivlenen şube adını BIRAKIYOR — installments'taki tuzağın çözümü.
select lives_ok(
  $sql$insert into public.branches (organization_id, name)
       values ('cd000000-0000-0000-0000-0000000000cd', 'Merkez Sube')$sql$,
  'the archived name can be used again — the unique index is partial'
);

-- =========================================================================
-- Son şube ve varsayılan şube korumaları
-- =========================================================================

-- Şu an: "Kadikoy Subesi" (varsayılan, öğrencisi var) ve yeni "Merkez Sube".
select throws_ok(
  $sql$update public.branches set archived_at = now()
       where organization_id = 'cd000000-0000-0000-0000-0000000000cd'
         and name = 'Kadikoy Subesi'$sql$,
  'ORB03',
  null,
  'the default branch cannot be archived while another active branch exists'
);

-- Öğrenciyi de taşıyıp varsayılanı devredince kapatılabilir hale geliyor.
update public.students
set branch_id = (select id from public.branches
                 where organization_id = 'cd000000-0000-0000-0000-0000000000cd'
                   and name = 'Merkez Sube' and archived_at is null)
where id = '5c000000-0000-0000-0000-00000000c001';

update public.branches
set is_default = true
where organization_id = 'cd000000-0000-0000-0000-0000000000cd'
  and name = 'Merkez Sube' and archived_at is null;

select lives_ok(
  $sql$update public.branches set archived_at = now()
       where organization_id = 'cd000000-0000-0000-0000-0000000000cd'
         and name = 'Kadikoy Subesi'$sql$,
  'after handing the default over and moving the student, it can be archived'
);

select is(
  (select count(*) from public.branches
   where organization_id = 'cd000000-0000-0000-0000-0000000000cd'
     and archived_at is null),
  1::bigint,
  'one active branch remains'
);

-- Ve o son şube kapatılamıyor — kurum şubesiz kalırdı.
update public.students
set branch_id = null
where id = '5c000000-0000-0000-0000-00000000c001';

select throws_ok(
  $sql$update public.branches set archived_at = now()
       where organization_id = 'cd000000-0000-0000-0000-0000000000cd'
         and archived_at is null$sql$,
  'ORB03',
  null,
  'the last active branch cannot be archived even when empty'
);

-- =========================================================================
-- Denetim ve yayın
-- =========================================================================

select is(
  (select count(*) from public.audit_events
   where entity_type = 'branch' and action = 'branch.created'
     and created_at >= now()),  -- yalnız bu işlemde yazılanlar; yerel örnek veri karışmaz
  3::bigint,
  'every branch that was opened left a trace'
);

select is(
  (select metadata ->> 'name' from public.audit_events
   where entity_id = 'cd100000-0000-0000-0000-0000000011cd'
     and action = 'branch.created'),
  'Merkez Sube',
  'and the trace carries the name it was opened with'
);

select ok(
  (select count(*) from realtime.messages
   where topic = 'org:cd000000-0000-0000-0000-0000000000cd'
     and payload ->> 'table' = 'branches') > 0,
  'branch changes broadcast to the organization channel'
);

select is(
  (select count(*) from realtime.messages
   where topic <> 'org:cd000000-0000-0000-0000-0000000000cd'
     and payload ->> 'table' = 'branches'
     and inserted_at >= now()),
  0::bigint,
  'and no branch message leaks to another organization'
);

select * from finish();
rollback;
