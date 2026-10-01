-- `save_payment_plan` (2026-09-30): plan ve taksitler tek seferde.
--
--   1. Yeni plan üç taksitle açılır, sıralar 1..3.
--   2. ⛔ Taksit toplamı paket tutarına eşit değilse 22023 ve plan açılmaz.
--   3. Düzenleme: ödenmiş taksit (sıra 1) olduğu gibi kalır; ödenmemiş
--      ikisi ARŞİVLENİR (silinmez); yeni iki taksit sıra 2 ve 3 olur.
--   4. Arşivlenenler duruyor — denetim izi korunur.
--   5. ⛔ Düzenlemede ödenmiş + yeni ≠ toplam → 22023, eski ödenmemişler
--      arşivlenmez (yarım iş yok).
--   6. ⛔ Sıfır tutarlı taksit 22023.
--   7. ⛔ 60'tan fazla taksit 22023.
--   8. ⛔ Öğretmen plan kaydedemez (RLS, 42501).

begin;

create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
values
  ('a1110000-0000-0000-0000-0000000a1110', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'op-yonetici@example.test', '', now(), now()),
  ('a1120000-0000-0000-0000-0000000a1120', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'op-ogretmen@example.test', '', now(), now());

insert into public.organizations (id, name, slug, code)
values ('a1210000-0000-0000-0000-0000000a1210', 'Ödeme Planı', 'odeme-plani', 8904);

insert into public.organization_memberships (id, organization_id, user_id, role, status)
values
  ('a1310000-0000-0000-0000-0000000a1310', 'a1210000-0000-0000-0000-0000000a1210',
   'a1110000-0000-0000-0000-0000000a1110', 'admin', 'active'),
  ('a1320000-0000-0000-0000-0000000a1320', 'a1210000-0000-0000-0000-0000000a1210',
   'a1120000-0000-0000-0000-0000000a1120', 'teacher', 'active');

insert into public.students (id, organization_id, full_name)
values ('a1710000-0000-0000-0000-0000000a1710', 'a1210000-0000-0000-0000-0000000a1210',
        'Ödeme Öğrencisi');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a1110000-0000-0000-0000-0000000a1110', true);

create temp table plan_kimligi on commit drop as
select public.save_payment_plan(
  'a1210000-0000-0000-0000-0000000a1210', null, 'a1710000-0000-0000-0000-0000000a1710',
  'YKS Paketi', 30000,
  '[{"due_date":"2026-10-15","amount":10000},{"due_date":"2026-11-15","amount":10000},{"due_date":"2026-12-15","amount":10000}]'
) as id;

-- 1 · Üç taksit, sıra 1..3
select is(
  (select string_agg(sequence_no || ':' || due_date || ':' || amount, ' ' order by sequence_no)
     from public.installments where plan_id = (select id from plan_kimligi)),
  '1:2026-10-15:10000.00 2:2026-11-15:10000.00 3:2026-12-15:10000.00',
  'a new plan opens with its installments in one go'
);

-- 2 · Toplam tutmazsa plan açılmaz
select throws_ok(
  $$select public.save_payment_plan(
      'a1210000-0000-0000-0000-0000000a1210', null, 'a1710000-0000-0000-0000-0000000a1710',
      'Eksik', 20000, '[{"due_date":"2026-10-15","amount":5000}]')$$,
  '22023',
  null,
  'installments that do not add up to the package are refused'
);

-- 3 · Düzenleme: birinci taksit ödendi, kalan 20000 iki yeni taksite bölünür
update public.installments set paid_at = now()
 where plan_id = (select id from plan_kimligi) and sequence_no = 1;

select public.save_payment_plan(
  'a1210000-0000-0000-0000-0000000a1210', (select id from plan_kimligi), null,
  'YKS Paketi', 30000,
  '[{"due_date":"2026-11-01","amount":12000},{"due_date":"2026-12-01","amount":8000}]'
);

select is(
  (select string_agg(sequence_no || ':' || amount || ':' || (paid_at is not null), ' ' order by sequence_no)
     from public.installments
    where plan_id = (select id from plan_kimligi) and archived_at is null),
  '1:10000.00:true 2:12000.00:false 3:8000.00:false',
  'editing keeps the paid installment and rewrites only the unpaid ones after it'
);

-- 4 · Arşivlenenler duruyor
select is(
  (select count(*) from public.installments
    where plan_id = (select id from plan_kimligi) and archived_at is not null),
  2::bigint,
  'replaced unpaid installments are archived, not deleted'
);

-- 5 · Tutmayan düzenleme yarım iş bırakmaz
select throws_ok(
  $$select public.save_payment_plan(
      'a1210000-0000-0000-0000-0000000a1210',
      (select id from plan_kimligi), null, 'YKS Paketi', 30000,
      '[{"due_date":"2026-11-01","amount":5000}]')$$,
  '22023',
  null,
  'an edit that does not add up is refused'
);
-- (aynı işlem içinde hata; throws_ok kendi alt işleminde geri alır)

-- 6 · Sıfır tutar
select throws_ok(
  $$select public.save_payment_plan(
      'a1210000-0000-0000-0000-0000000a1210', null, 'a1710000-0000-0000-0000-0000000a1710',
      'Sıfır', 0, '[{"due_date":"2026-10-15","amount":0}]')$$,
  '22023',
  null,
  'a zero installment is refused'
);

-- 7 · 60'tan fazla
select throws_ok(
  $$select public.save_payment_plan(
      'a1210000-0000-0000-0000-0000000a1210', null, 'a1710000-0000-0000-0000-0000000a1710',
      'Çok', 61, (select jsonb_agg(jsonb_build_object('due_date', '2026-10-15', 'amount', 1))
                    from generate_series(1, 61)))$$,
  '22023',
  null,
  'more than 60 installments is refused'
);

-- 8 · Öğretmen kaydedemez
select set_config('request.jwt.claim.sub', 'a1120000-0000-0000-0000-0000000a1120', true);
select throws_ok(
  $$select public.save_payment_plan(
      'a1210000-0000-0000-0000-0000000a1210', null, 'a1710000-0000-0000-0000-0000000a1710',
      'Öğretmen planı', 100, '[{"due_date":"2026-10-15","amount":100}]')$$,
  '42501',
  null,
  'a teacher cannot save a payment plan'
);

select * from finish();
rollback;
