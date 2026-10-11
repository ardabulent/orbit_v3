/**
 * Her sekmenin kendi oturum anahtarı (2026-10-07, ROADMAP §4.23 B17).
 *
 * Oturum `sessionStorage`'da tutuluyor (#132), yani her sekmenin jetonu
 * zaten ayrı. Ama auth-js giriş/çıkış olaylarını bir `BroadcastChannel`
 * üzerinden duyuruyor ve kanalın adı oturum anahtarı (`storageKey`). Anahtar
 * bütün sekmelerde aynı olunca ikinci sekmede başka biri giriş yaptığında
 * olay ilk sekmeye de gidiyordu: ilk sekmenin ekranı ikinci kişinin
 * kimliğine geçebiliyor, istekler ise hâlâ ilk kişinin jetonuyla gidiyordu.
 * Dershanenin ortak bilgisayarı tam bu durum.
 *
 * Anahtar sekmeye özgü olunca kanal da sekmeye özgü olur. Sekme kimliği
 * sekme belleğinde durduğu için sayfa yenilenince aynı kalır, oturum kaybolmaz.
 *
 * Bilinen sınır: tarayıcının "sekmeyi çoğalt" komutu sekme belleğini de
 * kopyalar; çoğaltılan iki sekme aynı kimliği paylaşır. İkisi aynı kişinin
 * aynı oturumudur. Biri çıkış yapıp başkasıyla girerse eski davranış o iki
 * sekme arasında geri gelir.
 */
export const TAB_ID_STORAGE_KEY = "orbit:sekme-kimligi";
const AUTH_KEY_PREFIX = "orbit-oturum-";

type TabStorage = Pick<Storage, "getItem" | "setItem">;

export function tabAuthStorageKey(
  storage: TabStorage | undefined,
  newId: () => string
): string {
  try {
    const existing = storage?.getItem(TAB_ID_STORAGE_KEY);
    if (existing) return AUTH_KEY_PREFIX + existing;
    const id = newId();
    storage?.setItem(TAB_ID_STORAGE_KEY, id);
    return AUTH_KEY_PREFIX + id;
  } catch (error) {
    // Sekme belleği kapalıysa (gizli mod kısıtı vb.) yine de sekmeye özgü bir
    // anahtar üretilir: yalıtım korunur, yalnız yenilemede oturum kalmaz.
    console.warn("[ORBIT] Sekme kimliği saklanamadı.", error);
    return AUTH_KEY_PREFIX + newId();
  }
}

/** Eski, bütün sekmelerde ortak anahtarla saklanmış jetonları temizler. */
export function removeLegacyAuthTokens(
  storage: Pick<Storage, "length" | "key" | "removeItem"> | undefined
): void {
  if (!storage) return;
  const legacy: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
      legacy.push(key);
    }
  }
  for (const key of legacy) storage.removeItem(key);
}

export function newTabId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
