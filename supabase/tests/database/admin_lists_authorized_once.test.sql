-- Sınıf, üyelik ve profil listeleri sorgu başına bir kez yetkilendirilir
-- (2026-10-17, göç 20261106000000, Hız 2).
--
-- Göç üç tablonun rol başına okuma kurallarını tek bir kurala indirdi.
-- Eşdeğerlik yerel veride geniş bir kullanıcı kümesiyle ölçüldü; bu dosya en
-- ince dalları kalıcı olarak kilitler:
--
--   1–3   Şubeye bağlı yönetici kendi şubesinin ve şubesiz sınıfları görür;
--         ⛔ başka şubenin sınıfını görmez. Kurum yöneticisi hepsini.
--   4     Öğretmen yalnız okuttuğu sınıfı görür.
--   5–7   Şube yöneticisi kendi şubesinin ve şubesiz üyelikleri görür,
--         ⛔ başka şubenin üyeliğini görmez; kurum yöneticisi hepsini;
--         öğretmen yalnız kendi üyeliğini.
--   8–9   Yönetici kurumundaki herkesin profilini görür; öğretmen kendi
--         profilini ve aynı kişiye bağlı öbür hesabını görür, ⛔ meslektaşını
--         görmez.
--   10–12 Şifresi kilitli yönetici yalnız kendi üyeliğini ve profilini görür,
--         ⛔ hiçbir sınıfı görmez.
--   13    Operatör başka bir operatörün profilini görür, ⛔ kurum üyesininkini
--         görmez.
--   14    Üç tablonun her birinde tek okuma kuralı var.
--   15    Yeni dizi fonksiyonlarını ⛔ anon çağıramaz.

begin;

create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
select ('f1' || n || '00000-0000-0000-0000-0000000f1' || n || '00')::uuid,
       '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'al-' || n || '@example.test', '', now(), now()
from generate_series(1, 9) as n;
-- 1 kurum yöneticisi · 2 şube (Merkez) yöneticisi · 3 öğretmen · 4 öğrenci
-- 5 Kuzey şubesinin velisi · 6 kilitli yönetici · 7 öğretmenin başka kurumdaki
-- ikinci hesabı · 8 operatör · 9 ikinci operatör

insert into public.organizations (id, name, slug, code)
values ('f2100000-0000-0000-0000-0000000f2100', 'Yönetici Dershanesi', 'yonetici-dershanesi', 8941),
       ('f2900000-0000-0000-0000-0000000f2900', 'Öbür Dershane', 'obur-dershane', 8942);

insert into public.branches (id, organization_id, name)
values ('f2200000-0000-0000-0000-0000000f2200', 'f2100000-0000-0000-0000-0000000f2100', 'Merkez'),
       ('f2300000-0000-0000-0000-0000000f2300', 'f2100000-0000-0000-0000-0000000f2100', 'Kuzey');

insert into public.organization_memberships (id, organization_id, branch_id, user_id, role, status)
values
  ('f3100000-0000-0000-0000-0000000f3100', 'f2100000-0000-0000-0000-0000000f2100', null,
   'f1100000-0000-0000-0000-0000000f1100', 'admin', 'active'),
  ('f3200000-0000-0000-0000-0000000f3200', 'f2100000-0000-0000-0000-0000000f2100', 'f2200000-0000-0000-0000-0000000f2200',
   'f1200000-0000-0000-0000-0000000f1200', 'admin', 'active'),
  ('f3300000-0000-0000-0000-0000000f3300', 'f2100000-0000-0000-0000-0000000f2100', null,
   'f1300000-0000-0000-0000-0000000f1300', 'teacher', 'active'),
  ('f3400000-0000-0000-0000-0000000f3400', 'f2100000-0000-0000-0000-0000000f2100', 'f2200000-0000-0000-0000-0000000f2200',
   'f1400000-0000-0000-0000-0000000f1400', 'student', 'active'),
  ('f3500000-0000-0000-0000-0000000f3500', 'f2100000-0000-0000-0000-0000000f2100', 'f2300000-0000-0000-0000-0000000f2300',
   'f1500000-0000-0000-0000-0000000f1500', 'parent', 'active'),
  ('f3600000-0000-0000-0000-0000000f3600', 'f2100000-0000-0000-0000-0000000f2100', null,
   'f1600000-0000-0000-0000-0000000f1600', 'admin', 'active'),
  ('f3700000-0000-0000-0000-0000000f3700', 'f2900000-0000-0000-0000-0000000f2900', null,
   'f1700000-0000-0000-0000-0000000f1700', 'teacher', 'active');

insert into public.platform_operators (user_id, role, status)
values ('f1800000-0000-0000-0000-0000000f1800', 'operator', 'active'),
       ('f1900000-0000-0000-0000-0000000f1900', 'operator', 'active');

-- Öğretmen (3) ile öbür kurumdaki hesabı (7) aynı kişi.
insert into public.people (id) values ('f4100000-0000-0000-0000-0000000f4100');
update public.profiles set person_id = 'f4100000-0000-0000-0000-0000000f4100'
where id in ('f1300000-0000-0000-0000-0000000f1300', 'f1700000-0000-0000-0000-0000000f1700');

