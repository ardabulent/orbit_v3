-- `payment_plan_summaries` ödenen/kalan sütunları (`20261010000000`).
--
-- Plan P (S1): 30.000 TL paket; taksitler
--   #1 10.000 ödendi · #2 10.000 vadesi geçmiş, ödenmedi ·
--   #3 10.000 ödendi ama ARŞİVLİ (hiçbir toplama girmez) · #4 5.000 ileride.
-- Plan Q (S2): başka öğrencinin, taksitsiz.
-- Veli G yalnız S1'in velisi.

begin;

create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
values
  ('c1000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'odeme-yonetici@example.test', '', now(), now()),
  ('c2000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'odeme-veli@example.test', '', now(), now());

insert into public.organizations (id, name, slug, code)
values ('ca000000-0000-0000-0000-0000000000ca', 'Ödeme Kurumu', 'odeme-kurumu', 8311);

insert into public.branches (id, organization_id, name, is_default)
values ('cc000000-0000-0000-0000-0000000000cc', 'ca000000-0000-0000-0000-0000000000ca', 'Merkez', true);

insert into public.organization_memberships
  (id, organization_id, branch_id, user_id, role, status, person_code)
values
  ('cd000000-0000-0000-0000-0000000dc000', 'ca000000-0000-0000-0000-0000000000ca',
   'cc000000-0000-0000-0000-0000000000cc', 'c1000000-0000-0000-0000-0000000000c1', 'admin', 'active', 9401),
  ('cd100000-0000-0000-0000-0000000dc001', 'ca000000-0000-0000-0000-0000000000ca',
   'cc000000-0000-0000-0000-0000000000cc', 'c2000000-0000-0000-0000-0000000000c2', 'parent', 'active', 9402);

insert into public.students (id, organization_id, branch_id, full_name)
values
  ('c6100000-0000-0000-0000-0000000006c1', 'ca000000-0000-0000-0000-0000000000ca',
   'cc000000-0000-0000-0000-0000000000cc', 'S1'),
  ('c6200000-0000-0000-0000-0000000006c2', 'ca000000-0000-0000-0000-0000000000ca',
   'cc000000-0000-0000-0000-0000000000cc', 'S2');

insert into public.guardians (id, organization_id, auth_user_id, full_name)
values ('c7100000-0000-0000-0000-0000000007c1', 'ca000000-0000-0000-0000-0000000000ca',
        'c2000000-0000-0000-0000-0000000000c2', 'G');

insert into public.student_guardians (organization_id, student_id, guardian_id)
values ('ca000000-0000-0000-0000-0000000000ca', 'c6100000-0000-0000-0000-0000000006c1',
        'c7100000-0000-0000-0000-0000000007c1');

insert into public.payment_plans (id, organization_id, student_id, name, total_amount)
values
  ('c8100000-0000-0000-0000-0000000008c1', 'ca000000-0000-0000-0000-0000000000ca',
   'c6100000-0000-0000-0000-0000000006c1', 'YKS Paketi', 30000),
  ('c8200000-0000-0000-0000-0000000008c2', 'ca000000-0000-0000-0000-0000000000ca',
   'c6200000-0000-0000-0000-0000000006c2', 'LGS Paketi', 20000);

insert into public.installments
  (organization_id, plan_id, sequence_no, due_date, amount, paid_at, archived_at)
values
  ('ca000000-0000-0000-0000-0000000000ca', 'c8100000-0000-0000-0000-0000000008c1', 1,
   public.orbit_today() - 60, 10000, now() - interval '55 days', null),
  ('ca000000-0000-0000-0000-0000000000ca', 'c8100000-0000-0000-0000-0000000008c1', 2,
   public.orbit_today() - 30, 10000, null, null),
  ('ca000000-0000-0000-0000-0000000000ca', 'c8100000-0000-0000-0000-0000000008c1', 3,
   public.orbit_today() - 20, 10000, now() - interval '19 days', now()),
  ('ca000000-0000-0000-0000-0000000000ca', 'c8100000-0000-0000-0000-0000000008c1', 4,
   public.orbit_today() + 30, 5000, null, null);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'c1000000-0000-0000-0000-0000000000c1', true);

select results_eq(
  $$ select installment_count, paid_count, scheduled_amount, paid_amount, overdue_count
     from public.payment_plan_summaries(array['c8100000-0000-0000-0000-0000000008c1'::uuid]) $$,
  $$ values (3::bigint, 1::bigint, 25000::numeric, 10000::numeric, 1::bigint) $$,
  'three live installments, one paid: 25.000 scheduled, 10.000 paid; the archived paid installment counts nowhere'
);

select results_eq(
  $$ select installment_count, paid_count, scheduled_amount, paid_amount, next_due_date
     from public.payment_plan_summaries(array['c8200000-0000-0000-0000-0000000008c2'::uuid]) $$,
  $$ values (0::bigint, 0::bigint, 0::numeric, 0::numeric, null::date) $$,
  'a plan without installments: zero counts and sums, no invented next due date'
);

select is(
  (select next_due_amount from public.payment_plan_summaries(array['c8100000-0000-0000-0000-0000000008c1'::uuid])),
  10000::numeric,
  'the existing columns keep their meaning: the next due is the overdue #2'
);

select set_config('request.jwt.claim.sub', 'c2000000-0000-0000-0000-0000000000c2', true);

select is(
  (select paid_amount from public.payment_plan_summaries(array['c8100000-0000-0000-0000-0000000008c1'::uuid])),
  10000::numeric,
  'the guardian reads their child''s paid total'
);

select is(
  (select count(*) from public.payment_plan_summaries(array['c8200000-0000-0000-0000-0000000008c2'::uuid])),
  0::bigint,
  'the guardian gets nothing for another student''s plan (RLS, not definer)'
);

reset role;
set local role anon;

select throws_ok(
  $$ select * from public.payment_plan_summaries(array['c8100000-0000-0000-0000-0000000008c1'::uuid]) $$,
  '42501', null,
  'anon cannot call payment_plan_summaries'
);

select * from finish();
rollback;
