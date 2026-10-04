-- Türkçe arama (2026-10-03 kapsamlı analiz turu, ROADMAP §4.23 B18).
--
-- Öğrenci ve veli araması `ilike` ile yapılıyordu. Veritabanının yerel ayarı
-- en_US: büyük/küçük harf eşlemesi Türkçe bilmiyor. Ölçüldü:
--   'İlker' ilike '%ilker%' → false
--   'Işık'  ilike '%ışık%'  → false
--   'Işık'  ilike '%IŞIK%'  → false
-- Ayrıca klavyesinde Türkçe karakter olmayan (ya da hızlı yazan) kullanıcı
-- "isik", "cagri" yazıyor; onlar da hiçbir zaman bulunmuyordu.
--
-- Çözüm: `search_fold` her iki tarafı aynı biçime indirir — Türkçe harfler
-- Latin karşılığına (ı/İ/I→i, ş→s, ğ→g, ü→u, ö→o, ç→c), sonra küçük harf.
-- Öğrenci ve veli tablolarına bu biçimde saklanan (generated) bir `search_key`
-- sütunu eklenir; istemci aranan metni aynı kuralla sadeleştirip o sütunda
-- arar (`client/src/education/turkishSearch.ts` birebir kopyasıdır, test
-- ikisini karşılaştırır).
--
-- Taşınabilirlik: düz Postgres (translate/lower, generated column). Yetki
-- değişmez: `authenticated`'ın bu tablolarda tablo düzeyinde SELECT'i var,
-- RLS satırları süzmeye devam eder. Sütun yazılamaz (generated).

create function public.search_fold(value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(translate(coalesce(value, ''), 'IİıŞşĞğÜüÖöÇç', 'iiissgguuoocc'));
$$;

comment on function public.search_fold(text) is
  'Türkçe aramada iki tarafı aynı biçime indirir: ı/İ/I→i, ş→s, ğ→g, ü→u, ö→o, ç→c, sonra küçük harf. İstemcideki karşılığı client/src/education/turkishSearch.ts (birebir).';

revoke all on function public.search_fold(text) from public, anon;
grant execute on function public.search_fold(text) to authenticated;

alter table public.students
  add column search_key text
  generated always as (
    public.search_fold(full_name || ' ' || coalesce(student_number, ''))
  ) stored;

alter table public.guardians
  add column search_key text
  generated always as (
    public.search_fold(full_name || ' ' || coalesce(phone, ''))
  ) stored;

comment on column public.students.search_key is
  'Arama içindir, gösterilmez: search_fold(ad + numara). Yazılamaz.';
comment on column public.guardians.search_key is
  'Arama içindir, gösterilmez: search_fold(ad + telefon). Yazılamaz.';