update public.profiles set must_change_password = true
where id = 'f1600000-0000-0000-0000-0000000f1600';

-- Sınıflar: Merkez, Kuzey, şubesiz. Öğretmen yalnız şubesiz sınıfın rehberi.
insert into public.classes (id, organization_id, branch_id, name, mentor_membership_id)
values ('f5100000-0000-0000-0000-0000000f5100', 'f2100000-0000-0000-0000-0000000f2100',
        'f2200000-0000-0000-0000-0000000f2200', 'Merkez-1', null),
       ('f5200000-0000-0000-0000-0000000f5200', 'f2100000-0000-0000-0000-0000000f2100',
        'f2300000-0000-0000-0000-0000000f2300', 'Kuzey-1', null),
       ('f5300000-0000-0000-0000-0000000f5300', 'f2100000-0000-0000-0000-0000000f2100',
        null, 'Genel-1', 'f3300000-0000-0000-0000-0000000f3300');

-- Kişinin gözüyle, verilen tablodaki satır sayısı (`kosul` tabloya göre süzer).
create function pg_temp.sayi(kisi uuid, tablo text, kosul text) returns bigint language plpgsql as $$
declare sonuc bigint;
begin
  perform set_config('request.jwt.claim.sub', kisi::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  execute format('select count(*) from public.%I where %s', tablo, kosul) into sonuc;
  execute 'reset role';
  return sonuc;
end $$;

-- 1–4: sınıflar
select is(pg_temp.sayi('f1200000-0000-0000-0000-0000000f1200', 'classes',
                       $$organization_id = 'f2100000-0000-0000-0000-0000000f2100'$$),
  2::bigint, 'a branch admin sees their branch''s class and the unbranched one');
select is(pg_temp.sayi('f1200000-0000-0000-0000-0000000f1200', 'classes',
                       $$id = 'f5200000-0000-0000-0000-0000000f5200'$$),
  0::bigint, 'a branch admin does not see another branch''s class, even by id');
select is(pg_temp.sayi('f1100000-0000-0000-0000-0000000f1100', 'classes',
                       $$organization_id = 'f2100000-0000-0000-0000-0000000f2100'$$),
  3::bigint, 'an organization-wide admin sees every class');
select is(pg_temp.sayi('f1300000-0000-0000-0000-0000000f1300', 'classes',
                       $$organization_id = 'f2100000-0000-0000-0000-0000000f2100'$$),
  1::bigint, 'a teacher sees only the class they teach');

-- 5–7: üyelikler (kurum 8941'de 6 üyelik)
select is(pg_temp.sayi('f1200000-0000-0000-0000-0000000f1200', 'organization_memberships',
                       $$organization_id = 'f2100000-0000-0000-0000-0000000f2100'$$),
  5::bigint, 'a branch admin sees every membership except the other branch''s');
select is(pg_temp.sayi('f1100000-0000-0000-0000-0000000f1100', 'organization_memberships',
                       $$organization_id = 'f2100000-0000-0000-0000-0000000f2100'$$),
  6::bigint, 'an organization-wide admin sees every membership');
select is(pg_temp.sayi('f1300000-0000-0000-0000-0000000f1300', 'organization_memberships', 'true'),
  1::bigint, 'a teacher sees only their own membership');

-- 8–9: profiller
select is(pg_temp.sayi('f1100000-0000-0000-0000-0000000f1100', 'profiles',
                       $$id::text like 'f1_00000-%'$$),
  6::bigint, 'an admin sees the profile of every member of their organization, and no one else');
select is(pg_temp.sayi('f1300000-0000-0000-0000-0000000f1300', 'profiles',
                       $$id::text like 'f1_00000-%'$$),
  2::bigint, 'a teacher sees their own profile and their linked account, not a colleague');

-- 10–12: şifre kilidi
select is(pg_temp.sayi('f1600000-0000-0000-0000-0000000f1600', 'organization_memberships', 'true'),
  1::bigint, 'a locked admin sees only their own membership');
select is(pg_temp.sayi('f1600000-0000-0000-0000-0000000f1600', 'profiles', 'true'),
  1::bigint, 'a locked admin sees only their own profile');
select is(pg_temp.sayi('f1600000-0000-0000-0000-0000000f1600', 'classes', 'true'),
  0::bigint, 'a locked admin sees no class');

-- 13: operatör
select is(pg_temp.sayi('f1800000-0000-0000-0000-0000000f1800', 'profiles',
                       $$id::text like 'f1_00000-%'$$),
  2::bigint, 'an operator sees their own and another operator''s profile, not an organization member''s');

-- 14
select is(
  (select count(*) from pg_policies
    where schemaname = 'public' and cmd = 'SELECT' and permissive = 'PERMISSIVE'
      and tablename = any (array['classes', 'organization_memberships', 'profiles'])),
  3::bigint,
  'each of the three tables has exactly one read policy');

-- 15
select is(
  (select count(*) from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = any (array['current_user_administered_user_ids', 'current_user_linked_profile_ids'])
      and not has_function_privilege('anon', oid, 'execute')
      and has_function_privilege('authenticated', oid, 'execute')),
  2::bigint,
  'anon cannot call the two new visibility functions; authenticated can');

select * from finish();
rollback;
