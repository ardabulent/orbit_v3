import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock,
  Edit2,
  Trash2,
} from "lucide-react";
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
  archiveTask,
  completeTask,
  TASK_STATUSES,
  uncompleteTask,
  updateTask,
  type TaskItem,
  type TaskStatus,
} from "@/education/dayPlanService";
import { formatTrDate, getOrbitToday } from "@/education/trDate";
import { Badge } from "../shared";
import type { DayPlanTask, DayPlanTaskStatus } from "../types";
import {
  formatTaskTiming,
  TASK_LABEL_META,
  TASK_PRIORITY_META,
  TASK_STATUS_META,
} from "./taskBoardMeta";

const statusOptions: DayPlanTaskStatus[] = [
  "Planla",
  "Bugün",
  "Odaklan",
  "Tamamlandı",
];

const priorityTone: Record<
  DayPlanTask["priority"],
  "rose" | "amber" | "slate"
> = {
  Yüksek: "rose",
  Orta: "amber",
  Düşük: "slate",
};

const categoryTone: Record<
  DayPlanTask["category"],
  "blue" | "violet" | "amber" | "slate" | "green"
> = {
  Yoklama: "blue",
  "Veli İletişimi": "violet",
  Sınav: "amber",
  Rapor: "slate",
  Kayıt: "green",
  "Ders Programı": "blue",
};

function isRealTaskItem(task: DayPlanTask | TaskItem): task is TaskItem {
  return "ownerMembershipId" in task;
}

export type DayPlanTaskCardProps = {
  task: DayPlanTask | TaskItem;
  organizationId?: string;
  membershipId?: string;
  onEdit?: (task: TaskItem) => void;
  setTasks?: React.Dispatch<React.SetStateAction<DayPlanTask[]>>;
};

