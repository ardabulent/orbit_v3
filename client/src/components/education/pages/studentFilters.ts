import type { Student } from "../types";

/**
 * Öğrenci listesinin hızlı süzgeçleri.
 *
 * Tanımlar Genel Bakış'ın saydığıyla aynı (`admin_overview_counts`): sınıfsız
 * = aktif bir sınıfta aktif kaydı yok; velisiz = aktif veli bağı yok. Liste
 * tarafı bunları `studentService`'in arşivi eleyen `group` / `parent`
 * alanlarından okur. Böylece "2 öğrenci sınıfsız" satırına tıklayan kişi
 * listede de 2 öğrenci görür — liste 100 satır tavanına dayanmadıkça.
 *
 * Ödeme bilgisi Öğrenciler sekmesinde gösterilmez; yeri Kayıt ve Ödemeler sekmesi (karar 2026-09-28).
 */
export type StudentFilter = "all" | "no-class" | "no-guardian" | "no-account";

export const STUDENT_FILTERS: {
  id: StudentFilter;
  label: string;
  /** Yalnız yöneticinin gördüğü bilgiye dayanan süzgeçler. */
  adminOnly?: boolean;
}[] = [
  { id: "all", label: "Tümü" },
  // Öğretmen yalnız kendi sınıflarının öğrencilerini görür: "Sınıfsız" onda
  // hep 0 olur ve ikisini de çözmek yöneticinin işi (2026-09-28).
  { id: "no-class", label: "Sınıfsız", adminOnly: true },
  { id: "no-guardian", label: "Velisiz", adminOnly: true },
  { id: "no-account", label: "Hesabı yok", adminOnly: true },
];

export function matchesStudentFilter(
  student: Student,
  filter: StudentFilter
): boolean {
  switch (filter) {
    case "no-class":
      return !student.group;
    case "no-guardian":
      return !student.parent;
    case "no-account":
      // `undefined` bilinmiyor demek (demo verisi); hesapsız sayılmaz.
      return student.hasAccount === false;
    default:
      return true;
  }
}

export function countByFilter(
  students: Student[]
): Record<StudentFilter, number> {
  const counts = {
    all: 0,
    "no-class": 0,
    "no-guardian": 0,
    "no-account": 0,
  } satisfies Record<StudentFilter, number>;
  for (const student of students) {
    for (const filter of Object.keys(counts) as StudentFilter[]) {
      if (matchesStudentFilter(student, filter)) counts[filter] += 1;
    }
  }
  return counts;
}

/** Puan Türkçe ondalıkla yazılır: 87,5 — 87.5 değil. */
export function formatScore(value: number): string {
  return value.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
}
