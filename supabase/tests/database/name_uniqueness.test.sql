-- Aynı adlı sınıf ve ders (2026-10-23, ana plan 1.4, test turu B2/B3).
--
--   1–3. ⛔ Sınıf adı büyük/küçük harf ve Türkçe I/İ farkıyla tekrar açılamaz.
--   4.   Arşivdeki aynı adlı sınıf engel değildir.
--   5.   Başka kurumda aynı ad serbesttir.
--   6–7. ⛔ Ders adı da aynı kuralla tekildir.
--   8.   Farklı ad serbesttir.

begin;

create extension if not exists pgtap with schema extensions;
select plan(8);

insert into public.organizations (id, name, slug, code)
values
  ('ad110000-0000-0000-0000-0000000ad110', 'Ad Dershanesi', 'ad-dershanesi', 7998),
  ('ad120000-0000-0000-0000-0000000ad120', 'Öbür Dershane', 'obur-dershane', 7999);

insert into public.classes (organization_id, name)
values ('ad110000-0000-0000-0000-0000000ad110', '12-A Sayısal');
insert into public.subjects (organization_id, name)
values ('ad110000-0000-0000-0000-0000000ad110', 'Matematik');

select throws_ok(
  $$insert into public.classes (organization_id, name)
    values ('ad110000-0000-0000-0000-0000000ad110', '12-a sayısal')$$,
  '23505', null,
  'a class name differing only in case is refused'
);
select throws_ok(
  $$insert into public.classes (organization_id, name)
    values ('ad110000-0000-0000-0000-0000000ad110', '12-A SAYISAL')$$,
  '23505', null,
  'Turkish upper-case I is folded too (SAYISAL = Sayısal)'
);
select throws_ok(
  $$insert into public.classes (organization_id, name)
    values ('ad110000-0000-0000-0000-0000000ad110', '  12-A Sayısal ')$$,
  '23505', null,
  'surrounding spaces do not make a new name'
);

insert into public.classes (organization_id, name, archived_at)
values ('ad110000-0000-0000-0000-0000000ad110', 'Eski Sınıf', now());
select lives_ok(
  $$insert into public.classes (organization_id, name)
    values ('ad110000-0000-0000-0000-0000000ad110', 'eski sınıf')$$,
  'an archived class with the same name is no obstacle'
);
select lives_ok(
  $$insert into public.classes (organization_id, name)
    values ('ad120000-0000-0000-0000-0000000ad120', '12-A Sayısal')$$,
  'another institution may use the same name'
);

select throws_ok(
  $$insert into public.subjects (organization_id, name)
    values ('ad110000-0000-0000-0000-0000000ad110', 'matematik')$$,
  '23505', null,
  'a subject name differing only in case is refused'
);
select throws_ok(
  $$insert into public.subjects (organization_id, name)
    values ('ad110000-0000-0000-0000-0000000ad110', 'MATEMATİK')$$,
  '23505', null,
  'Turkish upper-case İ is folded too (MATEMATİK = Matematik)'
);
select lives_ok(
  $$insert into public.subjects (organization_id, name)
    values ('ad110000-0000-0000-0000-0000000ad110', 'Matematik 2')$$,
  'a different name is allowed'
);

select * from finish();
rollback;
