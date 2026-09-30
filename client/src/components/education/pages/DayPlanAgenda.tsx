import { useState } from "react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Edit2,
  MapPin,
  Phone,
  Trash2,
  Video,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { educationKeys } from "@/education/educationQueries";
import {
  archiveCalendarEvent,
  type CalendarEventItem,
} from "@/education/dayPlanService";
import { Badge } from "../shared";
import type { DayPlanAppointmentMode, DayPlanEvent } from "../types";
import type { DayPlanDisplayEvent } from "./dayPlanHelpers";
import { FEED_KIND_LABELS } from "@/education/feedService";

const modeIcon: Record<DayPlanAppointmentMode, typeof Video> = {
  "Google Meet": Video,
  Telefon: Phone,
  "Yüz yüze": MapPin,
};

export type DayPlanAgendaProps = {
  selectedDate: Date;
  events: (DayPlanEvent | DayPlanDisplayEvent)[];
  organizationId?: string;
  membershipId?: string;
  onEditEvent?: (event: CalendarEventItem) => void;
  /**
   * Gün gün gezinme (C-04). Ay takviminin okları ay değiştirir; burada
   * olmasaydı bir sonraki güne geçmenin tek yolu ay ızgarasında tıklamaktı.
   */
  onShiftDay?: (days: number) => void;
  onToday?: () => void;
};

export function DayPlanAgenda({
  selectedDate,
  events,
  organizationId = "",
  membershipId = "",
  onEditEvent,
  onShiftDay,
  onToday,
}: DayPlanAgendaProps) {
  const queryClient = useQueryClient();
  const [eventToArchive, setEventToArchive] =
    useState<CalendarEventItem | null>(null);
  const [archiving, setArchiving] = useState(false);

  const handleConfirmArchive = async () => {
    if (!eventToArchive || !organizationId) return;
    setArchiving(true);
    try {
      await archiveCalendarEvent(organizationId, eventToArchive.id);
      toast.success("Etkinlik kaldırıldı");
      setEventToArchive(null);
      await queryClient.invalidateQueries({
        queryKey: educationKeys.calendarEvents(organizationId, membershipId),
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Etkinlik kaldırılamadı."
      );
    } finally {
      setArchiving(false);
    }
  };

  return (
    <div>
      <p className="text-[11px] font-extrabold uppercase tracking-[.1em] text-slate-400">
        Günlük Ajanda
      </p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="text-[14px] font-extrabold text-slate-900">
          {format(selectedDate, "d MMMM yyyy, EEEE", { locale: tr })}
        </p>
        {onShiftDay ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => onShiftDay(-1)}
              aria-label="Önceki gün"
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {onToday ? (
              <button
                type="button"
                onClick={onToday}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600 hover:bg-slate-100"
              >
                <span className="text-[11px] font-bold">Bugün</span>
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onShiftDay(1)}
              aria-label="Sonraki gün"
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>
      <div className="mt-4 space-y-2.5">
        {events.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-[11px] text-slate-400">
            Bu gün için planlanmış görüşme veya ders yok.
          </p>
        ) : (
          events.map(item => {
            const isDisplay = "isLesson" in item;
            const isLesson = isDisplay && item.isLesson;
            const rawEvent = isDisplay ? item.rawEvent : undefined;
            const mode = !isLesson ? item.mode : undefined;
            const Icon = mode ? modeIcon[mode] : null;

            return (
              <div
                key={item.id}
                className={`rounded-xl border p-3 transition ${
                  isLesson
                    ? "border-blue-100 bg-blue-50/40"
                    : "border-slate-100 bg-white"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold tabular-nums text-slate-700">
                    {item.startTime}
                    {item.endTime ? `–${item.endTime}` : ""}
                  </span>
                  {isDisplay && item.isExam ? (
                    // Sınav takvimde salt okunur; Sınavlar sekmesinde düzenlenir.
                    <Badge tone="amber">Sınav</Badge>
                  ) : isDisplay && item.noticeKind ? (
                    // Tarihli duyuru salt okunur; İletişim'de düzenlenir.
                    <Badge tone="green">
                      Duyuru · {FEED_KIND_LABELS[item.noticeKind]}
                    </Badge>
                  ) : isLesson ? (
                    // 🔴 Ders satırları takvimde salt okunur — üzerinde düzenleme/kaldırma çizilmez (§5 & §9)
                    <Badge tone="blue">Ders Programı</Badge>
                  ) : rawEvent ? (
                    <div className="flex items-center gap-1.5">
                      <Badge tone="slate">Kişisel</Badge>
                      {onEditEvent ? (
                        <button
                          onClick={() => onEditEvent(rawEvent)}
                          aria-label="Etkinliği düzenle"
                          className="grid h-6 w-6 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                      <button
                        onClick={() => setEventToArchive(rawEvent)}
                        aria-label="Etkinliği kaldır"
                        className="grid h-6 w-6 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : Icon && mode ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                      <Icon className="h-3 w-3" />
                      {mode}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-[11px] font-extrabold text-slate-800">
                  {item.title}
                </p>
                {item.subtitle ? (
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    {item.subtitle}
                  </p>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      {/* Arşiv onay diyaloğu — window.confirm YOK (§6) */}
      <Dialog
        open={Boolean(eventToArchive)}
        onOpenChange={open => !open && setEventToArchive(null)}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Etkinliği Kaldır</DialogTitle>
            <DialogDescription>
              &ldquo;{eventToArchive?.title}&rdquo; takvimden kaldırılacak. Bu
              işlem geri alınamaz.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex gap-2 sm:justify-end">
            <button
              type="button"
              disabled={archiving}
              onClick={() => setEventToArchive(null)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-[12px] font-bold text-slate-600 hover:bg-slate-50"
            >
              Vazgeç
            </button>
            <button
              type="button"
              disabled={archiving}
              onClick={handleConfirmArchive}
              className="rounded-xl bg-rose-600 px-4 py-2 text-[12px] font-bold text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {archiving ? "Kaldırılıyor..." : "Kaldır"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
