import { formatTime } from "@/education/scheduleService";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { CalendarEventItem } from "@/education/dayPlanService";
import { orbitLocalDate } from "@/education/trDate";
import { dateToIsoWeekDay } from "@/education/weekDays";
import type {
  DayPlanAppointmentMode,
  DayPlanAppointmentType,
  DayPlanEvent,
  DayPlanTask,
  ScheduleItem,
} from "../types";
import type { CalendarNotice, FeedKind } from "@/education/feedService";

export type DayPlanDisplayEvent = {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string;
  endTime?: string | null;
  title: string;
  subtitle?: string | null;
  isLesson: boolean;
  /** Sınav günü (salt okunur; Sınavlar sekmesinden gelir). */
  isExam?: boolean;
  /** Tarihli duyuru (salt okunur; İletişim'den gelir, 2026-09-30). */
  noticeKind?: FeedKind;
  rawEvent?: CalendarEventItem;
  rawLesson?: ScheduleItem;
  mode?: DayPlanAppointmentMode;
  type?: DayPlanAppointmentType;
};

/** Takvime düşen sınav (Gün Planı, salt okunur). */
export type CalendarExam = {
  id: string;
  name: string;
  examDate: string;
  className: string | null;
};

export function getMonthGridDays(month: Date): Date[] {
  return eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });
}

export function getEventsForDay(
  events: DayPlanEvent[],
  day: Date
): DayPlanEvent[] {
  return events.filter(event => isSameDay(parseISO(event.date), day));
}

export function getDisplayEventsForDay(
  events: DayPlanDisplayEvent[],
  day: Date
): DayPlanDisplayEvent[] {
  const targetDateStr = format(day, "yyyy-MM-dd");
  return events
    .filter(event => event.date === targetDateStr)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

/**
 * Gün Planı takvimi için ders satırlarını role göre süzer (§5).
 *
 * ⚠️ Öğretmende `membership_id` süzgeci zorunludur: okuttuğu sınıfın başka
 * öğretmenlerinin dersleri kendi gününde çizilmez.
 * Öğrenci ve veli ise sınıfın tüm derslerini görür.
 */
export function filterLessonsForDayPlan(
  schedule: ScheduleItem[],
  role: string,
  membershipId?: string | null
): ScheduleItem[] {
  if (role === "teacher" || role === "admin") {
    if (!membershipId) return [];
    return schedule.filter(item => item.membershipId === membershipId);
  }
  return schedule;
}

/**
 * Belirli bir ay aralığı için kişisel etkinlikler ile ders programını birleştirir (§5).
 */
export function buildMonthDisplayEvents(
  month: Date,
  personalEvents: CalendarEventItem[],
  schedule: ScheduleItem[],
  exams: CalendarExam[] = [],
  notices: CalendarNotice[] = []
): DayPlanDisplayEvent[] {
  const days = getMonthGridDays(month);
  const result: DayPlanDisplayEvent[] = [];

  // Sınavlar (C-07: "yeni sınav takvimde görünmüyor"). Saatsiz: günün
  // başında sıralanır, "Sınav" rozetiyle salt okunur çizilir.
  const visibleDates = new Set(days.map(day => format(day, "yyyy-MM-dd")));
  for (const exam of exams) {
    if (!visibleDates.has(exam.examDate)) continue;
    result.push({
      id: `exam-${exam.id}`,
      date: exam.examDate,
      startTime: "",
      title: exam.name,
      subtitle: exam.className,
      isLesson: false,
      isExam: true,
    });
  }

  // Tarihli duyurular (karar 2026-09-30): sınav, etkinlik, toplantı günü.
  // Saatsiz, salt okunur; İletişim'de düzenlenir.
  for (const notice of notices) {
    if (!visibleDates.has(notice.eventDate)) continue;
    result.push({
      id: `notice-${notice.id}`,
      date: notice.eventDate,
      startTime: "",
      title: notice.title,
      subtitle: notice.className,
      isLesson: false,
      noticeKind: notice.kind,
    });
  }

  // Kişisel etkinlikleri tarihlerine göre haritala (Europe/Istanbul gününe göre)
  for (const event of personalEvents) {
    const eventDate = new Date(event.startsAt);
    const dateStr = orbitLocalDate(eventDate);
    const startTime = new Intl.DateTimeFormat("tr-TR", {
      timeZone: "Europe/Istanbul",
      hour: "2-digit",
      minute: "2-digit",
    }).format(eventDate);
    const endTime = event.endsAt
      ? new Intl.DateTimeFormat("tr-TR", {
          timeZone: "Europe/Istanbul",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(event.endsAt))
      : null;

    result.push({
      id: `personal-${event.id}`,
      date: dateStr,
      startTime,
      endTime,
      title: event.title,
      subtitle: event.subtitle,
      isLesson: false,
      rawEvent: event,
    });
  }

  // Takvimde görünen her gün için haftalık tekrarlayan dersleri ekle
  for (const day of days) {
    const dateStr = format(day, "yyyy-MM-dd");
    const dayIso = dateToIsoWeekDay(day);

    const dayLessons = schedule.filter(lesson => lesson.dayOfWeek === dayIso);
    for (const lesson of dayLessons) {
      // Veritabanı saati "09:00:00" döndürüyor; takvimde saniye gösterilmez.
      const rawEnd =
        lesson.endsAt ??
        (lesson.time && lesson.time.includes("-")
          ? lesson.time.split("-")[1].trim()
          : null);
      const startTime = formatTime(
        lesson.startsAt ??
          (lesson.time ? lesson.time.split("-")[0].trim() : "09:00")
      );
      const endTime = rawEnd ? formatTime(rawEnd) : null;

      result.push({
        id: `lesson-${lesson.id ?? lesson.title}-${dateStr}-${startTime}`,
        date: dateStr,
        startTime,
        endTime,
        title: lesson.title,
        subtitle:
          [lesson.group, lesson.teacher, lesson.room]
            .filter(Boolean)
            .join(" · ") || null,
        isLesson: true,
        rawLesson: lesson,
      });
    }
  }

  return result;
}

export function getTodayTaskCount(tasks: DayPlanTask[]): number {
  return tasks.filter(
    task => task.status === "Bugün" || task.status === "Odaklan"
  ).length;
}

export function getTaskCompletionPercent(tasks: DayPlanTask[]): number {
  if (tasks.length === 0) return 0;
  const done = tasks.filter(task => task.status === "Tamamlandı").length;
  return Math.round((done / tasks.length) * 100);
}
