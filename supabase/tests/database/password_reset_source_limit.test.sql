-- Şifre sıfırlamanın kaynak başına sınırı (2026-10-25, ana plan 2.13).
--
--   1. Tek kaynak saatte en çok 10 istek yapar; var olmayan numaralar da sayılır.
--   2. ⛔ Sınırı dolan kaynaktan gerçek bir hesap için istek de gönderim almaz.
--   3. Sınırı aşan istek satır yazmaz (tablo kaynak başına tavanlı).
--   4. Başka bir kaynak aynı hesap için gönderim alır.
--   5. Kaynak bilinmiyorsa kova sistem sınırına eşittir: on istekten sonra da
--      gönderim yapılır (bugünkü davranış).
--   6. Kaynak yalnız 64 haneli özet olabilir; düz IP yazılamaz.
--   7. Oturumla tablo okunamaz.
--   8. Gece işi bir günden eski kaynak satırlarını siler.

begin;

create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values ('c7100000-0000-0000-0000-00000000c710', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', '80310001@orbit.invalid', '', now(), now());

insert into public.organizations (id, name, slug, code)
values ('c7200000-0000-0000-0000-00000000c720', 'Kaynak Dershanesi', 'kaynak-dershanesi', 8031);

insert into public.organization_memberships (organization_id, user_id, role, status)
values ('c7200000-0000-0000-0000-00000000c720', 'c7100000-0000-0000-0000-00000000c710', 'parent', 'active');

update public.profiles set recovery_email = 'kaynak.veli@example.test'
where id = 'c7100000-0000-0000-0000-00000000c710';

-- Özetler: Edge Function'ın ürettiği biçimde 64 haneli onaltılık.
create temp table kaynaklar as
select repeat('a', 64) as saldirgan, repeat('b', 64) as baska, repeat('c', 64) as bilinmeyen;

-- 1 · Var olmayan on numara, tek kaynak
select public.internal_claim_password_reset(
  format('8031%s@orbit.invalid', 9000 + sayi), (select saldirgan from kaynaklar), true)
from generate_series(1, 10) as sayi;

select is(
  (select count(*) from public.password_reset_sources
    where source_hash = (select saldirgan from kaynaklar)),
  10::bigint,
  'one source can make ten requests an hour, unknown numbers included'
);

-- 2 · Dolu kaynaktan gerçek hesap
select is(
  (select count(*) from public.internal_claim_password_reset(
     '80310001@orbit.invalid', (select saldirgan from kaynaklar), true)),
  0::bigint,
  'a source past its limit gets no mail even for a real account'
);

-- 3 · Satır yazılmadı
select is(
  (select count(*) from public.password_reset_sources
    where source_hash = (select saldirgan from kaynaklar)),
  10::bigint,
  'a refused request writes no row, so the table is capped per source'
);

-- 4 · Başka kaynak
select is(
  (select destination from public.internal_claim_password_reset(
     '80310001@orbit.invalid', (select baska from kaynaklar), true)),
  'kaynak.veli@example.test',
  'another source still gets the mail for the same account'
);

-- 5 · Bilinmeyen kaynak: kova sistem sınırında
select public.internal_claim_password_reset(
  format('8031%s@orbit.invalid', 9100 + sayi), (select bilinmeyen from kaynaklar), false)
from generate_series(1, 10) as sayi;

select is(
  (select destination from public.internal_claim_password_reset(
     '80310001@orbit.invalid', (select bilinmeyen from kaynaklar), false)),
  'kaynak.veli@example.test',
  'an unknown source keeps today''s behaviour: ten requests do not lock it'
);

-- 6 · Düz IP yazılamaz
select throws_ok(
  $$ insert into public.password_reset_sources (source_hash, source_known)
     values ('203.0.113.7', true) $$,
  '23514',
  null,
  'only a 64-character digest can be stored, never a plain address'
);

-- 7 · Oturumla okunamaz
select ok(
  not has_table_privilege('authenticated', 'public.password_reset_sources', 'SELECT')
  and not has_table_privilege('anon', 'public.password_reset_sources', 'SELECT'),
  'client roles cannot read the source digests'
);

-- 8 · Gece işi
update public.password_reset_sources set created_at = now() - interval '2 days'
where source_hash = (select saldirgan from kaynaklar);

-- Silme çağrısı ayrı adımda: tek ifadenin içinde Postgres alt sorguları
-- çağrıdan önce değerlendirebilir.
create temp table gece as select public.internal_purge_expired_records() as ozet;

select ok(
  (select (ozet ->> 'password_reset_sources')::int from gece) >= 10
  and not exists (
    select 1 from public.password_reset_sources
    where source_hash = (select saldirgan from kaynaklar)
  )
  and exists (
    select 1 from public.password_reset_sources
    where source_hash = (select baska from kaynaklar)
  ),
  'the nightly purge removes source rows older than a day and keeps fresh ones'
);

select * from finish();
rollback;
