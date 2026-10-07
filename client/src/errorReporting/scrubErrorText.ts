/**
 * Hata metninden kişisel veriyi ayıklar (2026-10-05, v1.5-06).
 *
 * Sunucudaki `internal_scrub_error_text` ile aynı kurallar; ikisi birden
 * çalışır. İstemci tarafı, verinin hiç yola çıkmaması içindir; sunucu tarafı,
 * istemciye güvenilmediği için (AGENTS.md).
 *
 *   e-posta            → [e-posta]
 *   6+ haneli sayı     → [sayı]   (TC, telefon, giriş numarası)
 */
export function scrubErrorText(raw: string, maxLength: number): string {
  return raw
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[e-posta]")
    .replace(/[0-9]{6,}/g, "[sayı]")
    .slice(0, maxLength);
}

/** Adres yolundan sorgu ve parçayı atar: arama kutusundaki ad oraya düşebilir. */
export function scrubPath(pathname: string): string {
  return scrubErrorText(pathname.split(/[?#]/)[0] ?? "", 200);
}
