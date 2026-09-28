import { isSameDay, isSameMonth, isToday } from "date-fns";
import type { DayPlanEvent } from "../types";
import {
  type DayPlanDisplayEvent,
  getDisplayEventsForDay,
  getEventsForDay,
  getMonthGridDays,
} from "./dayPlanHelpers";

const dayNames = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

const eventTone: Record<DayPlanEvent["type"], string> = {
  "Veli Görüşmesi": "bg-blue-50 text-blue-700",
  "Öğretmen Değerlendirmesi": "bg-violet-50 text-violet-700",
  "Şube Toplantısı": "bg-amber-50 text-amber-700",
  "Rehberlik Görüşmesi": "bg-emerald-50 text-emerald-700",
  "Aday Kayıt Görüşmesi": "bg-rose-50 text-rose-700",
};

export function DayPlanMonthGrid({
  currentMonth,
  selectedDate,
  events,
  onSelectDate,
}: {
  currentMonth: Date;
  selectedDate: Date;
  events: (DayPlanEvent | DayPlanDisplayEvent)[];
  onSelectDate: (date: Date) => void;
}) {
  const days = getMonthGridDays(currentMonth);

  const isDisplayList =
    events.length > 0 && "isLesson" in (events[0] as DayPlanDisplayEvent);

  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-400">
        {dayNames.map(day => (
          <span key={day} className="py-1">
            {day}
          </span>
        ))}
      </div>
      <div className="mt-1.5 grid grid-cols-7 gap-1.5">
        {days.map(day => {
          const dayEvents = isDisplayList
            ? getDisplayEventsForDay(events as DayPlanDisplayEvent[], day)
            : getEventsForDay(events as DayPlanEvent[], day);

          const visibleEvents = dayEvents.slice(0, 2);
          const overflow = dayEvents.length - visibleEvents.length;
          const inMonth = isSameMonth(day, currentMonth);
          const selected = isSameDay(day, selectedDate);

          return (
            <button
              key={day.toISOString()}
              onClick={() => onSelectDate(day)}
              className={`min-h-[84px] rounded-xl border p-2 text-left transition ${
                selected
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-100 hover:border-slate-200 hover:bg-slate-50"
              } ${!inMonth && !selected ? "text-slate-300" : ""}`}
            >
              <span
                className={`text-[11px] font-bold ${
                  selected
                    ? "text-white"
                    : isToday(day)
                      ? "text-blue-600"
                      : inMonth
                        ? "text-slate-700"
                        : "text-slate-300"
                }`}
              >
                {day.getDate()}
              </span>
              <div className="mt-1.5 space-y-1">
                {visibleEvents.map(event => {
                  const isLesson = "isLesson" in event && event.isLesson;
                  const isPersonal =
                    "rawEvent" in event && Boolean(event.rawEvent);
                  const demoType = "type" in event ? event.type : undefined;

                  const isExam = "isExam" in event && event.isExam;
                  const toneClass = isExam
                    ? "bg-amber-50 text-amber-700"
                    : isLesson
                      ? "bg-blue-50 text-blue-700"
                      : isPersonal
                        ? "bg-violet-50 text-violet-700"
                        : demoType && eventTone[demoType]
                          ? eventTone[demoType]
                          : "bg-slate-100 text-slate-700";

                  return (
                    <span
                      key={event.id}
                      className={`block truncate rounded-md px-1.5 py-0.5 text-[9px] font-bold ${
                        selected ? "bg-white/15 text-white" : toneClass
                      }`}
                    >
                      {event.startTime} {event.title}
                    </span>
                  );
                })}
                {overflow > 0 ? (
                  <span
                    className={`block text-[9px] font-bold ${
                      selected ? "text-white/70" : "text-slate-400"
                    }`}
                  >
                    +{overflow} daha
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
