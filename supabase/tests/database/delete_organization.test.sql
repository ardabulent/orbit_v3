-- Issue #63 — Kurum silmenin sınırlarının doğrulanması.
--
-- En kritik test, platform operatörünün korunduğunu kanıtlayandır. Bu testin
-- var olma sebebi gerçek bir olaydır: 2026-08-24'te test kurumu panelden
-- silindi, kurumun tek üyesi aynı zamanda platform operatörüydü ve auth hesabı
-- tamamen yok oldu — operatörlüğü de `on delete cascade` ile birlikte gitti.
-- Kurucu ekibin ikisi de aynı kurumun üyesi olsaydı platformun tamamı
-- erişilemez hale gelirdi.

-- Issue #150 — içerik koruması. Kimlik koruması (yukarıdaki olay) kurumun
-- ÜYELERİNİ kurtardı; kurumun VERİSİ hâlâ koşulsuz siliniyordu. Aşağıdaki
-- içerik testlerinin en önemlisi, fonksiyon yazıldığında **var olmayan** bir
-- tablonun kendiliğinden korunduğunu kanıtlayandır: v1.2'nin students, classes,
-- exams tablolarının hepsi bugün o durumdadır.

begin;

create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
values
  ('c1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'sadece-uye@example.test', '', now(), now()),
  ('c2000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'hem-uye-hem-operator@example.test', '', now(), now()),
  ('c3000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'askidaki-operator@example.test', '', now(), now());

insert into public.platform_operators (user_id, role, status)
values
  ('c2000000-0000-0000-0000-000000000002', 'owner', 'active'),
  ('c3000000-0000-0000-0000-000000000003', 'operator', 'suspended');

insert into public.organizations (id, name, slug, code)
values ('d1000000-0000-0000-0000-000000000001', 'Silinecek Kurum', 'silinecek', 4242);

insert into public.branches (organization_id, name, is_default)
values ('d1000000-0000-0000-0000-000000000001', 'Merkez', true);

insert into public.organization_memberships
  (organization_id, user_id, role, status, person_code)
values
  ('d1000000-0000-0000-0000-000000000001',
   'c1000000-0000-0000-0000-000000000001', 'admin', 'active', 1000),
  ('d1000000-0000-0000-0000-000000000001',
   'c2000000-0000-0000-0000-000000000002', 'teacher', 'active', 1001),
  ('d1000000-0000-0000-0000-000000000001',
   'c3000000-0000-0000-0000-000000000003', 'teacher', 'active', 1002);

insert into public.audit_events
  (organization_id, actor_user_id, action, entity_type, entity_id)
values (
  'd1000000-0000-0000-0000-000000000001',
  'c1000000-0000-0000-0000-000000000001',
  'test.event', 'test', 'd1000000-0000-0000-0000-000000000001'
);

-- İçerik koruması (#150) ----------------------------------------------------

-- Bu tablo, fonksiyon yazıldığında var olmayan bir v1.2 iş tablosunu taklit
-- ediyor. `on delete cascade` bilinçli: koruma olmasaydı satırlar hiçbir hata
-- vermeden yok olurdu — testin yakaladığı tehlike tam olarak budur, gürültülü
-- bir FK ihlali değil.
create table public.sinif_kaydi_taklidi (
  id bigint generated always as identity primary key,
  organization_id uuid not null
    references public.organizations (id) on delete cascade,
  ad text not null
);

insert into public.sinif_kaydi_taklidi (organization_id, ad)
values
  ('d1000000-0000-0000-0000-000000000001', 'LGS-A'),
  ('d1000000-0000-0000-0000-000000000001', 'LGS-B');

-- Reddin gerekçesi `detail` alanında taşınıyor; ona ulaşmak için istisnayı
-- yakalayan bir sarmalayıcı gerekiyor.
create function pg_temp.silmeyi_dene(org uuid, actor uuid)
returns text
language plpgsql
as $$
declare
  gerekce text;
begin
  perform public.internal_delete_organization(org, actor);
  return null;
exception when sqlstate 'ORB01' then
  get stacked diagnostics gerekce = pg_exception_detail;
  return gerekce;
end;
$$;

select throws_ok(
  $$ select public.internal_delete_organization(
       'd1000000-0000-0000-0000-000000000001',
       'c2000000-0000-0000-0000-000000000002'
     ) $$,
  'ORB01',
  'organization still holds content',
  'a table that did not exist when the guard was written still blocks deletion'
);

select is(
  pg_temp.silmeyi_dene(
    'd1000000-0000-0000-0000-000000000001',
    'c2000000-0000-0000-0000-000000000002'
  )::jsonb,
  '[{"table": "sinif_kaydi_taklidi", "rows": 2}]'::jsonb,
  'the refusal names the blocking table and its row count'
);

-- Reddedilen silme hiçbir iz bırakmamalı: ne kurum gitmeli, ne "silindi"
-- denetim kaydı yazılmalı. İkincisi ayrıca test ediliyor çünkü denetim kaydı
-- fonksiyonda silmeden ÖNCE yazılıyor — koruma yanlış sıraya konsaydı kurum
-- ayakta kalır ama kayıt "silindi" derdi.
select is(
  (select count(*) from public.organizations
     where id = 'd1000000-0000-0000-0000-000000000001'),
  1::bigint,
  'the organization survives a refused deletion'
);

select is(
  -- Yalnız bu kurumun kaydı sayılır: veritabanında başka silinmiş kurumların
  -- izi olabilir (yerel yığın, 2026-10-25).
  (select count(*) from public.platform_audit_events
     where action = 'platform.organization_deleted'
       and entity_id = 'd1000000-0000-0000-0000-000000000001'),
  0::bigint,
  'a refused deletion writes no "deleted" audit record'
);

-- Tablo boşaltılıyor ama SİLİNMİYOR: aşağıdaki başarılı silme, boş bir içerik
-- tablosunun engel olmadığını da kanıtlasın. Koruma satır sayar, tablo varlığı
-- saymaz.
delete from public.sinif_kaydi_taklidi;

-- Silme ---------------------------------------------------------------------

create temporary table delete_result as
select public.internal_delete_organization(
  'd1000000-0000-0000-0000-000000000001',
  'c2000000-0000-0000-0000-000000000002'
) as payload;

select is(
  (select count(*) from public.organizations
     where id = 'd1000000-0000-0000-0000-000000000001'),
  0::bigint,
  'the organization row is gone'
);

select is(
  (select count(*) from public.branches
     where organization_id = 'd1000000-0000-0000-0000-000000000001'),
  0::bigint,
  'branches are gone'
);

select is(
  (select count(*) from public.organization_memberships
     where organization_id = 'd1000000-0000-0000-0000-000000000001'),
  0::bigint,
  'memberships are gone'
);

select is(
  (select count(*) from public.audit_events
     where organization_id = 'd1000000-0000-0000-0000-000000000001'),
  0::bigint,
  'the institution audit trail is gone'
);

-- Koruma satır sayar, tablo varlığı saymaz. Aksi halde v1.2'nin ilk tablosu
-- eklendiği gün hiçbir kurum bir daha silinemezdi.
select ok(
  (select to_regclass('public.sinif_kaydi_taklidi') is not null),
  'an empty content table does not block deletion'
);

-- 🔴 En kritik iddialar: kimlik başka bir yerden talep ediliyorsa korunuyor mu

select is(
  (select jsonb_array_length(payload -> 'member_user_ids') from delete_result),
  1,
  'only the non-operator member is returned for auth deletion'
);

select is(
  (select payload -> 'member_user_ids' ->> 0 from delete_result),
  'c1000000-0000-0000-0000-000000000001',
  'the returned member is the one without platform access'
);

select is(
  (select jsonb_array_length(payload -> 'protected_user_ids') from delete_result),
  2,
  'both operators are reported as protected identities'
);

-- Askıya alınmış operatör da korunur: askı geri alınabilir bir durumdur,
-- hesap silme ise değildir.
select ok(
  (select payload -> 'protected_user_ids' from delete_result)
    @> '["c3000000-0000-0000-0000-000000000003"]'::jsonb,
  'a suspended operator is protected too'
);

select is(
  (select count(*) from public.platform_operators where created_at >= now()),
  2::bigint,
  'platform operator records survive the organization deletion'
);

-- Denetim -------------------------------------------------------------------

-- Kurum adı ve kodu metadata'ya kopyalanmalı; `organization_id` kurum silinince
-- NULL'a düştüğü için kaydın hangi kuruma ait olduğu başka türlü anlaşılamaz.
select is(
  (select metadata ->> 'organization_name'
     from public.platform_audit_events
     where action = 'platform.organization_deleted'
     order by id desc limit 1),
  'Silinecek Kurum',
  'the audit record keeps the organization name after deletion'
);

select * from finish();

rollback;
