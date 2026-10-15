import type { Role, Section } from "./types";

/**
 * Alt gezinme çubuğundaki ekranlar ve kısa adları (2026-10-15). Dar çubukta
 * beş sütun var; dördü burada, beşincisi "Menü". Bileşen dosyasından ayrı:
 * `react-refresh/only-export-components`.
 */
export function bottomNavSections(
  role: Role
): { section: Section; label: string }[] {
  if (role === "student") {
    return [
      { section: "Genel Bakış", label: "Özet" },
      { section: "Ders Programı", label: "Program" },
      { section: "Ödevler", label: "Ödevler" },
      { section: "Sınavlar", label: "Sınavlar" },
    ];
  }
  if (role === "parent") {
    return [
      { section: "Genel Bakış", label: "Özet" },
      { section: "Ders Programı", label: "Program" },
      { section: "Sınavlar", label: "Sınavlar" },
      { section: "İletişim", label: "İletişim" },
    ];
  }
  return [];
}
