-- Hata kaydında boşluklu ve tireli kişisel numaralar da ayıklanır (2026-10-23).
--
-- Ana plan 1.1, test turu B6/B14: `internal_scrub_error_text` yalnız 6+
-- bitişik rakamı arıyordu. "0532 111 22 33", "+90 (532) 111-22-33",
-- "123-456-789-01" (TC) ve boşluklu IBAN ayıklanmadan kayda düşüyor, platform
-- panelindeki "kişisel veri ayıklanmıştır" cümlesi yanlış oluyordu.
--
-- Kurallar sırayla (istemcideki `client/src/errorReporting/scrubErrorText.ts`
-- `SCRUB_RULES` ile aynı metin ve sıra; `scrubRulesTwin.test.ts` zorlar):
--   1. e-posta                          → [e-posta]
--   2. TR IBAN (boşluklu ya da bitişik)  → [iban]
--   3. ayraçlı rakam grupları           → [sayı]  (telefon, TC; tarih ve IP de)
--   4. 6+ bitişik rakam                 → [sayı]
--
-- Tarih ve IP adresinin de düşmesi bilinçli: hata metnindeki bir tarih doğum
-- tarihi olabilir, IP adresi kişisel veridir. Hata ayıklamaya bedeli küçük.
--
-- Mevcut kayıtlar da yeni kuralla yeniden ayıklanır. Satır silinmez; yalnız
-- metin alanları ayıklanmış hâliyle güncellenir.

create or replace function public.internal_scrub_error_text(raw text, max_length integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            coalesce(raw, ''),
            '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[e-posta]', 'g'
          ),
          '[Tt][Rr][0-9]{2}(?: ?[0-9]{4}){5} ?[0-9]{2}', '[iban]', 'g'
        ),
        '(?:\+[0-9]{1,3}[ .-]?)?\(?[0-9]{2,4}\)?(?:[ ./-]+[0-9]{2,4}){2,}', '[sayı]', 'g'
      ),
      '[0-9]{6,}', '[sayı]', 'g'
    ),
    max_length
  );
$$;

revoke all on function public.internal_scrub_error_text(text, integer)
  from public, anon, authenticated;

update public.client_error_reports
set
  message = public.internal_scrub_error_text(message, 500),
  stack = nullif(public.internal_scrub_error_text(stack, 4000), ''),
  path = nullif(public.internal_scrub_error_text(path, 200), '')
where message is distinct from public.internal_scrub_error_text(message, 500)
   or stack is distinct from nullif(public.internal_scrub_error_text(stack, 4000), '')
   or path is distinct from nullif(public.internal_scrub_error_text(path, 200), '');
