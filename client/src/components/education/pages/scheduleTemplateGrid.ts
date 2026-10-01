import type { IsoWeekDay } from "@/education/weekDays";
import type {
  ScheduleTemplate,
  TemplateSlot,
} from "@/education/scheduleTemplateService";

/**
 * Şablon düzenleyicisinin saf yardımcıları (2026-10-01). Ekran bir tablo:
 * satırlar ders saatleri, sütunlar günler; her hücrede bir ders seçilir.
 * Satırın kimliği (`key`) saat değişse de sabit kalır, hücreler ona bağlıdır.
 */

export type TemplateHour = { key: string; startsAt: string; endsAt: string };

export type TemplateEditorState = {
  hours: TemplateHour[];
  /** Pazar sütunu gösteriliyor mu (Pazartesi–Cumartesi her zaman görünür). */
  sunday: boolean;
  /** `${gün}|${saat anahtarı}` → ders kimliği */
  cells: Record<string, string>;
};

/** Tablo başlıklarındaki kısa gün adları. */
export const DAY_SHORT: Record<IsoWeekDay, string> = {
  1: "Pzt",
  2: "Sal",
  3: "Çar",
  4: "Per",
  5: "Cum",
  6: "Cmt",
  7: "Paz",
};

export const WEEKDAYS_SHOWN: IsoWeekDay[] = [1, 2, 3, 4, 5, 6];

export const cellKey = (day: IsoWeekDay, hourKey: string) =>
  `${day}|${hourKey}`;

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const toHhmm = (minutes: number) => {
  const clamped = Math.min(Math.max(minutes, 0), 23 * 60 + 59);
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(
    clamped % 60
  ).padStart(2, "0")}`;
};

const LESSON_MINUTES = 40;
const BREAK_MINUTES = 10;

let hourCounter = 0;
const newHourKey = () => `h${++hourCounter}`;

/** Varsayılan gün: 09:00'dan başlayan altı ders, 40 dakika, 10 dakika ara. */
export function defaultHours(): TemplateHour[] {
  const hours: TemplateHour[] = [];
  let start = 9 * 60;
  for (let i = 0; i < 6; i++) {
    hours.push({
      key: newHourKey(),
      startsAt: toHhmm(start),
      endsAt: toHhmm(start + LESSON_MINUTES),
    });
    start += LESSON_MINUTES + BREAK_MINUTES;
  }
  return hours;
}

/** Son dersin ardından bir teneffüs bırakarak yeni bir ders saati. */
export function nextHour(hours: TemplateHour[]): TemplateHour {
  const last = hours[hours.length - 1];
  const start = last
    ? toMinutes(last.endsAt || last.startsAt) + BREAK_MINUTES
    : 9 * 60;
  return {
    key: newHourKey(),
    startsAt: toHhmm(start),
    endsAt: toHhmm(start + LESSON_MINUTES),
  };
}

/** Kayıtlı şablondan (ya da boştan) düzenleyici durumu kurar. */
export function templateToEditor(
  template: ScheduleTemplate | null
): TemplateEditorState {
  if (!template || template.slots.length === 0) {
    return { hours: defaultHours(), sunday: false, cells: {} };
  }

  const byStart = new Map<string, TemplateHour>();
  for (const slot of template.slots) {
    if (!byStart.has(slot.startsAt)) {
      byStart.set(slot.startsAt, {
        key: newHourKey(),
        startsAt: slot.startsAt,
        endsAt: slot.endsAt ?? "",
      });
    }
  }
  const hours = [...byStart.values()].sort((a, b) =>
    a.startsAt.localeCompare(b.startsAt)
  );

  const cells: Record<string, string> = {};
  for (const slot of template.slots) {
    const hour = byStart.get(slot.startsAt);
    if (hour) cells[cellKey(slot.dayOfWeek, hour.key)] = slot.subjectId;
  }

  return {
    hours,
    sunday: template.slots.some(slot => slot.dayOfWeek === 7),
    cells,
  };
}

export type EditorToSlotsResult =
  { ok: true; slots: TemplateSlot[] } | { ok: false; error: string };

/**
 * Düzenleyiciyi kayda hazır kutulara çevirir. Boş hücreler atlanır; Pazar
 * kapalıysa Pazar hücreleri yazılmaz. Saat hataları burada yakalanır,
 * veritabanı yine son sözü söyler.
 */
export function editorToSlots(state: TemplateEditorState): EditorToSlotsResult {
  const seen = new Set<string>();
  for (const hour of state.hours) {
    if (!/^\d{2}:\d{2}$/.test(hour.startsAt)) {
      return { ok: false, error: "Her ders saatinin başlangıcı girilmeli." };
    }
    if (hour.endsAt && toMinutes(hour.endsAt) <= toMinutes(hour.startsAt)) {
      return {
        ok: false,
        error: `${hour.startsAt} dersinin bitişi başlangıçtan sonra olmalı.`,
      };
    }
    if (seen.has(hour.startsAt)) {
      return {
        ok: false,
        error: `${hour.startsAt} saati iki kez yazılmış; birini değiştirin.`,
      };
    }
    seen.add(hour.startsAt);
  }

  const days: IsoWeekDay[] = state.sunday
    ? [...WEEKDAYS_SHOWN, 7]
    : WEEKDAYS_SHOWN;
  const slots: TemplateSlot[] = [];
  for (const day of days) {
    for (const hour of state.hours) {
      const subjectId = state.cells[cellKey(day, hour.key)];
      if (!subjectId) continue;
      slots.push({
        dayOfWeek: day,
        startsAt: hour.startsAt,
        endsAt: hour.endsAt || null,
        subjectId,
      });
    }
  }

  if (slots.length === 0) {
    return { ok: false, error: "Tabloya en az bir ders yerleştirin." };
  }
  return { ok: true, slots };
}

/** Şablon kartındaki kısa özet: "18 ders · Pzt–Cmt". */
export function templateSummary(template: ScheduleTemplate): string {
  const days = new Set(template.slots.map(slot => slot.dayOfWeek));
  return `${template.slots.length} ders · ${days.size} gün`;
}
