/**
 * Hata metninden kişisel veriyi ayıklar (2026-10-05, v1.5-06).
 *
 * Sunucudaki `internal_scrub_error_text` ile aynı kurallar; ikisi birden
 * çalışır. İstemci tarafı, verinin hiç yola çıkmaması içindir; sunucu tarafı,
 * istemciye güvenilmediği için (AGENTS.md).
 *
 *   e-posta                         → [e-posta]
 *   TR IBAN (boşluklu ya da bitişik) → [iban]
 *   ayraçlı rakam grupları          → [sayı]   (0532 111 22 33, +90 (532) 111-22-33,
 *                                               123-456-789-01; tarih ve IP de düşer)
 *   6+ bitişik rakam                → [sayı]   (TC, telefon, giriş numarası)
 *
 * 2026-10-23 (ana plan 1.1, test turu B6): yalnız bitişik rakam aranıyordu;
 * boşluklu ve tireli telefon geçiyor, panel yine "ayıklanmıştır" diyordu.
 *
 * Desenler JavaScript ile Postgres'in (ARE) ortak sözdizimiyle yazılır ve
 * sunucudaki göçte AYNI metinle, AYNI sırayla durur;
 * `supabase/tests/deployment/scrubRulesTwin.test.ts` bunu zorlar.
 */
export const SCRUB_RULES: ReadonlyArray<{
  pattern: string;
  replacement: string;
}> = [
  {
    pattern: "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}",
    replacement: "[e-posta]",
  },
  {
    pattern: "[Tt][Rr][0-9]{2}(?: ?[0-9]{4}){5} ?[0-9]{2}",
    replacement: "[iban]",
  },
  {
    pattern:
      "(?:\\+[0-9]{1,3}[ .-]?)?\\(?[0-9]{2,4}\\)?(?:[ ./-]+[0-9]{2,4}){2,}",
    replacement: "[sayı]",
  },
  { pattern: "[0-9]{6,}", replacement: "[sayı]" },
];

const compiled = SCRUB_RULES.map(rule => ({
  regex: new RegExp(rule.pattern, "g"),
  replacement: rule.replacement,
}));

export function scrubErrorText(raw: string, maxLength: number): string {
  return compiled
    .reduce((text, rule) => text.replace(rule.regex, rule.replacement), raw)
    .slice(0, maxLength);
}

/** Adres yolundan sorgu ve parçayı atar: arama kutusundaki ad oraya düşebilir. */
export function scrubPath(pathname: string): string {
  return scrubErrorText(pathname.split(/[?#]/)[0] ?? "", 200);
}
