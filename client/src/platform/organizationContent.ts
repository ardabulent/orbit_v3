/**
 * Kurum içerik tablolarının okunabilir adları (2026-10-25, ana plan 2.5).
 *
 * Sunucu içerik listesini katalogdan çıkarır (`organization_id` taşıyan her
 * tablo); yeni bir tablo eklendiği gün sayaçta ve boşaltmada kendiliğinden
 * görünür. Burada adı yoksa ham tablo adıyla gösterilir — gizlenmez, çünkü
 * silinecek bir şeyi göstermemek operatörü eksik bilgiyle onaylatır.
 */
const CONTENT_TABLE_LABELS: Record<string, string> = {
  students: "öğrenci",
  guardians: "veli",
  student_guardians: "öğrenci–veli bağı",
  classes: "sınıf",
  class_enrollments: "sınıf kaydı",
  class_teachers: "sınıf öğretmeni ataması",
  subjects: "ders",
  rooms: "derslik",
  schedule_entries: "ders programı satırı",
  schedule_templates: "program şablonu",
  schedule_template_slots: "şablon saati",
  substitute_assignments: "vekil ataması",
  attendance_sessions: "yoklama oturumu",
  attendance_records: "yoklama kaydı",
  exams: "sınav",
  exam_sections: "sınav bölümü",
  exam_results: "sınav sonucu",
  exam_section_results: "sınav bölüm sonucu",
  exam_absences: "sınava girmedi kaydı",
  homework_assignments: "ödev",
  homework_submissions: "ödev teslimi",
  payment_plans: "ödeme planı",
  installments: "taksit",
  daily_feed_posts: "duyuru",
  calendar_events: "takvim etkinliği",
  tasks: "görev",
  conversations: "sohbet",
  messages: "mesaj",
  notifications: "bildirim",
  client_error_reports: "ekran hata kaydı",
};

export type ContentLine = { table: string; label: string; rows: number };

/** `{tablo: adet}` → çoktan aza sıralı satırlar; sıfır ve bozuk değer atılır. */
export function describeContent(
  content: Record<string, unknown> | null | undefined
): ContentLine[] {
  if (!content) return [];
  return Object.entries(content)
    .map(([table, value]) => ({
      table,
      label: CONTENT_TABLE_LABELS[table] ?? table,
      rows: Number(value),
    }))
    .filter(line => Number.isInteger(line.rows) && line.rows > 0)
    .sort((a, b) => b.rows - a.rows || a.label.localeCompare(b.label, "tr"));
}

export function totalContentRows(lines: ContentLine[]): number {
  return lines.reduce((sum, line) => sum + line.rows, 0);
}
