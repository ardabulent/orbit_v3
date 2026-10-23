-- İleri tarihe yoklama açılamaz (2026-10-23, ana plan 1.6, test turu B5).
--
--   1. Bugünün oturumu açılır.
--   2. Geçmiş bir günün oturumu açılır.
--   3. ⛔ Yarının oturumu açılamaz.
--   4. ⛔ Var olan oturum ileri tarihe taşınamaz.

begin;

create extension if not exists pgtap with schema extensions;
select plan(4);

insert into public.organizations (id, name, slug, code)
values ('a0a10000-0000-0000-0000-00000a0a1000', 'Yoklama Tarih Dershanesi', 'yoklama-tarih', 7994);

insert into public.classes (id, organization_id, name)
values ('a0a20000-0000-0000-0000-00000a0a2000', 'a0a10000-0000-0000-0000-00000a0a1000', '9-A');

select lives_ok(
  $$insert into public.attendance_sessions (id, organization_id, class_id, session_date)
    values ('a0a30000-0000-0000-0000-00000a0a3000', 'a0a10000-0000-0000-0000-00000a0a1000',
            'a0a20000-0000-0000-0000-00000a0a2000', public.orbit_today())$$,
  'today''s session opens'
);
select lives_ok(
  $$insert into public.attendance_sessions (organization_id, class_id, session_date)
    values ('a0a10000-0000-0000-0000-00000a0a1000', 'a0a20000-0000-0000-0000-00000a0a2000',
            public.orbit_today() - 3)$$,
  'a past day''s session opens'
);
select throws_ok(
  $$insert into public.attendance_sessions (organization_id, class_id, session_date)
    values ('a0a10000-0000-0000-0000-00000a0a1000', 'a0a20000-0000-0000-0000-00000a0a2000',
            public.orbit_today() + 1)$$,
  '22023', null,
  'tomorrow''s session is refused'
);
select throws_ok(
  $$update public.attendance_sessions set session_date = public.orbit_today() + 7
    where id = 'a0a30000-0000-0000-0000-00000a0a3000'$$,
  '22023', null,
  'an existing session cannot be moved ahead'
);

select * from finish();
rollback;
