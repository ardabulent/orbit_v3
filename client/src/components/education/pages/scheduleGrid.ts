import { WEEK_DAYS, type WeekDay } from "@/education/weekDays";
import type { ScheduleItem } from "../types";

/**
 * Haftalık ders programı tablosunun saf yardımcıları (karar 2026-09-28:
 * günler sütun, saatler satır; sınıf ve öğretmen süzgeci).
 */

export const ALL = "all";

/** Bugün süren vekillik; anahtar izinli öğretmenin üyeliği. */
export type ScheduleCover = { substitute: string; endsOn: string };
/** Öğretmeni olmayan satırların süzgeç anahtarı. */
export const NO_TEACHER = "none";

export type ScheduleFilter = {
  /** Sınıf kimliği ya da `ALL`. */
  classId: string;
  /** Üyelik kimliği, `NO_TEACHER` ya da `ALL`. */
  teacher: string;
};

const teacherKey = (item: ScheduleItem) => item.membershipId ?? NO_TEACHER;

export function filterSchedule(
  items: ScheduleItem[],
  filter: ScheduleFilter
): ScheduleItem[] {
  return items.filter(
    item =>
      (filter.classId === ALL || item.classId === filter.classId) &&
      (filter.teacher === ALL || teacherKey(item) === filter.teacher)
  );
}

/**
 * Programda geçen öğretmenler, ada göre sıralı. Öğretmensiz satır varsa
 * sona "Öğretmensiz" seçeneği eklenir — atama bekleyenleri bulmanın yolu.
 */
export function teacherOptions(
  items: ScheduleItem[]
): { key: string; label: string }[] {
  const names = new Map<string, string>();
  let hasUnassigned = false;
  for (const item of items) {
    if (!item.membershipId) {
      hasUnassigned = true;
      continue;
    }
    if (!names.has(item.membershipId)) {
      names.set(item.membershipId, item.teacher?.trim() || "Adı okunamadı");
    }
  }
  const collator = new Intl.Collator("tr");
  const options = [...names]
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => collator.compare(a.label, b.label));
  if (hasUnassigned) options.push({ key: NO_TEACHER, label: "Öğretmensiz" });
  return options;
}

export type WeekGrid = {
  days: WeekDay[];
  /** Başlangıç saatleri ("09:00"), sıralı; her satır bir saat. */
  times: string[];
  cell: (day: WeekDay, time: string) => ScheduleItem[];
};

/**
 * Hafta içi beş gün her zaman gösterilir; hafta sonu yalnız o gün ders
 * varsa (dershanelerin çoğu hafta sonu da çalışır ama hepsi değil).
 */
export function buildWeekGrid(items: ScheduleItem[]): WeekGrid {
  const cells = new Map<string, ScheduleItem[]>();
  const times = new Set<string>();
  const usedDays = new Set<WeekDay>();

  for (const item of items) {
    const time = item.time.slice(0, 5);
    times.add(time);
    usedDays.add(item.day);
    const key = `${item.day}|${time}`;
    const list = cells.get(key);
    if (list) list.push(item);
    else cells.set(key, [item]);
  }

  for (const list of cells.values()) {
    list.sort((a, b) => (a.group ?? "").localeCompare(b.group ?? "", "tr"));
  }

  const days = WEEK_DAYS.filter((day, index) => index < 5 || usedDays.has(day));

  return {
    days,
    times: [...times].sort(),
    cell: (day, time) => cells.get(`${day}|${time}`) ?? [],
  };
}

/** Bitiş saati varsa "09:00–09:40", yoksa yalnız başlangıç. */
export function timeRange(item: ScheduleItem): string {
  const start = item.time.slice(0, 5);
  const end = item.endsAt?.slice(0, 5);
  return end ? `${start}–${end}` : start;
}
