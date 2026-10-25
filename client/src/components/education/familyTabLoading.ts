import { availableEducationSections } from "@/components/educationAccess";
import type { Role, Section } from "./types";

/**
 * Kurum geneli listeler (öğrenci, sınıf, ders programı, ödeme, ödev) hangi
 * rolde ne zaman okunur.
 *
 * Öğrenci ve veli (2026-10-05): liste yalnız onu gösteren sekme açıkken
 * okunur. Genel Bakış'ları kendi sorgularıyla çalışıyor.
 *
 * Personel (2026-10-25, ana plan 5.2): aynı kural. Önceden personelde bütün
 * listeler girişte okunuyordu; yönetici girişi ölçüldü: **34 istek**, yarısı
 * henüz açılmamış sekmelerin listeleri ve onların özetleri. Personelin Genel
 * Bakış'ı da kendi sorgularıyla çalışıyor (`AdminDashboard`,
 * `TeacherDashboard`). Bedeli: bir sekme oturumda ilk açıldığında listesi o an
 * okunur; ikinci açılışta önbellekten gelir.
 *
 * `staffTabs`: personelde listeyi kullanan sekmeler. Öğrenci ve velininkinden
 * geniştir, çünkü personel ekranları (Yoklama, Raporlar, Sınıflar paneli…)
 * aynı listeyi başka yerlerde de kullanıyor. Verilmezse `tabs` geçerlidir.
 */
export function shouldLoadForTab(
  role: Role,
  active: Section,
  tabs: readonly Section[],
  staffTabs: readonly Section[] = tabs
): boolean {
  const ownTabs = role === "student" || role === "parent" ? tabs : staffTabs;
  // Listeyi gösteren sekmelerin hiçbiri bu rolün menüsünde yoksa okunmaz
  // (2026-10-11): öğretmende "Kayıt ve Ödemeler" yok, ama ödeme listesi ve
  // ödeme özeti her öğretmen girişinde okunuyordu.
  const menu = availableEducationSections(role) as Section[];
  if (!ownTabs.some(tab => menu.includes(tab))) return false;
  return ownTabs.includes(active);
}
