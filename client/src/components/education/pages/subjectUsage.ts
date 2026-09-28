import type { ScheduleItem } from "../types";

/**
 * Dersin kurumda nerede okutulduğu — ders programından türetilir.
 *
 * Dersler listesi eskiden yalnız adları gösteriyordu; hangi dersin programda
 * hiç yer almadığı (kapatılmaya aday) oradan anlaşılmıyordu. Kaynak
 * `classSummaries` ile aynıdır: ders programı, iki rolde de tam görünür.
 */
export type SubjectUsage = {
  weeklyLessons: number;
  /** Sınıf adları, alfabetik; aynı sınıf bir kez. */
  classes: string[];
  /** Öğretmen adları, alfabetik; öğretmensiz satırlar sayılmaz. */
  teachers: string[];
};

const EMPTY: SubjectUsage = { weeklyLessons: 0, classes: [], teachers: [] };

export function buildSubjectUsage(
  schedule: ScheduleItem[]
): Map<string, SubjectUsage> {
  const acc = new Map<
    string,
    { weeklyLessons: number; classes: Set<string>; teachers: Set<string> }
  >();

  for (const lesson of schedule) {
    if (!lesson.subjectId) continue;
    let entry = acc.get(lesson.subjectId);
    if (!entry) {
      entry = { weeklyLessons: 0, classes: new Set(), teachers: new Set() };
      acc.set(lesson.subjectId, entry);
    }
    entry.weeklyLessons += 1;
    const group = lesson.group?.trim();
    if (group) entry.classes.add(group);
    const teacher = lesson.teacher?.trim();
    if (teacher) entry.teachers.add(teacher);
  }

  const collator = new Intl.Collator("tr");
  const usage = new Map<string, SubjectUsage>();
  for (const [subjectId, entry] of acc) {
    usage.set(subjectId, {
      weeklyLessons: entry.weeklyLessons,
      classes: [...entry.classes].sort(collator.compare),
      teachers: [...entry.teachers].sort(collator.compare),
    });
  }
  return usage;
}

export function usageFor(
  usage: Map<string, SubjectUsage>,
  subjectId: string
): SubjectUsage {
  return usage.get(subjectId) ?? EMPTY;
}

/** Tek satırlık özet; programda yoksa bunu açıkça söyler. */
export function describeSubjectUsage(usage: SubjectUsage): string {
  if (usage.weeklyLessons === 0) return "Ders programında yok";
  return [
    `Haftada ${usage.weeklyLessons} ders`,
    usage.classes.join(", "),
    usage.teachers.length > 0 ? usage.teachers.join(", ") : "Öğretmensiz",
  ]
    .filter(Boolean)
    .join(" · ");
}
