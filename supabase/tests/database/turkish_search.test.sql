-- Türkçe arama (2026-10-03, B18).
--
-- ⚠️ Girdi → çıktı çiftleri `client/src/education/turkishSearch.test.ts` ile
-- AYNI. Biri değişirse öteki de değişmeli.

begin;

create extension if not exists pgtap with schema extensions;
select plan(14);

select is(public.search_fold('İlker'), 'ilker', 'search_fold İlker');
select is(public.search_fold('Işık'), 'isik', 'search_fold Işık');
select is(public.search_fold('IŞIK'), 'isik', 'search_fold IŞIK');
select is(public.search_fold('ışık'), 'isik', 'search_fold ışık');
select is(public.search_fold('Çağrı Öztürk'), 'cagri ozturk', 'search_fold Çağrı Öztürk');
select is(public.search_fold('ŞÜKRÜ GÜNEŞ'), 'sukru gunes', 'search_fold ŞÜKRÜ GÜNEŞ');
select is(public.search_fold('Ayşe Nur Koç-Yılmaz 9302'), 'ayse nur koc-yilmaz 9302', 'search_fold ad ve numara');

select is(public.turkish_name_key('  IŞIK  '), 'işik', 'turkish_name_key boşluklu IŞIK');
select is(public.turkish_name_key('Işık'), 'işik', 'turkish_name_key Işık');
select is(public.turkish_name_key('12-A SAYISAL'), '12-a sayisal', 'turkish_name_key sınıf adı');
select is(public.turkish_name_key('Hazırlık'), 'hazirlik', 'turkish_name_key Hazırlık');

insert into public.organizations (id, name, slug, code)
values ('f2100000-0000-0000-0000-0000000f2100', 'Arama Kurumu', 'arama-kurumu', 8908);

insert into public.students (id, organization_id, full_name, student_number)
values ('f3100000-0000-0000-0000-0000000f3100', 'f2100000-0000-0000-0000-0000000f2100', 'İlker Işık', '4411');

insert into public.guardians (id, organization_id, full_name, phone)
values ('f4100000-0000-0000-0000-0000000f4100', 'f2100000-0000-0000-0000-0000000f2100', 'Çağrı Öztürk', '0532 444 55 66');

select is(
  (select search_key from public.students where id = 'f3100000-0000-0000-0000-0000000f3100'),
  'ilker isik 4411',
  'the student search key folds the name and keeps the number'
);

select is(
  (select count(*) from public.students
    where organization_id = 'f2100000-0000-0000-0000-0000000f2100'
      and search_key ilike '%' || public.search_fold('ISIK') || '%'),
  1::bigint,
  '"ISIK" typed without Turkish letters finds İlker Işık'
);

select throws_ok(
  $$update public.guardians set search_key = 'x' where id = 'f4100000-0000-0000-0000-0000000f4100'$$,
  '428C9',
  null,
  'the search key cannot be written by hand'
);

select * from finish();
rollback;
