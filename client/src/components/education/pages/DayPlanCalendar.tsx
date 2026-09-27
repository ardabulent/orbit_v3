import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  format,
  isSameMonth,
  startOfMonth,
  subMonths,
} from "date-fns";
import { tr } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CalendarEventItem } from "@/education/dayPlanService";
import type { DayPlanEvent, ScheduleItem } from "../types";
import { DayPlanAgenda } from "./DayPlanAgenda";
import { DayPlanMonthGrid } from "./DayPlanMonthGrid";
import {
  buildMonthDisplayEvents,
  type DayPlanDisplayEvent,
  filterLessonsForDayPlan,
  getDisplayEventsForDay,
  getEventsForDay,
} from "./dayPlanHelpers";

export type DayPlanCalendarProps = {
  events?: DayPlanEvent[];
  personalEvents?: CalendarEventItem[];
  schedule?: ScheduleItem[];
  role?: string;
  organizationId?: string;
  membershipId?: string;
  isDemo?: boolean;
  onEditEvent?: (event: CalendarEventItem) => void;
};

export function DayPlanCalendar({
  events,
  personalEvents,
  schedule,
  role = "",
  organizationId = "",
  membershipId = "",
  isDemo = false,
  onEditEvent,
}: DayPlanCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() =>
    startOfMonth(new Date())
  );
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  const goToday = () => {
    const today = new Date();
    setCurrentMonth(startOfMonth(today));
    setSelectedDate(today);
  };

  // Gün listesi ay sınırını geçerse ay ızgarası da onu izler (C-04).
  const shiftDay = (days: number) => {
    const next = addDays(selectedDate, days);
    setSelectedDate(next);
    if (!isSameMonth(next, currentMonth)) {
      setCurrentMonth(startOfMonth(next));
    }
  };

  const displayEvents: (DayPlanEvent | DayPlanDisplayEvent)[] = useMemo(() => {
    if (isDemo || events) {
      return events ?? [];
    }

    const filteredSchedule = filterLessonsForDayPlan(
      schedule ?? [],
      role,
      membershipId
    );

    return buildMonthDisplayEvents(
      currentMonth,
      personalEvents ?? [],
      filteredSchedule
    );
  }, [
    isDemo,
    events,
    personalEvents,
    schedule,
    role,
    membershipId,
    currentMonth,
  ]);

  const selectedDateEvents = useMemo(() => {
    if (isDemo || events) {
      return getEventsForDay(
        (displayEvents as DayPlanEvent[]) ?? [],
        selectedDate
      );
    }
    return getDisplayEventsForDay(
      displayEvents as DayPlanDisplayEvent[],
      selectedDate
    );
  }, [isDemo, events, displayEvents, selectedDate]);

  return (
    <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_16px_rgba(15,23,42,.025)]">
        <div className="flex items-center justify-between">
          <p className="text-[14px] font-extrabold capitalize text-slate-900">
            {format(currentMonth, "LLLL yyyy", { locale: tr })}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentMonth(current => subMonths(current, 1))}
              aria-label="Önceki ay"
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={goToday}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600 hover:bg-slate-100"
            >
              {/* Yazı boyutu span'da: `index.css`'teki katmansız
                  `button { font: inherit }` düğmedeki boyutu eziyor. */}
              <span className="text-[11px] font-bold">Bugün</span>
            </button>
            <button
              onClick={() => setCurrentMonth(current => addMonths(current, 1))}
              aria-label="Sonraki ay"
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="mt-4">
          <DayPlanMonthGrid
            currentMonth={currentMonth}
            selectedDate={selectedDate}
            events={displayEvents}
            onSelectDate={setSelectedDate}
          />
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_16px_rgba(15,23,42,.025)]">
        <DayPlanAgenda
          selectedDate={selectedDate}
          events={selectedDateEvents}
          organizationId={organizationId}
          membershipId={membershipId}
          onEditEvent={onEditEvent}
          onShiftDay={shiftDay}
          onToday={goToday}
        />
      </section>
    </div>
  );
}
