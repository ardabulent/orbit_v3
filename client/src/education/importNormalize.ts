import type { ImportRow } from "./studentImport";
import { turkishNameKey } from "./turkishSearch";

/**
 * "Dosyayı olduğu gibi yükle" (2026-10-02). Kullanıcı: kurumun listesini
 * ORBIT'in biçimine "her girişi elle yazmak" zaman kaybettiriyor. Sütun
 * eşlemesi (#419) başlıkları çözdü; bu modül HÜCRE değerlerindeki farkları
 * çözer — elle düzeltilecek tek hücre kalmasın:
 *
 *   - Sınıf adı: dosyada "12A", ORBIT'te "12-A Sayısal". Her farklı değer
 *     için bir kez sorulur; yakın ad önerilir.
 *   - BÜYÜK HARFLE yazılmış adlar: "AYŞE KOÇ" → "Ayşe Koç" (Türkçe i/İ).
 *
 * Sınıf eşleşmesi veritabanındaki `turkish_name_key` ile aynı kuralı izler:
 * büyük/küçük harf ve Türkçe harf farkı gözetilmez. Son söz yine
 * `import_students`'tadır.
 */

/**
 * `public.turkish_name_key`'in birebir kopyası (turkishSearch.ts). 2026-10-03
 * düzeltmesi: burada `toLocaleLowerCase("tr")` vardı ve "I"yı "ı" yapıyordu,
 * veritabanı "i" yapıyor — "IŞIK" sınıfı ekranda eşleşip kayıtta reddedilirdi.
 */
export { turkishNameKey };

/** Öneri için daha gevşek anahtar: boşluk, tire, nokta ve "/" yok sayılır. */
const looseKey = (value: string) =>
  turkishNameKey(value).replace(/[\s\-./_]+/g, "");

export type ClassChoice = string | null;

/**
 * Dosyadaki sınıf değeri için ORBIT sınıfı önerisi:
 *   1. Tam eşleşme (harf farkı gözetmeden) → o sınıf.
 *   2. Gevşek anahtarda tam eşleşme ("12 A" = "12-A").
 *   3. Gevşek anahtar biri ötekinin başıysa ve TEK aday varsa ("12A" →
 *      "12-A Sayısal"). İki aday varsa ("12-A Sayısal", "12-A Eşit Ağırlık")
 *      öneri yapılmaz; kullanıcı seçer.
 */
export function suggestClass(value: string, classNames: string[]): ClassChoice {
  const exact = classNames.find(
    name => turkishNameKey(name) === turkishNameKey(value)
  );
  if (exact) return exact;

  const key = looseKey(value);
  if (!key) return null;
  const loose = classNames.filter(name => looseKey(name) === key);
  if (loose.length === 1) return loose[0];

  const prefix = classNames.filter(name => {
    const other = looseKey(name);
    return other.startsWith(key) || key.startsWith(other);
  });
  return prefix.length === 1 ? prefix[0] : null;
}

/** Dosyadaki farklı sınıf değerleri, ilk görülme sırasıyla; boşlar hariç. */
export function distinctClassValues(rows: ImportRow[]): string[] {
  const seen = new Map<string, string>();
  for (const row of rows) {
    const value = row.class_name.trim();
    if (value && !seen.has(turkishNameKey(value))) {
      seen.set(turkishNameKey(value), value);
    }
  }
  return [...seen.values()];
}

/** Sınıf seçimi: dosya değeri → ORBIT sınıf adı, "" = sınıfsız bırak. */
export type ClassMap = Record<string, string>;

/** İlk öneriler: eşleşen sınıf ya da seçim bekleyen (undefined). */
export function initialClassMap(
  values: string[],
  classNames: string[]
): ClassMap {
  const map: ClassMap = {};
  for (const value of values) {
    const suggestion = suggestClass(value, classNames);
    if (suggestion !== null) map[turkishNameKey(value)] = suggestion;
  }
  return map;
}

/** Seçimi bekleyen dosya değerleri (ne sınıf ne "sınıfsız" seçilmiş). */
export function unresolvedClassValues(
  values: string[],
  map: ClassMap
): string[] {
  return values.filter(value => !(turkishNameKey(value) in map));
}

export function applyClassMap(rows: ImportRow[], map: ClassMap): ImportRow[] {
  return rows.map(row => {
    const value = row.class_name.trim();
    if (!value) return row;
    const chosen = map[turkishNameKey(value)];
    return chosen === undefined ? row : { ...row, class_name: chosen };
  });
}

const hasLetters = (value: string) => /\p{L}/u.test(value);
const isAllCaps = (value: string) =>
  hasLetters(value) && value === value.toLocaleUpperCase("tr");

/** Adların çoğu BÜYÜK HARFLE mi yazılmış (düzeltme önerilsin mi). */
export function mostlyAllCaps(names: string[]): boolean {
  const withLetters = names.filter(hasLetters);
  if (withLetters.length === 0) return false;
  return withLetters.filter(isAllCaps).length / withLetters.length > 0.5;
}

/**
 * "AYŞE NUR KOÇ-YILMAZ" → "Ayşe Nur Koç-Yılmaz". Türkçe kuralıyla: "I" → "ı",
 * "İ" → "i". Yalnız tamamı büyük harf olan adlara dokunur; "Ayşe McAdam"
 * gibi bilinçli yazımlar korunur.
 */
export function fixAllCaps(name: string): string {
  if (!isAllCaps(name)) return name;
  return name
    .toLocaleLowerCase("tr")
    .replace(
      /(^|[\s\-'])(\p{L})/gu,
      (_, before: string, letter: string) =>
        before + letter.toLocaleUpperCase("tr")
    );
}

export function applyNameFix(rows: ImportRow[]): ImportRow[] {
  return rows.map(row => ({
    ...row,
    full_name: fixAllCaps(row.full_name),
    guardian_name: fixAllCaps(row.guardian_name),
  }));
}
