import { useState } from "react";
import { Plus, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  DEFAULT_DAY_PLAN_LIMIT,
  TASK_PRIORITIES,
  type TaskItem,
  type TaskPriority,
  type TaskStatus,
} from "@/education/dayPlanService";
import { getOrbitToday } from "@/education/trDate";
import { Badge, StatCard } from "../shared";
import type {
  DayPlanTask,
  DayPlanTaskCategory,
  DayPlanTaskStatus,
} from "../types";
import { DayPlanTaskCard } from "./DayPlanTaskCard";
import {
  TASK_LABEL_META,
  TASK_PRIORITY_META,
  TASK_STATUS_META,
} from "./taskBoardMeta";
import { matchesSearch } from "@/education/turkishSearch";

/** Veritabanı durumu ↔ panonun sütun anahtarı (demo verisiyle ortak). */
const STATUS_TO_COLUMN: Record<TaskStatus, DayPlanTaskStatus> = {
  planned: "Planla",
  today: "Bugün",
  focus: "Odaklan",
  done: "Tamamlandı",
};
const COLUMN_TO_STATUS: Record<DayPlanTaskStatus, TaskStatus> = {
  Planla: "planned",
  Bugün: "today",
  Odaklan: "focus",
  Tamamlandı: "done",
};

const columns: { status: DayPlanTaskStatus; hint: string }[] = [
  { status: "Planla", hint: TASK_STATUS_META.planned.hint },
  { status: "Bugün", hint: TASK_STATUS_META.today.hint },
  { status: "Odaklan", hint: TASK_STATUS_META.focus.hint },
  { status: "Tamamlandı", hint: TASK_STATUS_META.done.hint },
];

const categories: DayPlanTaskCategory[] = [
  "Yoklama",
  "Veli İletişimi",
  "Sınav",
  "Rapor",
  "Kayıt",
  "Ders Programı",
];

function isRealTask(task: DayPlanTask | TaskItem): task is TaskItem {
  return "ownerMembershipId" in task;
}

export type DayPlanToDoBoardProps = {
  tasks: (DayPlanTask | TaskItem)[];
  setTasks?: React.Dispatch<React.SetStateAction<DayPlanTask[]>>;
  organizationId?: string;
  membershipId?: string;
  onAddTask?: (initialDueOn?: string, initialStatus?: TaskStatus) => void;
  onEditTask?: (task: TaskItem) => void;
  truncated?: boolean;
};

