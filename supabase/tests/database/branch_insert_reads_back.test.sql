-- Yeni şube, ekleyen yöneticiye aynı sorguda geri döner (2026-11-24).
--
-- 🔴 5.1'den (#504) beri `branches_select_member` görünür şubeleri
-- `branches` tablosundan, sorgu başında bir kez sayıyordu. Arayüz şubeyi
-- `insert(...).select()` ile ekliyor (`branchService.createBranch`); yeni satır
-- o listede olmadığı için RETURNING okuma kuralına takılıyor ve ekleme
-- "new row violates row-level security policy" ile geri alınıyordu.
--
-- Görünürlük değişmez: kurum geneli üye kurumun her şubesini, şubeli üye
-- yalnız kendi şubesini görür (3–5).

begin;

create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
values
  ('d1100000-0000-0000-0000-0000000d1101', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'sube-yonetici@example.test', '', now(), now()),
  ('d1100000-0000-0000-0000-0000000d1102', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'sube-ogretmen@example.test', '', now(), now()),
  ('d1100000-0000-0000-0000-0000000d1103', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'sube-komsu@example.test', '', now(), now());

insert into public.organizations (id, name, slug, code)
values
  ('d1200000-0000-0000-0000-0000000d1201', 'Şube Dershanesi', 'sube-dershanesi', 7963),
  ('d1200000-0000-0000-0000-0000000d1202', 'Şube Komşusu', 'sube-komsusu', 7964);

insert into public.branches (id, organization_id, name, is_default)
values
  ('d1300000-0000-0000-0000-0000000d1301', 'd1200000-0000-0000-0000-0000000d1201', 'Merkez', true),
  ('d1300000-0000-0000-0000-0000000d1302', 'd1200000-0000-0000-0000-0000000d1201', 'Kadıköy', false),
  ('d1300000-0000-0000-0000-0000000d1303', 'd1200000-0000-0000-0000-0000000d1202', 'Komşu Merkez', true);

insert into public.organization_memberships (organization_id, branch_id, user_id, role, status)
values
  ('d1200000-0000-0000-0000-0000000d1201', null,
   'd1100000-0000-0000-0000-0000000d1101', 'admin', 'active'),
  ('d1200000-0000-0000-0000-0000000d1201', 'd1300000-0000-0000-0000-0000000d1302',
   'd1100000-0000-0000-0000-0000000d1102', 'teacher', 'active'),
  ('d1200000-0000-0000-0000-0000000d1202', null,
   'd1100000-0000-0000-0000-0000000d1103', 'admin', 'active');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'd1100000-0000-0000-0000-0000000d1101', true);

-- 1 · Arayüzün yazma biçimi: ekle ve geri oku
select lives_ok(
  $$insert into public.branches (organization_id, name)
    values ('d1200000-0000-0000-0000-0000000d1201', 'Üsküdar') returning id, name$$,
  'an admin adds a branch and reads it back in the same statement'
);

-- 2 · Eklenen şube listede
select is(
  (select count(*) from public.branches where name = 'Üsküdar'),
  1::bigint,
  'the new branch is visible to the admin who added it'
);

-- 3 · Kurum geneli üye kendi kurumunun bütün şubelerini görür, komşuyu görmez
select is(
  (select string_agg(name, ', ' order by name) from public.branches),
  'Kadıköy, Merkez, Üsküdar',
  'an organization-wide member sees every branch of their own organization only'
);

-- 4 · Şubeli üye yalnız kendi şubesini görür
select set_config('request.jwt.claim.sub', 'd1100000-0000-0000-0000-0000000d1102', true);
select is(
  (select string_agg(name, ', ' order by name) from public.branches),
  'Kadıköy',
  'a branch-bound member sees only their own branch'
);

-- 5 · Komşu kurum yalnız kendi şubesini görür
select set_config('request.jwt.claim.sub', 'd1100000-0000-0000-0000-0000000d1103', true);
select is(
  (select string_agg(name, ', ' order by name) from public.branches),
  'Komşu Merkez',
  'an admin of another institution sees none of these branches'
);

select * from finish();
rollback;
