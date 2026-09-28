import type { Homework } from "../types";
import { addDaysIso } from "./attendanceSheet";

/**
 * Ödevler ekranının saf yardımcıları (karar 2026-09-29).
 *
 * "Teslim" kararını yalnız öğretmen verir (öğrenci işaretlemez): bir
 * ödevde öğrencinin durumu, öğretmen işaretlemeyi bitirdiyse satırın
 * varlığından ("teslim edildi" / "getirilmedi"), bitirmediyse tarihten
 * gelir. İşaretleme bitmeden "getirilmedi" denmez (K-03).
 */

export type StaffHomeworkGroups = {
  /** Teslim tarihi geçmiş, işaretlemesi bitmemiş. */
  toCheck: Homework[];
  /** Teslim tarihi bugün ya da ileride, işaretlemesi bitmemiş. */
  active: Homework[];
  /** İşaretlemesi bitmiş. */
  done: Homework[];
};

export function groupStaffHomework(
  items: Homework[],
  today: string
): StaffHomeworkGroups {
  const groups: StaffHomeworkGroups = { toCheck: [], active: [], done: [] };
  for (const item of items) {
    if (item.submissionsRecordedAt) groups.done.push(item);
    else if (item.rawDueDate < today) groups.toCheck.push(item);
    else groups.active.push(item);
  }
  // Kontrol bekleyen: en eski önce (en çok bekleyen). Aktif: en yakın önce.
  // Tamamlanan: en yeni önce.
  groups.toCheck.sort((a, b) => a.rawDueDate.localeCompare(b.rawDueDate));
  groups.active.sort((a, b) => a.rawDueDate.localeCompare(b.rawDueDate));
  groups.done.sort((a, b) => b.rawDueDate.localeCompare(a.rawDueDate));
  return groups;
}

export type StudentHomeworkStatus =
  | { kind: "delivered"; label: "Teslim edildi"; tone: "green" }
  | { kind: "missed"; label: "Getirilmedi"; tone: "rose" }
  | { kind: "pending"; label: "Kontrol bekleniyor"; tone: "slate" }
  | { kind: "upcoming"; label: string; tone: "amber" | "blue" };

export function studentHomeworkStatus(
  item: Homework,
  delivered: boolean,
  today: string
): StudentHomeworkStatus {
  if (item.submissionsRecordedAt) {
    return delivered
      ? { kind: "delivered", label: "Teslim edildi", tone: "green" }
      : { kind: "missed", label: "Getirilmedi", tone: "rose" };
  }
  // Öğretmen işaretlemeyi bitirmeden de teslim alınmış olabilir.
  if (delivered)
    return { kind: "delivered", label: "Teslim edildi", tone: "green" };
  if (item.rawDueDate < today)
    return { kind: "pending", label: "Kontrol bekleniyor", tone: "slate" };
  if (item.rawDueDate === today)
    return { kind: "upcoming", label: "Bugün teslim", tone: "amber" };
  if (item.rawDueDate === addDaysIso(today, 1))
    return { kind: "upcoming", label: "Yarın teslim", tone: "amber" };
  return {
    kind: "upcoming",
    label: `${daysBetween(today, item.rawDueDate)} gün kaldı`,
    tone: "blue",
  };
}

function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  return Math.round(
    (Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000
  );
}

export type StudentHomeworkGroups = {
  upcoming: Homework[];
  missed: Homework[];
  past: Homework[];
};

/** Yaklaşan (en yakın önce) · Getirilmedi · Geçmiş (en yeni önce). */
export function groupStudentHomework(
  items: Homework[],
  deliveredIds: Set<string>,
  today: string
): StudentHomeworkGroups {
  const groups: StudentHomeworkGroups = { upcoming: [], missed: [], past: [] };
  for (const item of items) {
    const status = studentHomeworkStatus(
      item,
      deliveredIds.has(item.id),
      today
    );
    if (status.kind === "upcoming") groups.upcoming.push(item);
    else if (status.kind === "missed") groups.missed.push(item);
    else groups.past.push(item);
  }
  groups.upcoming.sort((a, b) => a.rawDueDate.localeCompare(b.rawDueDate));
  groups.missed.sort((a, b) => b.rawDueDate.localeCompare(a.rawDueDate));
  groups.past.sort((a, b) => b.rawDueDate.localeCompare(a.rawDueDate));
  return groups;
}
