import { Plus, X } from "lucide-react";
import type { WeekDay } from "@/education/weekDays";
import type { ScheduleItem } from "../types";
import { buildWeekGrid, timeRange } from "./scheduleGrid";

/**
 * Haftalık ders programı tablosu: günler sütun, başlangıç saatleri satır.
 * Geniş ekran içindir; telefonda `ScheduleDayList` gösterilir.
 *
 * Yöneticide ders kartına tıklamak düzenler, köşedeki × kaldırır, boş
 * hücredeki + o gün ve saate ders ekler. Diğer rollerde tablo salt okunur.
 */
export function ScheduleWeekGrid({
  items,
  showClass,
  today,
  onEdit,
  onRemove,
  onAddAt,
}: {
  items: ScheduleItem[];
  /** Sınıf süzgeci "Tümü" iken kartta sınıf adı yazılır. */
  showClass: boolean;
  today: WeekDay;
  /** Verilmezse tablo salt okunurdur (yönetici olmayan roller, demo). */
  onEdit?: (item: ScheduleItem) => void;
  onRemove?: (item: ScheduleItem) => void;
  onAddAt?: (day: WeekDay, time: string) => void;
}) {
  const grid = buildWeekGrid(items);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] table-fixed border-separate border-spacing-1.5">
        <thead>
          <tr>
            <th className="w-16" />
            {grid.days.map(day => (
              <th
                key={day}
                scope="col"
                className={`rounded-lg px-2 py-2 text-left text-[11px] font-extrabold ${
                  day === today
                    ? "bg-slate-900 text-white"
                    : "bg-slate-50 text-slate-600"
                }`}
              >
                {day}
                {day === today ? " · Bugün" : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.times.map(time => (
            <tr key={time}>
              <th
                scope="row"
                className="align-top pt-2 text-left text-[11px] font-extrabold tabular-nums text-slate-500"
              >
                {time}
              </th>
              {grid.days.map(day => {
                const lessons = grid.cell(day, time);
                return (
                  <td key={day} className="align-top">
                    <div className="flex min-h-[56px] flex-col gap-1.5">
                      {lessons.map(item => (
                        <LessonCard
                          key={item.id ?? `${item.classId}-${item.title}`}
                          item={item}
                          showClass={showClass}
                          onEdit={onEdit}
                          onRemove={onRemove}
                        />
                      ))}
                      {lessons.length === 0 && onAddAt ? (
                        <button
                          type="button"
                          onClick={() => onAddAt(day, time)}
                          aria-label={`${day} ${time} için ders ekle`}
                          className="grid h-full min-h-[56px] place-items-center rounded-lg border border-dashed border-transparent text-slate-300 transition hover:border-slate-300 hover:text-slate-500"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LessonCard({
  item,
  showClass,
  onEdit,
  onRemove,
}: {
  item: ScheduleItem;
  showClass: boolean;
  onEdit?: (item: ScheduleItem) => void;
  onRemove?: (item: ScheduleItem) => void;
}) {
  const editable = Boolean(onEdit && item.id);
  const body = (
    <>
      <span className="block truncate text-[12px] font-extrabold text-slate-800">
        {item.title}
      </span>
      {showClass && item.group ? (
        <span className="block truncate text-[10px] font-semibold text-slate-600">
          {item.group}
        </span>
      ) : null}
      {item.teacher ? (
        <span className="block truncate text-[10px] text-slate-500">
          {item.teacher}
        </span>
      ) : (
        <span className="block truncate text-[10px] font-bold text-amber-700">
          Öğretmensiz
        </span>
      )}
      <span className="block truncate text-[10px] tabular-nums text-slate-400">
        {[timeRange(item), item.room].filter(Boolean).join(" · ")}
      </span>
    </>
  );

  const tone = item.teacher
    ? "border-slate-200 bg-white"
    : "border-amber-200 bg-amber-50/60";

  return (
    <div className="group relative">
      {editable ? (
        <button
          type="button"
          onClick={() => onEdit?.(item)}
          className={`block w-full rounded-lg border px-2.5 py-2 text-left transition hover:border-blue-300 hover:shadow-sm ${tone}`}
        >
          {body}
        </button>
      ) : (
        <div className={`rounded-lg border px-2.5 py-2 ${tone}`}>{body}</div>
      )}
      {editable && onRemove ? (
        <button
          type="button"
          onClick={() => onRemove(item)}
          aria-label={`${item.title} dersini programdan kaldır`}
          className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded text-slate-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 focus:opacity-100 group-hover:opacity-100"
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  );
}
