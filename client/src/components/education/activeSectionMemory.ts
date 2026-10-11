import { availableEducationSections } from "@/components/educationAccess";
import type { Role, Section } from "./types";

/**
 * Açık sekmenin sayfa yenilemede korunması (2026-10-11, ROADMAP §4.24 C-01).
 *
 * Sekme yalnız React durumundaydı; F5 her zaman Genel Bakış'a döndürüyordu.
 * Adres çubuğu (`#…`) bilerek kullanılmadı: o kısmı Supabase'in giriş ve
 * şifre kurtarma bağlantıları okuyor.
 *
 * Sekme belleği (`sessionStorage`) kullanıcıya göre ayrı anahtarla tutulur:
 * ortak bilgisayarda sonraki kişiye geçmez, sekme kapanınca silinir.
 * Saklanan sekme o rolün menüsünde yoksa (rol değişmiş, sekme kaldırılmış)
 * Genel Bakış açılır.
 */
export const DEFAULT_SECTION: Section = "Genel Bakış";

const storageKey = (userId: string) => `orbit:aktif-sekme:${userId}`;

type ReadStorage = Pick<Storage, "getItem">;
type WriteStorage = Pick<Storage, "setItem">;

export function readActiveSection(
  storage: ReadStorage | undefined,
  userId: string | null | undefined,
  role: Role
): Section {
  if (!storage || !userId) return DEFAULT_SECTION;
  try {
    const saved = storage.getItem(storageKey(userId));
    const allowed = availableEducationSections(role) as Section[];
    return saved && allowed.includes(saved as Section)
      ? (saved as Section)
      : DEFAULT_SECTION;
  } catch (error) {
    console.warn("[ORBIT] Açık sekme okunamadı.", error);
    return DEFAULT_SECTION;
  }
}

export function writeActiveSection(
  storage: WriteStorage | undefined,
  userId: string | null | undefined,
  section: Section
): void {
  if (!storage || !userId) return;
  try {
    storage.setItem(storageKey(userId), section);
  } catch (error) {
    console.warn("[ORBIT] Açık sekme saklanamadı.", error);
  }
}