export function DayPlanToDoBoard({
  tasks,
  setTasks,
  organizationId = "",
  membershipId = "",
  onAddTask,
  onEditTask,
  truncated = false,
}: DayPlanToDoBoardProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"Tümü" | DayPlanTaskCategory>(
    "Tümü"
  );
  const [priority, setPriority] = useState<"all" | TaskPriority>("all");

  const isProduction =
    tasks.length > 0 ? isRealTask(tasks[0]) : Boolean(organizationId);
  const today = getOrbitToday();

  // Görevi ilgili sütuna yerleştir
  const getTaskColumn = (task: DayPlanTask | TaskItem): DayPlanTaskStatus => {
    if (!isRealTask(task)) {
      return task.status;
    }
    // Sütun elle seçilen durumdur; tarihten türetilmez (C-10, karar
    // 2026-09-27). Gecikmiş görev kendi sütununda kalır, kart "Gecikti" yazar.
    return STATUS_TO_COLUMN[task.status];
  };

  const filtered = tasks.filter(task => {
    const title = task.title || "";
    const detail = task.detail || "";
    const cat = !isRealTask(task)
      ? task.category
      : task.label
        ? TASK_LABEL_META[task.label].label
        : "";
    const matchesQuery = matchesSearch(`${title} ${detail} ${cat}`, query);

    if (!isRealTask(task)) {
      const matchesCategory = category === "Tümü" || task.category === category;
      return matchesQuery && matchesCategory;
    }
    return matchesQuery && (priority === "all" || task.priority === priority);
  });

  const totalCount = tasks.length;
  const doneCount = tasks.filter(t =>
    isRealTask(t) ? Boolean(t.completedAt) : t.status === "Tamamlandı"
  ).length;

  const todayCount = tasks.filter(t => getTaskColumn(t) === "Bugün").length;
  const focusCount = tasks.filter(t => getTaskColumn(t) === "Odaklan").length;
  const overdueCount = tasks.filter(
    t =>
      isRealTask(t) &&
      t.status !== "done" &&
      Boolean(t.dueOn && t.dueOn < today)
  ).length;

  const completionPercent =
    totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const handleColumnAdd = (status: DayPlanTaskStatus) => {
    if (onAddTask) {
      // Görev tıklanan sütunda açılır; Bugün'de tarih de bugündür.
      onAddTask(
        status === "Bugün" ? today : undefined,
        COLUMN_TO_STATUS[status]
      );
    } else {
      toast.info("Yeni görev", {
        description: `"${status}" sütununa görev ekleme bir sonraki fazda aktifleşecek.`,
      });
    }
  };

  return (
    <>
      {/* Tavan Uyarısı (K-06) */}
      {truncated ? (
        <div
          role="status"
          className="mb-4 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-[11px] font-semibold text-amber-800"
        >
          Liste üst sınıra ({DEFAULT_DAY_PLAN_LIMIT} kayıt) ulaştı. Kalan
          kayıtları görmek için arama yapın.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
        <div className="rounded-2xl bg-slate-900 p-6 text-white">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-extrabold">
            <Sparkles className="h-3 w-3" />
            Günün odağı
          </span>
          <p className="mt-3 font-display text-[19px] font-extrabold tracking-[-.03em]">
            {todayCount} görev bugün · {focusCount} odakta
          </p>
          <p className="mt-4 max-w-md text-[11px] leading-5 text-white/70">
            {totalCount === 0
              ? "Henüz görev yok. Bir sütundaki + ile o sütuna görev ekleyebilirsiniz."
              : overdueCount > 0
                ? `${overdueCount} görevin tarihi geçti; kartlarında "Gecikti" yazıyor.`
                : "Kartın altındaki listeden görevi istediğiniz sütuna taşıyabilirsiniz."}
          </p>
        </div>
        <StatCard
          label="Günlük ilerleme"
          value={`%${completionPercent}`}
          detail={`${doneCount}/${totalCount} görev tamamlandı`}
          icon={Sparkles}
          tone="green"
        />
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Görev veya not ara..."
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[12px] outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
          />
        </div>
        {isProduction ? (
          <select
            value={priority}
            aria-label="Önceliğe göre süz"
            onChange={event =>
              setPriority(event.target.value as "all" | TaskPriority)
            }
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-600 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
          >
            <option value="all">Tüm öncelikler</option>
            {TASK_PRIORITIES.map(item => (
              <option key={item} value={item}>
                {TASK_PRIORITY_META[item].label}
              </option>
            ))}
          </select>
        ) : (
          <select
            value={category}
            onChange={event =>
              setCategory(event.target.value as "Tümü" | DayPlanTaskCategory)
            }
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-600 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
          >
            <option value="Tümü">Tümü</option>
            {categories.map(item => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Pano boşken de dört sütun çizilir (C-10): nereye ne eklenebileceği
          ilk görevden önce görünür. */}
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {columns.map(column => {
          const columnTasks = filtered.filter(
            task => getTaskColumn(task) === column.status
          );
          return (
            <section
              key={column.status}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_4px_16px_rgba(15,23,42,.025)]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <p className="text-[12px] font-extrabold text-slate-800">
                    {column.status}
                  </p>
                  <Badge tone="slate">{columnTasks.length}</Badge>
                </div>
                {column.status === "Tamamlandı" ? null : (
                  <button
                    onClick={() => handleColumnAdd(column.status)}
                    aria-label={`${column.status} sütununa görev ekle`}
                    className="grid h-6 w-6 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <p className="mt-0.5 text-[10px] text-slate-400">{column.hint}</p>
              <div className="mt-3 space-y-2.5">
                {columnTasks.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 p-3 text-center text-[10px] text-slate-400">
                    Bu sütunda görev yok.
                  </p>
                ) : (
                  columnTasks.map(task => (
                    <DayPlanTaskCard
                      key={task.id}
                      task={task}
                      organizationId={organizationId}
                      membershipId={membershipId}
                      onEdit={onEditTask}
                      setTasks={setTasks}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
