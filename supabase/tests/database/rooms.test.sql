-- Derslik bir kayıttır; aynı saatte iki derse verilemez (2026-10-12, göç
-- 20261029000000, ROADMAP v1.5-15).
--
--   1–2   Yönetici derslik açar; ⛔ öğretmen açamaz.
--   3     Süresi kesişen ders aynı dersliğe yazılamaz (ORB07) ve sebep söylenir.
--   4     Biri bitince başlayan ders yazılır (10:40'ta biten, 10:40'ta başlayan).
--   5     Başka gün, arşivlenmiş ders ve başka derslik engel değildir.
--   6     Paylaşılabilir derslikte aynı saate iki ders yazılır.
--   7     Çakışma varken paylaşım kapatılamaz (ORB07).
--   8     Kullanımdaki derslik kapatılamaz (ORB03).
--   9     Eski metin sütunu dersliğin adını taşır; ad değişince o da değişir.
--   10    ⛔ Eski metin sütunu doğrudan yazılamaz.
--   11    Bir dersi kendi saatinde güncellemek kendisiyle çakışmaz.

begin;

create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
values
  ('c1100000-0000-0000-0000-0000000c1100', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'dl-yonetici@example.test', '', now(), now()),
  ('c1200000-0000-0000-0000-0000000c1200', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'dl-ogretmen@example.test', '', now(), now());

insert into public.organizations (id, name, slug, code)
values ('c2100000-0000-0000-0000-0000000c2100', 'Derslik Dershanesi', 'derslik-dershanesi', 8933);

insert into public.organization_memberships (id, organization_id, user_id, role, status)
values
  ('c3100000-0000-0000-0000-0000000c3100', 'c2100000-0000-0000-0000-0000000c2100',
   'c1100000-0000-0000-0000-0000000c1100', 'admin', 'active'),
  ('c3200000-0000-0000-0000-0000000c3200', 'c2100000-0000-0000-0000-0000000c2100',
   'c1200000-0000-0000-0000-0000000c1200', 'teacher', 'active');

insert into public.classes (id, organization_id, name)
values ('c4100000-0000-0000-0000-0000000c4100', 'c2100000-0000-0000-0000-0000000c2100', '11-A'),
       ('c4200000-0000-0000-0000-0000000c4200', 'c2100000-0000-0000-0000-0000000c2100', '12-B');

