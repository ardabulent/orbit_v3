import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  DEFAULT_DAY_PLAN_LIMIT,
  type CalendarEventItem,
  type TaskItem,
  type TaskStatus,
} from "@/education/dayPlanService";
import {
  useCalendarEvents,
  useSchedule,
  useTasks,
} from "@/education/educationQueries";
import { dayPlanEventsByRole } from "../educationData";
import { ErrorState, PageHeader } from "../shared";
import type { DayPlanRole, DayPlanTask, Role, ScheduleItem } from "../types";
import { CalendarEventFormDialog } from "./CalendarEventFormDialog";
import { DayPlanCalendar } from "./DayPlanCalendar";
import type { CalendarExam } from "./dayPlanHelpers";
import { DayPlanToDoBoard } from "./DayPlanToDoBoard";
import { TaskFormDialog } from "./TaskFormDialog";

const tabs = [
  { id: "todo", label: "Yapılacaklar" },
  { id: "calendar", label: "Takvim" },
] as const;

type DayPlanTab = (typeof tabs)[number]["id"];

export type DayPlanPageProps = {
  role: DayPlanRole | Role;
  tasks?: DayPlanTask[];
  setTasks?: React.Dispatch<React.SetStateAction<DayPlanTask[]>>;
  isDemo?: boolean;
  organizationId?: string;
  membershipId?: string;
  schedule?: ScheduleItem[];
  /** Takvime düşen sınavlar (salt okunur, C-07). */
  exams?: CalendarExam[];
};

