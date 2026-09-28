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
 * Bugünkü yoklama `today_lessons`'tan gelir (sınıf başına günlük oturum):
 *   - "taken"    bugün dersi var, yoklama alındı
 *   - "pending"  bugün dersi var, yoklama alınmadı
 *   - "unknown"  bugün dersi var ama çağıran yoklamayı göremiyor (vekil)
 *   - "none"     bugün programda dersi yok
 */
export type TodayAttendance = "taken" | "pending" | "unknown" | "none";

export type ClassSummary = {
  weeklyLessons: number;
  /** Ders adı ve öğretmeni; aynı ikili bir kez. Öğretmen yoksa `null`. */
  subjects: { title: string; teacher: string | null }[];
  today: TodayAttendance;
};

const EMPTY: ClassSummary = { weeklyLessons: 0, subjects: [], today: "none" };

export function buildClassSummaries(
  schedule: ScheduleItem[],
  todayLessons: TodayLesson[]
): Map<string, ClassSummary> {
  const summaries = new Map<string, ClassSummary>();
  const get = (classId: string) => {
    let summary = summaries.get(classId);
    if (!summary) {
      summary = { weeklyLessons: 0, subjects: [], today: "none" };
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

  for (const lesson of todayLessons) {
    const summary = get(lesson.classId);
    // Sınıfın bugünkü oturumu tek; bir derste "alındı" görünüyorsa hepsinde
    // öyledir. Bilinmeyen (null) bir satır bilinen durumu ezmez.
    if (lesson.attendanceTaken === true) summary.today = "taken";
    else if (lesson.attendanceTaken === false && summary.today !== "taken")
      summary.today = "pending";
    else if (lesson.attendanceTaken === null && summary.today === "none")
      summary.today = "unknown";
  }

  return summaries;
}

export function summaryFor(
  summaries: Map<string, ClassSummary>,
  classId: string
): ClassSummary {
  return summaries.get(classId) ?? EMPTY;
}
