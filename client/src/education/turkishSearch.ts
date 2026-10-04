/**
 * Türkçe arama ve ad karşılaştırma anahtarları — veritabanındaki iki
 * fonksiyonun BİREBİR kopyası (2026-10-03). İkisi ayrışırsa ekran "eşleşti"
 * der, veritabanı "yok" der; test (`turkishSearch.test.ts`) aynı girdilerin
 * aynı sonucu verdiğini sabitler.
 *
 * Neden `toLocaleLowerCase("tr")` değil: o "I"yı "ı" yapar, veritabanı "i"
 * yapıyor; ve "isik" yazan kullanıcı "Işık"ı yine bulamazdı.
 */

const fold = (value: string, from: string, to: string) =>
  Array.from(value, ch => {
    const i = from.indexOf(ch);
    return i === -1 ? ch : to[i];
  }).join("");

/**
 * `public.search_fold`: ı/İ/I→i, ş→s, ğ→g, ü→u, ö→o, ç→c, sonra küçük harf.
 * Arama içindir; "Işık", "ışık", "IŞIK" ve "isik" aynı anahtara iner.
 */
export function searchFold(value: string): string {
  return fold(value, "IİıŞşĞğÜüÖöÇç", "iiissgguuoocc").toLowerCase();
}

/**
 * `public.turkish_name_key`: Türkçe harfleri korur (ş, ğ, ü, ö, ç kalır),
 * yalnız büyük/küçük ve ı/i farkını siler. Sınıf adı eşlemesi bunu kullanır.
 */
export function turkishNameKey(value: string): string {
  return fold(value, "IİıŞĞÜÖÇ", "iiişğüöç").trim().toLowerCase();
}

/** Metin aranan ifadeyi içeriyor mu (iki taraf da `searchFold`'dan geçer). */
export function matchesSearch(
  text: string | null | undefined,
  query: string
): boolean {
  const q = searchFold(query.trim());
  return !q || searchFold(text ?? "").includes(q);
}

/** `ilike` deseni: sadeleştirilmiş ifade, `%` `_` `\` kaçışlı, iki yanı `%`. */
export function searchPattern(query: string): string {
  const safe = searchFold(query.trim()).replace(/[\\%_]/g, ch => `\\${ch}`);
  return `%${safe}%`;
}