export function DayPlanPage({
  role,
  tasks = [],
  setTasks,
  isDemo = false,
  organizationId = "",
  membershipId = "",
  schedule,
  exams,
}: DayPlanPageProps) {
  const [tab, setTab] = useState<DayPlanTab>("todo");

  // Görev modal durumu
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  /**
   * Formlar alanlarını `useState` başlangıç değerinden okuyor, yani yalnız
   * İLK kuruluşta. Pencere sayfada hep kurulu kaldığı için sonraki açılışlarda
   * düzenlenen görevin bilgileri ve "+"nın hazır tarihi hiç okunmuyordu:
   * "Görevi Düzenle" boş açılıyordu (ölçüldü, 2026-09-27). Her açılış yeni bir
   * `key` alır ve form sıfırdan kurulur.
   */
  const [formSession, setFormSession] = useState(0);
  const [taskForEdit, setTaskForEdit] = useState<TaskItem | null>(null);
  const [initialDueOn, setInitialDueOn] = useState<string | null>(null);
  const [initialStatus, setInitialStatus] = useState<TaskStatus | null>(null);

  // Takvim modal durumu
  const [calendarFormOpen, setCalendarFormOpen] = useState(false);
  const [eventForEdit, setEventForEdit] = useState<CalendarEventItem | null>(
    null
  );
  const [initialEventDate, setInitialEventDate] = useState<string | null>(null);

  const isReal = !isDemo && Boolean(organizationId && membershipId);

  // Gerçek veri sorguları
  const tasksQuery = useTasks({
    organizationId,
    membershipId,
    enabled: isReal,
  });

  const calendarEventsQuery = useCalendarEvents({
    organizationId,
    membershipId,
    enabled: isReal,
  });

  const scheduleQuery = useSchedule({
    organizationId,
    enabled: isReal && !schedule,
  });

  const realTasks = tasksQuery.data?.rows ?? [];
  const realCalendarEvents = calendarEventsQuery.data?.rows ?? [];
  const activeSchedule = schedule ?? scheduleQuery.data?.rows ?? [];

  const handleOpenAddTask = (dueOn?: string, status?: TaskStatus) => {
    if (!isReal) {
      toast.info("Yeni görev", {
        description:
          "Demo MVP'de görev oluşturma formu bir sonraki kalıcı veri fazında etkinleşecek.",
      });
      return;
    }
    setTaskForEdit(null);
    setInitialDueOn(dueOn ?? null);
    setInitialStatus(status ?? null);
    setFormSession(session => session + 1);
    setTaskFormOpen(true);
  };

  const handleOpenAddCalendarEvent = (date?: string) => {
    if (!isReal) {
      toast.info("Yeni görüşme", {
        description:
          "Demo MVP'de görüşme planlama bir sonraki kalıcı veri fazında etkinleşecek.",
      });
      return;
    }
    setEventForEdit(null);
    setInitialEventDate(date ?? null);
    setFormSession(session => session + 1);
    setCalendarFormOpen(true);
  };

  const handleEditTask = (task: TaskItem) => {
    setTaskForEdit(task);
    setInitialDueOn(null);
    setFormSession(session => session + 1);
    setTaskFormOpen(true);
  };

  const handleEditCalendarEvent = (event: CalendarEventItem) => {
    setEventForEdit(event);
    setInitialEventDate(null);
    setFormSession(session => session + 1);
    setCalendarFormOpen(true);
  };

  const addAction =
    tab === "todo"
      ? {
          label: "Yeni görev",
          onClick: () => handleOpenAddTask(),
        }
      : {
          label: "Yeni Görüşme Ekle",
          onClick: () => handleOpenAddCalendarEvent(),
        };

  return (
    <>
      <PageHeader
        eyebrow="Kişisel çalışma alanı"
        title="Gün Planı"
        description="Günlük görevlerinizi ve görüşmelerinizi tek ekrandan yönetin."
      />
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
          {tabs.map(item => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`rounded-lg px-3.5 py-1.5 text-[11px] font-bold transition ${
                tab === item.id
                  ? "bg-slate-900 text-white"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button
          onClick={addAction.onClick}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-[12px] font-bold text-white shadow-[0_8px_16px_rgba(15,23,42,.12)] transition hover:bg-slate-800 active:scale-[.98]"
        >
          <Plus className="h-4 w-4" />
          {addAction.label}
        </button>
      </div>

      <div className="mt-5">
        {tab === "todo" ? (
          isReal ? (
            tasksQuery.isLoading ? (
              <div className="py-12 text-center text-[13px] text-slate-400">
                Görevler yükleniyor...
              </div>
            ) : tasksQuery.error ? (
              <ErrorState
                title="Görevler yüklenemedi"
                message={tasksQuery.error.message}
                onRetry={() => void tasksQuery.refetch()}
              />
            ) : (
              <DayPlanToDoBoard
                tasks={realTasks}
                organizationId={organizationId}
                membershipId={membershipId}
                onAddTask={handleOpenAddTask}
                onEditTask={handleEditTask}
                truncated={Boolean(tasksQuery.data?.truncated)}
              />
            )
          ) : (
            <DayPlanToDoBoard
              tasks={tasks}
              setTasks={setTasks}
              onAddTask={handleOpenAddTask}
            />
          )
        ) : isReal ? (
          calendarEventsQuery.isLoading ? (
            <div className="py-12 text-center text-[13px] text-slate-400">
              Takvim yükleniyor...
            </div>
          ) : calendarEventsQuery.error ? (
            <ErrorState
              title="Takvim yüklenemedi"
              message={calendarEventsQuery.error.message}
              onRetry={() => void calendarEventsQuery.refetch()}
            />
          ) : (
            <div>
              {calendarEventsQuery.data?.truncated ? (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] font-medium text-amber-800">
                  Toplam etkinlik sayısı sınırına ({DEFAULT_DAY_PLAN_LIMIT})
                  ulaşıldı.
                </div>
              ) : null}
              <DayPlanCalendar
                personalEvents={realCalendarEvents}
                schedule={activeSchedule}
                exams={exams}
                role={role}
                organizationId={organizationId}
                membershipId={membershipId}
                isDemo={false}
                onEditEvent={handleEditCalendarEvent}
              />
            </div>
          )
        ) : (
          <DayPlanCalendar
            events={dayPlanEventsByRole[role as DayPlanRole] ?? []}
            isDemo={true}
          />
        )}
      </div>

      {/* Görev Oluşturma / Düzenleme Modalı */}
      {isReal ? (
        <TaskFormDialog
          key={`task-${formSession}`}
          open={taskFormOpen}
          onOpenChange={setTaskFormOpen}
          organizationId={organizationId}
          membershipId={membershipId}
          task={taskForEdit}
          initialDueOn={initialDueOn}
          initialStatus={initialStatus}
          onDone={() => {
            setTaskForEdit(null);
            setInitialDueOn(null);
          }}
        />
      ) : null}

      {/* Takvim Etkinliği Oluşturma / Düzenleme Modalı */}
      {isReal ? (
        <CalendarEventFormDialog
          key={`event-${formSession}`}
          open={calendarFormOpen}
          onOpenChange={setCalendarFormOpen}
          organizationId={organizationId}
          membershipId={membershipId}
          event={eventForEdit}
          initialDate={initialEventDate ?? undefined}
          onDone={() => {
            setEventForEdit(null);
            setInitialEventDate(null);
          }}
        />
      ) : null}
    </>
  );
}