create function pg_temp.olarak(kisi uuid, komut text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', kisi::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  execute komut;
  execute 'reset role';
exception when others then
  execute 'reset role';
  raise;
end $$;

-- 1–2
select lives_ok(
  $$select pg_temp.olarak('c1100000-0000-0000-0000-0000000c1100',
    'insert into public.rooms (organization_id, name) values (''c2100000-0000-0000-0000-0000000c2100'', ''A-101'')')$$,
  'the admin opens a room');
-- Kimlik istemcide yazılmaz (sütun yetkisi); testin geri kalanı için sabitlenir.
update public.rooms set id = 'c5100000-0000-0000-0000-0000000c5100'
 where organization_id = 'c2100000-0000-0000-0000-0000000c2100' and name = 'A-101';
select throws_ok(
  $$select pg_temp.olarak('c1200000-0000-0000-0000-0000000c1200',
    'insert into public.rooms (organization_id, name) values (''c2100000-0000-0000-0000-0000000c2100'', ''B-202'')')$$,
  '42501', null, 'a teacher cannot open a room');

insert into public.rooms (id, organization_id, name, shareable)
values ('c5200000-0000-0000-0000-0000000c5200', 'c2100000-0000-0000-0000-0000000c2100', 'Bahçe', true),
       ('c5300000-0000-0000-0000-0000000c5300', 'c2100000-0000-0000-0000-0000000c2100', 'B-202', false);

insert into public.schedule_entries (id, organization_id, class_id, title, day_of_week, starts_at, ends_at, room_id)
values ('c6100000-0000-0000-0000-0000000c6100', 'c2100000-0000-0000-0000-0000000c2100',
        'c4100000-0000-0000-0000-0000000c4100', 'Matematik', 1, '10:00', '10:40',
        'c5100000-0000-0000-0000-0000000c5100');

-- 3
select throws_like(
  $$insert into public.schedule_entries (organization_id, class_id, title, day_of_week, starts_at, ends_at, room_id)
    values ('c2100000-0000-0000-0000-0000000c2100', 'c4200000-0000-0000-0000-0000000c4200',
            'Fizik', 1, '10:20', '11:00', 'c5100000-0000-0000-0000-0000000c5100')$$,
  'A-101 bu saatte dolu: Pazartesi günü 10:00–10:40 arası 11-A%',
  'an overlapping lesson cannot take the same room, and the reason is named');

-- 4
select lives_ok(
  $$insert into public.schedule_entries (organization_id, class_id, title, day_of_week, starts_at, ends_at, room_id)
    values ('c2100000-0000-0000-0000-0000000c2100', 'c4200000-0000-0000-0000-0000000c4200',
            'Fizik', 1, '10:40', '11:20', 'c5100000-0000-0000-0000-0000000c5100')$$,
  'a lesson starting when the previous one ends takes the room');

-- 5
insert into public.schedule_entries (id, organization_id, class_id, title, day_of_week, starts_at, ends_at, room_id, archived_at)
values ('c6200000-0000-0000-0000-0000000c6200', 'c2100000-0000-0000-0000-0000000c2100',
        'c4200000-0000-0000-0000-0000000c4200', 'Eski', 2, '09:00', '09:40',
        'c5100000-0000-0000-0000-0000000c5100', now());
select lives_ok(
  $$insert into public.schedule_entries (organization_id, class_id, title, day_of_week, starts_at, ends_at, room_id)
    values ('c2100000-0000-0000-0000-0000000c2100', 'c4200000-0000-0000-0000-0000000c4200',
            'Kimya', 2, '09:00', '09:40', 'c5100000-0000-0000-0000-0000000c5100'),
           ('c2100000-0000-0000-0000-0000000c2100', 'c4200000-0000-0000-0000-0000000c4200',
            'Biyoloji', 1, '10:00', '10:40', 'c5300000-0000-0000-0000-0000000c5300')$$,
  'another day, an archived lesson and another room do not block');

-- 6
select lives_ok(
  $$insert into public.schedule_entries (organization_id, class_id, title, day_of_week, starts_at, ends_at, room_id)
    values ('c2100000-0000-0000-0000-0000000c2100', 'c4100000-0000-0000-0000-0000000c4100', 'Beden', 3, '13:00', '13:40', 'c5200000-0000-0000-0000-0000000c5200'),
           ('c2100000-0000-0000-0000-0000000c2100', 'c4200000-0000-0000-0000-0000000c4200', 'Beden', 3, '13:00', '13:40', 'c5200000-0000-0000-0000-0000000c5200')$$,
  'a shareable room takes two lessons at the same time');

-- 7
select throws_ok(
  $$update public.rooms set shareable = false where id = 'c5200000-0000-0000-0000-0000000c5200'$$,
  'ORB07', null, 'sharing cannot be turned off while lessons overlap');

-- 8
select throws_ok(
  $$update public.rooms set archived_at = now() where id = 'c5100000-0000-0000-0000-0000000c5100'$$,
  'ORB03', null, 'a room in use cannot be closed');

-- 9 · Metin kopyası göç 20261105000000 ile kalktı; derslik adı kayıttan
--     okunur ve yeniden adlandırma derse yansır.
update public.rooms set name = 'A-101 (Fen)' where id = 'c5100000-0000-0000-0000-0000000c5100';
select is(
  (select derslik.name from public.schedule_entries as ders
     join public.rooms as derslik on derslik.id = ders.room_id
    where ders.id = 'c6100000-0000-0000-0000-0000000c6100'),
  'A-101 (Fen)', 'a lesson shows the room under its new name');

-- 10
select ok(
  not exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'schedule_entries'
                and column_name = 'room')
  and has_column_privilege('authenticated', 'public.schedule_entries', 'room_id', 'INSERT')
  and has_column_privilege('authenticated', 'public.schedule_entries', 'room_id', 'UPDATE'),
  'the legacy text column is gone; room_id stays writable');

-- 11
select lives_ok(
  $$update public.schedule_entries set title = 'Matematik II'
     where id = 'c6100000-0000-0000-0000-0000000c6100'$$,
  'updating a lesson in place does not conflict with itself');

select * from finish();
rollback;