export function DayPlanTaskCard({
  task,
  organizationId = "",
  membershipId = "",
  onEdit,
  setTasks,
}: DayPlanTaskCardProps) {
  const queryClient = useQueryClient();
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Demo modu: DayPlanTask arayüzü
  if (!isRealTaskItem(task)) {
    return (
      <div className="rounded-xl border border-slate-100 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={priorityTone[task.priority]}>{task.priority}</Badge>
          <Badge tone={categoryTone[task.category]}>{task.category}</Badge>
        </div>
        <p className="mt-2.5 text-[12px] font-extrabold text-slate-800">
          {task.title}
        </p>
        <p className="mt-1 text-[10px] leading-4 text-slate-500">
          {task.detail}
        </p>
        <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {task.duration}
          </span>
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            {task.dueLabel}
          </span>
        </div>
        {setTasks ? (
          <select
            value={task.status}
            onChange={event => {
              const nextStatus = event.target.value as DayPlanTaskStatus;
              setTasks(current =>
                current.map(item =>
                  item.id === task.id ? { ...item, status: nextStatus } : item
                )
              );
            }}
            className="mt-3 h-8 w-full rounded-lg border border-slate-200 bg-slate-50/60 px-2 text-[11px] font-bold text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
          >
            {statusOptions.map(status => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        ) : null}
      </div>
    );
  }

  // Üretim modu: Gerçek TaskItem
  const today = getOrbitToday();
  const isCompleted = task.status === "done";
  // 🔴 Vadesi geçti hesabı kurum gününe göredir; ham new Date() kullanılmaz (#290 / trDate.ts)
  // Gecikmiş görev kendi sütununda kalır; yalnız bu rozet çizilir (karar 2026-09-27).
  const isOverdue = !isCompleted && Boolean(task.dueOn && task.dueOn < today);
  const isDueToday =
    !isCompleted && Boolean(task.dueOn && task.dueOn === today);
  const timing = formatTaskTiming(task.dueTime, task.estimatedMinutes);

  const handleStatusChange = async (nextStatus: TaskStatus) => {
    if (!organizationId || loading || nextStatus === task.status) return;
    setLoading(true);
    try {
      await updateTask(organizationId, task.id, { status: nextStatus });
      await queryClient.invalidateQueries({
        queryKey: educationKeys.tasks(organizationId, membershipId),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Görev taşınamadı.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleComplete = async () => {
    if (!organizationId || loading) return;
    setLoading(true);
    try {
      if (isCompleted) {
        await uncompleteTask(organizationId, task.id);
        toast.info("Görev tamamlanmadı olarak işaretlendi");
      } else {
        await completeTask(organizationId, task.id);
        toast.success("Görev tamamlandı");
      }
      await queryClient.invalidateQueries({
        queryKey: educationKeys.tasks(organizationId, membershipId),
      });
    } catch (err) {
      // 🔴 Hatayı servis çevirir, ekran taşır
      toast.error(
        err instanceof Error ? err.message : "Görev durumu güncellenemedi."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!organizationId || loading) return;
    setLoading(true);
    try {
      await archiveTask(organizationId, task.id);
      toast.success("Görev kaldırıldı");
      await queryClient.invalidateQueries({
        queryKey: educationKeys.tasks(organizationId, membershipId),
      });
      setArchiveModalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Görev kaldırılamadı.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div
        data-slot="task-card"
        className={`rounded-xl border p-3.5 transition ${
          isCompleted
            ? "border-slate-100 bg-slate-50/70 opacity-80"
            : isOverdue
              ? "border-rose-200 bg-rose-50/20"
              : "border-slate-100 bg-white shadow-sm hover:border-slate-200"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={TASK_PRIORITY_META[task.priority].tone}>
              {TASK_PRIORITY_META[task.priority].label}
            </Badge>
            {task.label ? (
              <Badge tone={TASK_LABEL_META[task.label].tone}>
                {TASK_LABEL_META[task.label].label}
              </Badge>
            ) : null}
            {isOverdue ? <Badge tone="rose">Gecikti</Badge> : null}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleToggleComplete}
              disabled={loading}
              title={isCompleted ? "Tamamlanmadı yap" : "Tamamla"}
              aria-label={isCompleted ? "Tamamlanmadı yap" : "Tamamla"}
              className={`grid h-6 w-6 place-items-center rounded-md transition ${
                isCompleted
                  ? "text-emerald-600 hover:text-emerald-700"
                  : "text-slate-400 hover:text-slate-700"
              }`}
            >
              {isCompleted ? (
                <CheckCircle2 className="h-4 w-4 fill-emerald-50 text-emerald-600" />
              ) : (
                <Circle className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={() => onEdit?.(task)}
              disabled={loading}
              title="Görevi Düzenle"
              aria-label="Görevi Düzenle"
              className="grid h-6 w-6 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <Edit2 className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => setArchiveModalOpen(true)}
              disabled={loading}
              title="Görevi Kaldır"
              aria-label="Görevi Kaldır"
              className="grid h-6 w-6 place-items-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>

        <p
          className={`mt-2 text-[12px] font-extrabold ${
            isCompleted
              ? "text-slate-500 line-through"
              : isOverdue
                ? "text-rose-950"
                : "text-slate-800"
          }`}
        >
          {task.title}
        </p>

        {task.detail ? (
          <p className="mt-1 whitespace-pre-line text-[11px] leading-relaxed text-slate-500">
            {task.detail}
          </p>
        ) : null}

        <div className="mt-3 flex items-center justify-between gap-2 text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            {isDueToday
              ? "Bugün"
              : task.dueOn
                ? formatTrDate(task.dueOn)
                : "Tarihsiz"}
          </span>
          {timing ? (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {timing}
            </span>
          ) : null}
        </div>

        {/* Sütun elle seçilir (C-10, MoneyFlow mantığı). */}
        <select
          value={task.status}
          disabled={loading}
          aria-label="Görevin sütunu"
          onChange={event =>
            void handleStatusChange(event.target.value as TaskStatus)
          }
          className="mt-3 h-8 w-full rounded-lg border border-slate-200 bg-slate-50/60 px-2 text-[11px] font-bold text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
        >
          {TASK_STATUSES.map(status => (
            <option key={status} value={status}>
              {TASK_STATUS_META[status].label}
            </option>
          ))}
        </select>
      </div>

      {/* Arşivleme (Kaldırma) Onay Diyalogu — window.confirm kullanılmaz (#290) */}
      <Dialog open={archiveModalOpen} onOpenChange={setArchiveModalOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Görevi Kaldır</DialogTitle>
            <DialogDescription>
              &quot;{task.title}&quot; başlıklı görevi listenizden kaldırmak
              istediğinize emin misiniz?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setArchiveModalOpen(false)}
              disabled={loading}
              className="h-9 rounded-lg border border-slate-200 px-4 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Vazgeç
            </button>
            <button
              type="button"
              onClick={handleArchive}
              disabled={loading}
              className="inline-flex h-9 items-center justify-center rounded-lg bg-rose-600 px-4 text-[12px] font-bold text-white transition hover:bg-rose-700 disabled:opacity-50"
            >
              {loading ? "Kaldırılıyor…" : "Evet, Kaldır"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
