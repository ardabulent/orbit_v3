import { ATTENDANCE_STATES } from "@/education/attendanceStatus";
import { formatTrDate } from "@/education/trDate";
import type { AttendanceHistoryRow } from "@/education/attendanceService";
import type { TodayLesson } from "@/education/overviewService";
import type { AttendanceState, ScheduleItem } from "../types";

/**
 * Yoklama sayfasının saf yardımcıları (karar 2026-09-28: ders başına
 * yoklama, varsayılan boş + "Hepsi var").
 */

/** Hangi dersin yoklaması: sınıf + gün + ders + saat. */
export type AttendanceTarget = {
  classId: string;
  className: string;
  sessionDate: string;
  /** Dersi olmayan program satırında (etüt) boş. */
  subjectId: string | null;
  /** "HH:MM:SS" — program satırının başlangıcı. */
  startsAt: string | null;
  /** Ders adı ya da program satırının başlığı. */
  title: string;
};

export type StatusMap = Record<string, AttendanceState | null>;

export type StatusCounts = Record<AttendanceState, number> & {
  unmarked: number;
};

export function countStatuses(
  studentIds: string[],
  statuses: StatusMap
): StatusCounts {
  const counts = { unmarked: 0 } as StatusCounts;
  for (const state of ATTENDANCE_STATES) counts[state] = 0;
  for (const id of studentIds) {
    const state = statuses[id];
    if (state) counts[state] += 1;
    else counts.unmarked += 1;
  }
  return counts;
}

/**
 * İşaretlenmemiş herkesi "Katıldı" yapar; seçilmiş durumlara dokunmaz.
 * Öğretmen önce gelmeyenleri işaretleyip sonra bu düğmeye basarsa emeği
 * silinmez.
 */
export function markRemainingPresent(
  studentIds: string[],
  statuses: StatusMap
): StatusMap {
  const next: StatusMap = { ...statuses };
  for (const id of studentIds) {
    if (!next[id]) next[id] = "Katıldı";
  }
  return next;
}

/** "Matematik · 12-A · 28 Eylül 2026 · 09:00" */
export function attendanceTargetLabel(target: AttendanceTarget): string {
  return [
    target.title,
    target.className,
    formatTrDate(target.sessionDate),
    target.startsAt ? target.startsAt.slice(0, 5) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Kısa sayaç cümlesi: "22 katıldı · 2 gelmedi · 1 seçilmedi". */
export function describeCounts(counts: StatusCounts): string {
  const parts: string[] = [];
  const labels: [AttendanceState, string][] = [
    ["Katıldı", "katıldı"],
    ["Geç kaldı", "geç kaldı"],
    ["Gelmedi", "gelmedi"],
    ["İzinli", "izinli"],
  ];
  for (const [state, label] of labels) {
    if (counts[state] > 0) parts.push(`${counts[state]} ${label}`);
  }
  if (counts.unmarked > 0) parts.push(`${counts.unmarked} seçilmedi`);
  return parts.join(" · ") || "Öğrenci yok";
}

/** "YYYY-MM-DD" + gün; saat dilimine dokunmadan (UTC takvim aritmetiği). */
export function addDaysIso(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const moved = new Date(Date.UTC(y, m - 1, d + days));
  const mm = String(moved.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(moved.getUTCDate()).padStart(2, "0");
  return `${moved.getUTCFullYear()}-${mm}-${dd}`;
}

/** ISO 8601 hafta günü (Pazartesi=1 … Pazar=7) — takvim gününden. */
export function isoWeekDayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 ? 7 : day;
}

/**
 * Bugünkü dersten yoklama hedefi. Ders kimliği ve saat programdan okunur
 * (`today_lessons` ders adını döndürür, kimliğini değil). Program satırı
 * bulunamazsa `null`: yanlış oturum açmaktansa açmamak (K-04).
 */
export function targetFromLesson(
  lesson: TodayLesson,
  schedule: ScheduleItem[],
  today: string
): AttendanceTarget | null {
  const entry = schedule.find(item => item.id === lesson.id);
  if (!entry?.startsAt) return null;
  return {
    classId: lesson.classId,
    className: lesson.className,
    sessionDate: today,
    subjectId: entry.subjectId ?? null,
    startsAt: entry.startsAt,
    title: lesson.title,
  };
}

/** Programdaki satırdan (Geçmiş · başka gün) yoklama hedefi. */
export function targetFromEntry(
  entry: ScheduleItem,
  className: string,
  date: string
): AttendanceTarget | null {
  if (!entry.classId || !entry.startsAt) return null;
  return {
    classId: entry.classId,
    className,
    sessionDate: date,
    subjectId: entry.subjectId ?? null,
    startsAt: entry.startsAt,
    title: entry.title,
  };
}

export function targetFromHistory(row: AttendanceHistoryRow): AttendanceTarget {
  return {
    classId: row.classId,
    className: row.className ?? "Sınıf",
    sessionDate: row.sessionDate,
    subjectId: row.subjectId,
    startsAt: row.startsAt,
    title: row.subjectName ?? (row.startsAt ? "Ders" : "Günlük yoklama"),
  };
}

/** Sınıfın o tarihe denk gelen program satırları, saate göre. */
export function lessonsOnDate(
  schedule: ScheduleItem[],
  classId: string,
  date: string
): ScheduleItem[] {
  const weekday = isoWeekDayOf(date);
  return schedule
    .filter(item => item.classId === classId && item.dayOfWeek === weekday)
    .sort((a, b) => a.time.localeCompare(b.time));
}
