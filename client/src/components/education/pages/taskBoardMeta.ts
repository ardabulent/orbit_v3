import type {
  TaskLabel,
  TaskPriority,
  TaskStatus,
} from "@/education/dayPlanService";

/**
 * Gün Planı panosunun görünen adları ve renkleri — tek yer (K-06).
 *
 * Veritabanı İngilizce anahtar tutuyor (`planned`, `high`, `parent_meeting`…);
 * ekran Türkçe ad gösteriyor. Kart, form ve pano adları buradan okur.
 */

export const TASK_STATUS_META: Record<
  TaskStatus,
  { label: string; hint: string }
> = {
  planned: { label: "Planla", hint: "Sıraya aldıklarınız" },
  today: { label: "Bugün", hint: "Bugün yapacaklarınız" },
  focus: { label: "Odaklan", hint: "Öne aldığınız işler" },
  done: { label: "Tamamlandı", hint: "Bitirdikleriniz" },
};

export const TASK_PRIORITY_META: Record<
  TaskPriority,
  { label: string; tone: "rose" | "blue" | "slate" }
> = {
  high: { label: "Yüksek", tone: "rose" },
  normal: { label: "Normal", tone: "blue" },
  low: { label: "Düşük", tone: "slate" },
};

export const TASK_LABEL_META: Record<
  TaskLabel,
  { label: string; tone: "blue" | "violet" | "amber" | "slate" | "green" }
> = {
  attendance: { label: "Yoklama", tone: "blue" },
  parent_meeting: { label: "Veli görüşmesi", tone: "violet" },
  exam: { label: "Sınav", tone: "amber" },
  homework: { label: "Ödev", tone: "green" },
  report: { label: "Rapor", tone: "slate" },
  enrollment: { label: "Kayıt", tone: "green" },
  other: { label: "Diğer", tone: "slate" },
};

/** "14:00 · 30 dk" — ikisi de yoksa `null`. */
export function formatTaskTiming(
  dueTime: string | null,
  estimatedMinutes: number | null
): string | null {
  const parts = [
    dueTime,
    estimatedMinutes ? `${estimatedMinutes} dk` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}
