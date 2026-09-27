-- Görev panosunun elle seçilen durumu (`20261004000000`).
--
-- Sınananlar:
--   * `status` ↔ `completed_at` kilidi, iki yönden de (tetikleyici)
--   * tutarsız satırın kısıtla reddi (tetikleyici atlatılsa bile)
--   * değer kümeleri: durum, öncelik, sabit etiket, süre aralığı
--   * sahibi yeni alanları yazabiliyor (sütun yetkisi)
--   * ⛔ başkasının görevi yine görünmüyor ve güncellenemiyor

begin;

create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
values
  ('81000000-0000-0000-0000-000000000081', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'pano-sahibi@example.test', '', now(), now()),
  ('82000000-0000-0000-0000-000000000082', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'pano-baskasi@example.test', '', now(), now());

insert into public.organizations (id, name, slug, code)
values ('8a000000-0000-0000-0000-00000000008a', 'Pano Kurumu', 'pano-kurumu', 7731);

insert into public.branches (id, organization_id, name, is_default)
values ('8b000000-0000-0000-0000-00000000008b', '8a000000-0000-0000-0000-00000000008a', 'Merkez', true);

insert into public.organization_memberships
  (id, organization_id, branch_id, user_id, role, status, person_code)
values
  ('8c100000-0000-0000-0000-0000000c1001', '8a000000-0000-0000-0000-00000000008a',
   '8b000000-0000-0000-0000-00000000008b', '81000000-0000-0000-0000-000000000081', 'teacher', 'active', 8101),
  ('8c200000-0000-0000-0000-0000000c2002', '8a000000-0000-0000-0000-00000000008a',
   '8b000000-0000-0000-0000-00000000008b', '82000000-0000-0000-0000-000000000082', 'teacher', 'active', 8102);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '81000000-0000-0000-0000-000000000081', true);

-- Sahibi yeni alanlarla görev açıyor (sütun yetkisi).
-- Kimlik yazılmaz (K-00): görevler başlıklarından bulunur.
insert into public.tasks
  (organization_id, owner_membership_id, title, status, priority, label, due_on, due_time, estimated_minutes)
values
  ('8a000000-0000-0000-0000-00000000008a',
   '8c100000-0000-0000-0000-0000000c1001', 'Veli görüşmesi', 'focus', 'high', 'parent_meeting',
   public.orbit_today(), '14:00', 30);

select results_eq(
  $$ select status, priority, label, due_time, estimated_minutes, completed_at is null
     from public.tasks where title = 'Veli görüşmesi' $$,
  $$ values ('focus'::text, 'high'::text, 'parent_meeting'::text, '14:00'::time, 30::smallint, true) $$,
  'the owner writes status, priority, label, time and duration'
);

-- Varsayılanlar.
insert into public.tasks (organization_id, owner_membership_id, title)
values ('8a000000-0000-0000-0000-00000000008a',
        '8c100000-0000-0000-0000-0000000c1001', 'Varsayılan');

select results_eq(
  $$ select status, priority, label from public.tasks where title = 'Varsayılan' $$,
  $$ values ('planned'::text, 'normal'::text, null::text) $$,
  'defaults: planned, normal, no label'
);

-- status → completed_at
update public.tasks set status = 'done' where title = 'Veli görüşmesi';
select isnt(
  (select completed_at from public.tasks where title = 'Veli görüşmesi'),
  null,
  'moving to done stamps completed_at'
);

update public.tasks set status = 'focus' where title = 'Veli görüşmesi';
select is(
  (select completed_at from public.tasks where title = 'Veli görüşmesi'),
  null,
  'moving out of done clears completed_at'
);

-- completed_at → status (eski istemci yolu)
update public.tasks set completed_at = now() where title = 'Varsayılan';
select is(
  (select status from public.tasks where title = 'Varsayılan'),
  'done',
  'setting completed_at alone moves the task to done'
);

update public.tasks set completed_at = null where title = 'Varsayılan';
select is(
  (select status from public.tasks where title = 'Varsayılan'),
  'today',
  'reopening via completed_at returns the task to today'
);

-- Değer kümeleri
select throws_ok(
  $$ update public.tasks set status = 'someday' where title = 'Varsayılan' $$,
  '23514', null, 'an unknown status is rejected'
);

select throws_ok(
  $$ update public.tasks set priority = 'urgent' where title = 'Varsayılan' $$,
  '23514', null, 'an unknown priority is rejected'
);

select throws_ok(
  $$ update public.tasks set label = 'Ödev' where title = 'Varsayılan' $$,
  '23514', null, 'a free-text label is rejected — the list is fixed'
);

select throws_ok(
  $$ update public.tasks set estimated_minutes = 0 where title = 'Varsayılan' $$,
  '23514', null, 'a zero duration is rejected'
);

-- ⛔ Başkası
select set_config('request.jwt.claim.sub', '82000000-0000-0000-0000-000000000082', true);

select is(
  (select count(*) from public.tasks where owner_membership_id = '8c100000-0000-0000-0000-0000000c1001'),
  0::bigint,
  'another member still cannot see the tasks'
);

update public.tasks set status = 'done' where title = 'Varsayılan';

reset role;

select is(
  (select status from public.tasks where title = 'Varsayılan'),
  'today',
  'another member''s update touches nothing'
);

-- Tetikleyici atlatılsa bile kısıt tutarsız satırı reddeder.
alter table public.tasks disable trigger tasks_sync_status_and_completion;
select throws_ok(
  $$ update public.tasks set status = 'done', completed_at = null
     where title = 'Varsayılan' $$,
  '23514', null, 'done without completed_at is rejected even without the trigger'
);
alter table public.tasks enable trigger tasks_sync_status_and_completion;

select * from finish();
rollback;
