import { availableEducationSections } from "@/components/educationAccess";
import type { Role, Section } from "./types";

/**
 * Kurum geneli listeler (öğrenci, sınıf, ders programı, ödeme, ödev) hangi
 * rolde ne zaman okunur (2026-10-05).
 *
 * Personel (yönetici, öğretmen) için davranış değişmedi: listeler girişte
 * okunur ve sekmeler arasında anında açılır.
 *
 * Öğrenci ve velinin Genel Bakış'ı kendi sorgularıyla çalışıyor; bu listeleri
 * kullanmıyor. Yine de girişte hepsi okunuyordu — RLS öğrenciye başkasının
 * verisini döndürmüyordu, yani güvenlik açığı değildi, ama her öğrenci ve
 * veli girişi on kadar boş yere istek üretiyordu. Kurumdaki girişlerin
 * çoğunluğu öğrenci ve veliden geldiği için pik yükün büyük kısmı buydu.
 * Artık bu rollerde liste yalnız onu gösteren sekme açıkken okunur.
 */
export function shouldLoadForTab(
  role: Role,
  active: Section,
  tabs: readonly Section[]
): boolean {
  // Listeyi gösteren sekmelerin hiçbiri bu rolün menüsünde yoksa okunmaz
  // (2026-10-11): öğretmende "Kayıt ve Ödemeler" yok, ama ödeme listesi ve
  // ödeme özeti her öğretmen girişinde okunuyordu.
  const menu = availableEducationSections(role) as Section[];
  if (!tabs.some(tab => menu.includes(tab))) return false;
  if (role !== "student" && role !== "parent") return true;
  return tabs.includes(active);
}
