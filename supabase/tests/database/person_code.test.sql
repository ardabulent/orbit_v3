-- Issue #53 — Giriş numarasının ikinci yarısının doğrulanması.
--
-- En kritik testler benzersizlikle ilgili olanlardır: aynı kurumda iki kişinin
-- aynı kodu alması, iki kişinin aynı sentetik adresi (yani aynı auth hesabını)
-- paylaşması demektir. Kimlik mimarisinin tamamı numaranın global benzersizliği
-- üzerine kuruludur.

begin;

create extension if not exists pgtap with schema extensions;
select plan(14);

-- Kurulum: iki kurum, üç kullanıcı. Adresler 9000'li aralıkta: yerel örnek
-- kurum (`pnpm yerel:tohum`) 1000'den başlayan numaraları alır ve çakışmamalı.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
values
  ('a1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', '90001000@orbit.invalid', '', now(), now()),
  ('a2000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', '90001001@orbit.invalid', '', now(), now()),
  ('a3000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', '90011000@orbit.invalid', '', now(), now());

insert into public.organizations (id, name, slug)
values
  ('b1000000-0000-0000-0000-000000000001', 'Kurum E', 'kurum-e'),
  ('b2000000-0000-0000-0000-000000000002', 'Kurum F', 'kurum-f');

-- Şema ------------------------------------------------------------------

select has_column(
  'public', 'organization_memberships', 'person_code',
  'organization_memberships has a person_code column'
);

select col_is_null(
  'public', 'organization_memberships', 'person_code',
  'person_code is nullable so pre-existing rows are not invalidated'
);

-- Aralık: 1000-9999. Baştaki sıfır hiç oluşmamalı, aksi halde kullanıcı
-- `0042`'yi `42` diye yazıp giriş yapamaz duruma düşer.
select throws_ok(
  $$insert into public.organization_memberships
      (organization_id, user_id, role, status, person_code)
    values ('b1000000-0000-0000-0000-000000000001',
            'a1000000-0000-0000-0000-000000000001', 'admin', 'active', 999)$$,
  '23514',
  null,
  'person_code below 1000 is rejected'
);

select throws_ok(
  $$insert into public.organization_memberships
      (organization_id, user_id, role, status, person_code)
    values ('b1000000-0000-0000-0000-000000000001',
            'a1000000-0000-0000-0000-000000000001', 'admin', 'active', 10000)$$,
  '23514',
  null,
  'person_code above 9999 is rejected'
);

-- Tahsis ----------------------------------------------------------------

select is(
  public.internal_next_person_code('b1000000-0000-0000-0000-000000000001'),
  1000,
  'the first person in an organization gets 1000'
);

insert into public.organization_memberships
  (organization_id, user_id, role, status, person_code)
values ('b1000000-0000-0000-0000-000000000001',
        'a1000000-0000-0000-0000-000000000001', 'admin', 'active', 1000);

select is(
  public.internal_next_person_code('b1000000-0000-0000-0000-000000000001'),
  1001,
  'the next person gets 1001'
);

-- Sayaç kurum başınadır. İkinci kurum kendi 1000'inden başlar; iki kurumun
-- kodları çakışabilir çünkü tam numara kurum kodunu da içerir.
select is(
  public.internal_next_person_code('b2000000-0000-0000-0000-000000000002'),
  1000,
  'a second organization starts its own numbering at 1000'
);

select throws_ok(
  $$select public.internal_next_person_code(
      'ffffffff-ffff-ffff-ffff-ffffffffffff')$$,
  '23503',
  null,
  'allocating a code for a non-existent organization fails'
);

-- Benzersizlik ----------------------------------------------------------

-- 🔴 En kritik iddia. Kırılırsa iki kişi aynı sentetik adresi, yani aynı auth
-- hesabını paylaşır.
select throws_ok(
  $$insert into public.organization_memberships
      (organization_id, user_id, role, status, person_code)
    values ('b1000000-0000-0000-0000-000000000001',
            'a2000000-0000-0000-0000-000000000002', 'teacher', 'active', 1000)$$,
  '23505',
  null,
  'two people in the same organization cannot share a person code'
);

-- Aynı kod farklı kurumda serbesttir; tam numara farklı olur.
select lives_ok(
  $$insert into public.organization_memberships
      (organization_id, user_id, role, status, person_code)
    values ('b2000000-0000-0000-0000-000000000002',
            'a3000000-0000-0000-0000-000000000003', 'admin', 'active', 1000)$$,
  'the same person code is allowed in a different organization'
);

-- Aynı kişinin iki kurumda ayrı hesabı olur; bu, "bir giriş hesabı tek kuruma
-- aittir" kararının şema tarafındaki karşılığıdır. Kayıtlar birbirini
-- engellemez çünkü farklı auth kullanıcılarıdır.
select is(
  (select count(*) from public.organization_memberships where person_code = 1000 and created_at >= now()),
  2::bigint,
  'person code 1000 exists once per organization'
);

-- Yetkiler --------------------------------------------------------------

set local role anon;

select throws_ok(
  $$select public.internal_next_person_code(
      'b1000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  'anon cannot allocate person codes'
);

select throws_ok(
  $$select public.internal_reserve_organization_code()$$,
  '42501',
  null,
  'anon cannot reserve organization codes'
);

reset role;

set local role authenticated;

-- Kurum kullanıcısı da çağıramaz: çağırabilseydi kurumun numara alanını
-- tüketebilir veya kendine kod üretebilirdi.
select throws_ok(
  $$select public.internal_next_person_code(
      'b1000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  'a signed-in user cannot allocate person codes'
);

reset role;

select * from finish();

rollback;
