import type { TodayLesson } from "@/education/overviewService";
import type { ScheduleItem } from "../types";

/**
 * Sınıf kartının özeti — ders programından ve bugünün derslerinden türetilir.
 *
 * "Hangi ders, hangi öğretmen" bilgisi `class_teachers`'tan değil **ders
 * programından** gelir: öğretmen `class_teachers`'ta yalnız kendi atamasını
 * görebiliyor (`class_teachers_select_self`), programda ise okuttuğu sınıfın
 * bütün derslerini. Kart iki rolde de aynı şeyi söylesin diye kaynak ortak.
 *
 * Bugünkü yoklama `today_lessons`'tan gelir; yoklama DERS BAŞINA alınır
 * (karar 2026-09-28, `20261006000000`):
 *   - "taken"    bugünkü derslerin hepsinin yoklaması alındı
 *   - "partial"  bir kısmının alındı (`todayTaken`/`todayLessons`)
 *   - "pending"  hiçbirinin alınmadı
 *   - "unknown"  çağıran bu sınıfın yoklamasını göremiyor (satırlar NULL)
 *   - "none"     bugün programda dersi yok
 */
export type TodayAttendance =
  "taken" | "partial" | "pending" | "unknown" | "none";

export type ClassSummary = {
  weeklyLessons: number;
  /** Ders adı ve öğretmeni; aynı ikili bir kez. Öğretmen yoksa `null`. */
  subjects: { title: string; teacher: string | null }[];
  today: TodayAttendance;
  /** Bugünkü ders sayısı ve yoklaması alınanlar (bilinmeyenler sayılmaz). */
  todayLessons: number;
  todayTaken: number;
};

const EMPTY: ClassSummary = {
  weeklyLessons: 0,
  subjects: [],
  today: "none",
  todayLessons: 0,
  todayTaken: 0,
};

export function buildClassSummaries(
  schedule: ScheduleItem[],
  todayLessons: TodayLesson[]
): Map<string, ClassSummary> {
  const summaries = new Map<string, ClassSummary>();
  const get = (classId: string) => {
    let summary = summaries.get(classId);
    if (!summary) {
      summary = { ...EMPTY, subjects: [] };
      summaries.set(classId, summary);
    }
    return summary;
  };

  for (const lesson of schedule) {
    if (!lesson.classId) continue;
    const summary = get(lesson.classId);
    summary.weeklyLessons += 1;
    const title = lesson.title.trim();
    const teacher = lesson.teacher?.trim() || null;
    if (
      title &&
      !summary.subjects.some(s => s.title === title && s.teacher === teacher)
    ) {
      summary.subjects.push({ title, teacher });
    }
  }

  const known = new Map<string, number>();
  for (const lesson of todayLessons) {
    const summary = get(lesson.classId);
    summary.todayLessons += 1;
    // Bilinmeyen (null) satır sayılmaz: "alınmadı" değil, görünmüyor.
    if (lesson.attendanceTaken === null) continue;
    known.set(lesson.classId, (known.get(lesson.classId) ?? 0) + 1);
    if (lesson.attendanceTaken) summary.todayTaken += 1;
  }
  for (const [classId, summary] of summaries) {
    if (summary.todayLessons === 0) continue;
    const knownCount = known.get(classId) ?? 0;
    summary.today =
      knownCount === 0
        ? "unknown"
        : summary.todayTaken === 0
          ? "pending"
          : summary.todayTaken === knownCount
            ? "taken"
            : "partial";
  }

  return summaries;
}

export function summaryFor(
  summaries: Map<string, ClassSummary>,
  classId: string
): ClassSummary {
  return summaries.get(classId) ?? EMPTY;
}
