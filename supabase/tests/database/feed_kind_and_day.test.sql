-- Duyuru türü ve günü (2026-09-30): `20261018000000`.
--
--   1. Tür belirtilmeyen duyuru "general", günü boş (eski duyurular aynen).
--   2. ⛔ Bilinmeyen tür reddedilir (check).
--   3. Yönetici sınav duyurusunu türü ve günüyle yazar.
--   4. ⛔ Hedef kitle kuralı tarihli duyuruda da geçerli: yalnız velilere
--      yazılan toplantı duyurusunu öğrenci görmez (takvimde de görmez).
--   5. Veli aynı duyuruyu görür.
--   6. Denetim kaydı tür ve gün değişikliğini değişen alan olarak yazar.

begin;

create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
values
  ('f0110000-0000-0000-0000-0000000f0110', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'dt-yonetici@example.test', '', now(), now()),
  ('f0120000-0000-0000-0000-0000000f0120', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'dt-ogrenci@example.test', '', now(), now()),
  ('f0130000-0000-0000-0000-0000000f0130', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'dt-veli@example.test', '', now(), now());

insert into public.organizations (id, name, slug, code)
values ('f0210000-0000-0000-0000-0000000f0210', 'Duyuru Günü', 'duyuru-gunu', 8903);

insert into public.organization_memberships (id, organization_id, user_id, role, status)
values
  ('f0310000-0000-0000-0000-0000000f0310', 'f0210000-0000-0000-0000-0000000f0210',
   'f0110000-0000-0000-0000-0000000f0110', 'admin', 'active'),
  ('f0320000-0000-0000-0000-0000000f0320', 'f0210000-0000-0000-0000-0000000f0210',
   'f0120000-0000-0000-0000-0000000f0120', 'student', 'active'),
  ('f0330000-0000-0000-0000-0000000f0330', 'f0210000-0000-0000-0000-0000000f0210',
   'f0130000-0000-0000-0000-0000000f0130', 'parent', 'active');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'f0110000-0000-0000-0000-0000000f0110', true);

insert into public.daily_feed_posts (organization_id, title)
values ('f0210000-0000-0000-0000-0000000f0210', 'Eski usul duyuru');

-- 1 · Varsayılan tür
select is(
  (select kind || ' ' || coalesce(event_date::text, 'gün yok')
     from public.daily_feed_posts where title = 'Eski usul duyuru'),
  'general gün yok',
  'a notice without a kind is general and has no day'
);

-- 2 · Bilinmeyen tür
select throws_ok(
  $$insert into public.daily_feed_posts (organization_id, title, kind)
    values ('f0210000-0000-0000-0000-0000000f0210', 'Bozuk', 'party')$$,
  '23514',
  null,
  'an unknown kind is rejected'
);

-- 3 · Sınav duyurusu türü ve günüyle
insert into public.daily_feed_posts (organization_id, title, kind, event_date, audience)
values
  ('f0210000-0000-0000-0000-0000000f0210', 'TYT Deneme 3', 'exam', '2026-10-11', 'all'),
  ('f0210000-0000-0000-0000-0000000f0210', 'Veli toplantısı', 'meeting', '2026-10-03', 'guardians');

select is(
  (select kind || ' ' || event_date::text from public.daily_feed_posts
    where title = 'TYT Deneme 3'),
  'exam 2026-10-11',
  'an admin writes an exam notice with its day'
);

-- 4 · Öğrenci yalnız-veli toplantısını görmez
select set_config('request.jwt.claim.sub', 'f0120000-0000-0000-0000-0000000f0120', true);
select is(
  (select string_agg(title, ', ' order by title) from public.daily_feed_posts
    where organization_id = 'f0210000-0000-0000-0000-0000000f0210'
      and event_date is not null),
  'TYT Deneme 3',
  'a student never sees a guardians-only dated notice — not on the calendar either'
);

-- 5 · Veli görür
select set_config('request.jwt.claim.sub', 'f0130000-0000-0000-0000-0000000f0130', true);
select is(
  (select count(*) from public.daily_feed_posts
    where title = 'Veli toplantısı'),
  1::bigint,
  'a guardian sees the guardians-only meeting notice'
);

-- 6 · Denetim kaydı tür ve günü görür
select set_config('request.jwt.claim.sub', 'f0110000-0000-0000-0000-0000000f0110', true);
update public.daily_feed_posts set event_date = '2026-10-12'
 where title = 'TYT Deneme 3';
reset role;
select is(
  (select metadata -> 'changed' from public.audit_events
    where entity_id = (select id from public.daily_feed_posts where title = 'TYT Deneme 3')
      and action = 'feed_post.updated'),
  '["event_date"]'::jsonb,
  'the audit log records a change of day as a changed field'
);

select * from finish();
rollback;
