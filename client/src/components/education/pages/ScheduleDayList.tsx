import { useState } from "react";
import { BookOpen, Edit2, Trash2 } from "lucide-react";
import { isDemoMode } from "@/auth/runtime";
import {
  getDefaultScheduleDay,
  WEEK_DAYS,
  type WeekDay,
} from "@/education/weekDays";
import { Badge, EmptyState } from "../shared";
import type { ScheduleItem } from "../types";

/**
 * Ders programının gün gün listesi — telefonda gösterilir (geniş ekranda
 * `ScheduleWeekGrid`). Yükleme ve hata durumlarını sayfa çizer.
 */
export function ScheduleDayList({
  items,
  today,
  onEdit,
  onRemove,
}: {
  items: ScheduleItem[];
  today: WeekDay;
  onEdit?: (item: ScheduleItem) => void;
  onRemove?: (item: ScheduleItem) => void;
}) {
  const [selectedDay, setSelectedDay] = useState<WeekDay>(() =>
    getDefaultScheduleDay()
  );
  const dayFiltered = items.filter(item => item.day === selectedDay);

  return (
    <div>
      <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-4">
        {WEEK_DAYS.map(day => {
          const isSelected = day === selectedDay;
          const isToday = day === today;
          return (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDay(day)}
              className={`rounded-lg px-3 py-2 text-[11px] font-bold transition ${
                isSelected
                  ? "bg-slate-900 text-white"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              {day}
              {isToday ? " · Bugün" : ""}
            </button>
          );
        })}
      </div>
      <div className="mt-5 space-y-3">
        {dayFiltered.length === 0 ? (
          <EmptyState
            title={`${selectedDay} günü için ders bulunmuyor`}
            description="Planlanmış bir ders programı kaydı yok."
          />
        ) : (
          dayFiltered.map(item => {
            const metaInfo = [item.group, item.teacher, item.room]
              .filter(Boolean)
              .join(" · ");
            // v1.3-01b · 2.C: Servis tone üretmez; arayüzde nötr slate stili kullanılır.
            const toneClass =
              item.tone || "bg-slate-50 text-slate-700 ring-slate-100";
            // v1.3-01b · 2.B.4 & K-22: ends_at yoksa süre rozeti hiç çizilmez; demo modunda 50 dk korunur.
            const durationLabel =
              item.duration ?? (isDemoMode ? "50 dk" : null);

            return (
              <div
                key={item.id ?? `${item.day}-${item.time}-${item.title}`}
                className="flex flex-col gap-3 rounded-xl border border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center min-w-0 flex-1">
                  <span className="w-12 text-[12px] font-extrabold tabular-nums text-slate-500">
                    {item.time}
                  </span>
                  <span
                    className={`grid h-9 w-9 place-items-center rounded-lg ring-1 ${toneClass}`}
                  >
                    <BookOpen className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-extrabold text-slate-800">
                      {item.title}
                    </p>
                    {metaInfo ? (
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        {metaInfo}
                      </p>
                    ) : null}
                  </div>
                  {durationLabel ? (
                    <Badge tone="slate">{durationLabel}</Badge>
                  ) : null}
                </div>

                {/* Yönetici eylemleri — sayfa yalnız yönetici ve canlı modda verir */}
                {onEdit && onRemove && item.id ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onEdit(item)}
                      className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 px-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    >
                      <Edit2 className="h-3 w-3" />
                      <span>Düzenle</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(item)}
                      className="inline-flex h-7 items-center gap-1 rounded-md border border-rose-200 px-2 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Kaldır</span>
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
