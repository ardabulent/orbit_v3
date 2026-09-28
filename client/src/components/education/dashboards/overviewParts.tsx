import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  CircleCheck,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type {
  TodayLesson,
  UpcomingHomework,
} from "@/education/overviewService";
import { formatTrDate, getOrbitToday } from "@/education/trDate";
import { Badge, CardSkeleton, EmptyState, ErrorState } from "../shared";
import type { Section } from "../types";
import type { StudentFilter } from "../pages/studentFilters";

/**
 * Genel Bakış ekranlarının ortak parçaları.
 *
 * Her rolün Genel Bakış'ı kendi dosyasında ve kendi sorusunu soruyor
 * (yönetici: kurum; öğretmen: kendi günü). Burada yalnız **görünüm** ortak:
 * dikkat listesi, hızlı işlemler ve ders satırı iki yerde ayrı çizilseydi biri
 * düzeltilip diğeri eskirdi (**K-06**).
 */

type Navigate = (section: Section) => void;

const PANEL =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_16px_rgba(15,23,42,.03)]";

export function OverviewHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-[0_10px_30px_rgba(15,23,42,.04)] sm:px-7">
      <div className="absolute -right-20 -top-28 h-64 w-64 rounded-full bg-sky-100/70 blur-3xl" />
      <div className="relative flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-blue-600">
            {eyebrow}
          </p>
          <h1 className="mt-2 font-display text-[27px] font-extrabold tracking-[-.055em] text-slate-950 sm:text-[33px]">
            {title}
          </h1>
          <p className="mt-2 max-w-2xl text-[12px] leading-5 text-slate-500">
            {description}
          </p>
        </div>
        {/* "Bugün" veritabanıyla aynı kaynaktan: Türkiye saati (`orbit_today`). */}
        <Badge tone="blue">{formatTrDate(getOrbitToday())}</Badge>
      </div>
    </section>
  );
}

export function DemoNotice() {
  return (
    <div className="mt-5">
      <EmptyState
        title="Önizleme modu"
        description="Genel Bakış yalnız gerçek kurum verisini gösterir. Önizlemede sayı uydurulmaz."
      />
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <CardSkeleton key={index} />
      ))}
    </div>
  );
}

export type AttentionItem = {
  count: number;
  label: string;
  hint: string;
  target: Section;
  /**
   * Varsa satır, hedef sekme yerine öğrenci listesini bu süzgeç açık olarak
   * açar: "2 öğrenci sınıfsız" satırına tıklayan o 2 öğrenciyi görür.
   */
  studentFilter?: StudentFilter;
};

/**
 * `items` null ise sayılar henüz yok ya da alınamadı; boş dizi ise ölçüldü ve
 * dikkat isteyen bir şey yok. İkisi ayrı çizilir — "sorun yok" demek bir
 * ölçümdür, bilinmezlikte söylenmez (**K-03**).
 */
export function AttentionPanel({
  items,
  isPending,
  isError,
  onNavigate,
  onOpenStudents,
}: {
  items: AttentionItem[] | null;
  isPending: boolean;
  isError: boolean;
  onNavigate: Navigate;
  onOpenStudents?: (filter: StudentFilter) => void;
}) {
  const visibleItems = items?.filter(item => item.count > 0) ?? [];

  return (
    <section className={PANEL}>
      <h2 className="font-display text-[17px] font-extrabold tracking-[-.03em] text-slate-900">
        Dikkat isteyenler
      </h2>
      <p className="mt-1 text-[11px] text-slate-500">
        Her satır, çözüleceği sekmeye götürür
      </p>
      <div className="mt-4 space-y-2.5">
        {isPending ? <CardSkeleton /> : null}
        {isError ? (
          <p className="text-[11px] text-rose-700">
            Liste, sayılar alınamadığı için gösterilemiyor.
          </p>
        ) : null}
        {items && visibleItems.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3.5 py-3">
            <CircleCheck className="h-4 w-4 text-emerald-600" />
            <p className="text-[12px] font-bold text-emerald-800">
              Şu an dikkat isteyen bir durum yok.
            </p>
          </div>
        ) : null}
        {visibleItems.map(item => (
          <button
            key={item.label}
            type="button"
            onClick={() =>
              item.studentFilter && onOpenStudents
                ? onOpenStudents(item.studentFilter)
                : onNavigate(item.target)
            }
            className="flex w-full items-center gap-3 rounded-xl border border-amber-100 bg-amber-50/50 px-3.5 py-3 text-left transition hover:border-amber-200 hover:bg-amber-50"
          >
            <span className="grid h-9 min-w-9 place-items-center rounded-lg bg-amber-100 px-2 font-display text-[15px] font-extrabold tabular-nums text-amber-800">
              {item.count}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-bold text-slate-800">
                {item.label}
              </span>
              <span className="mt-0.5 block text-[10px] text-slate-500">
                {item.hint}
              </span>
            </span>
            <span className="hidden text-[10px] font-bold text-amber-800 sm:inline">
              {item.target}
            </span>
            <ChevronRight className="h-4 w-4 text-amber-400" />
          </button>
        ))}
      </div>
    </section>
  );
}

export type QuickAction = {
  label: string;
  target: Section;
  icon: LucideIcon;
};

export function QuickActions({
  actions,
  onNavigate,
}: {
  actions: QuickAction[];
  onNavigate: Navigate;
}) {
  return (
    <section className={PANEL}>
      <h2 className="font-display text-[17px] font-extrabold tracking-[-.03em] text-slate-900">
        Hızlı işlemler
      </h2>
      <p className="mt-1 text-[11px] text-slate-500">
        İşin yapıldığı sekmeyi açar
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {actions.map(action => (
          <button
            key={action.label}
            type="button"
            onClick={() => onNavigate(action.target)}
            className="flex flex-col items-start gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 text-left transition hover:border-blue-200 hover:bg-blue-50/50"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-blue-600 ring-1 ring-slate-200">
              <action.icon className="h-4 w-4" />
            </span>
            <span className="text-[12px] font-bold text-slate-800">
              {action.label}
            </span>
            <span className="text-[10px] text-slate-500">{action.target}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function LessonsPanel({
  title,
  emptyTitle,
  lessons,
  isPending,
  isError,
  onRetry,
  showTeacher,
  showAttendance = true,
  onNavigate,
}: {
  title: string;
  emptyTitle: string;
  lessons: TodayLesson[] | undefined;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  showTeacher: boolean;
  /**
   * Öğrenci ve veli için kapalı: yoklama rozeti "sınıfın oturumu açıldı mı"
   * sorusunu cevaplar — öğretmenin sorusu. Öğrencinin yoklama sekmesi yok ve
   * rozet oraya götürüyor.
   */
  showAttendance?: boolean;
  onNavigate: Navigate;
}) {
  return (
    <section className={`mt-6 ${PANEL}`}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-[17px] font-extrabold tracking-[-.03em] text-slate-900">
            {title}
          </h2>
          {showAttendance ? (
            <p className="mt-1 text-[11px] text-slate-500">
              Yoklama sınıf başına günde bir kez alınır
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => onNavigate("Ders Programı")}
          className="text-blue-600"
        >
          <span className="text-[11px] font-bold">Programı aç</span>
        </button>
      </div>
      <div className="mt-4 space-y-2.5">
        {isPending ? <CardSkeleton /> : null}
        {isError ? (
          <ErrorState message="Bugünün dersleri alınamadı." onRetry={onRetry} />
        ) : null}
        {lessons && lessons.length === 0 ? (
          <EmptyState
            title={emptyTitle}
            description="Ders programına eklenen dersler burada gün gün görünür."
          />
        ) : null}
        {lessons?.map(lesson => (
          <LessonRow
            key={lesson.id}
            lesson={lesson}
            showTeacher={showTeacher}
            showAttendance={showAttendance}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </section>
  );
}

function LessonRow({
  lesson,
  showTeacher,
  showAttendance,
  onNavigate,
}: {
  lesson: TodayLesson;
  showTeacher: boolean;
  showAttendance: boolean;
  onNavigate: Navigate;
}) {
  const details = [showTeacher ? lesson.teacher : null, lesson.room]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 px-3.5 py-3">
      <span className="w-20 text-[11px] font-extrabold tabular-nums text-slate-500">
        {lesson.endTime ? `${lesson.time}–${lesson.endTime}` : lesson.time}
      </span>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600 ring-1 ring-blue-100">
        <BookOpen className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-bold text-slate-800">
          {lesson.title}{" "}
          <span className="font-medium text-slate-400">
            · {lesson.className}
          </span>
        </p>
        {details ? (
          <p className="mt-0.5 truncate text-[10px] text-slate-500">
            {details}
          </p>
        ) : null}
      </div>
      {lesson.isSubstitute ? (
        <Badge tone="violet">
          {lesson.teacher ? `${lesson.teacher} yerine` : "Vekil"}
        </Badge>
      ) : null}
      {showAttendance ? (
        <AttendanceStatus
          taken={lesson.attendanceTaken}
          onNavigate={onNavigate}
        />
      ) : null}
    </div>
  );
}

/**
 * `null`: çağıran bu sınıfın yoklamasını göremiyor (vekil). "Alınmadı"
 * denmez, rozet hiç çizilmez — bilinmeyen bir durum ölçüm gibi gösterilmez.
 */
function AttendanceStatus({
  taken,
  onNavigate,
}: {
  taken: boolean | null;
  onNavigate: Navigate;
}) {
  if (taken === null) return null;
  if (taken) return <Badge tone="green">Yoklama alındı</Badge>;
  return (
    <button
      type="button"
      onClick={() => onNavigate("Yoklama")}
      className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-amber-700 transition hover:bg-amber-100"
    >
      <UsersRound className="h-3 w-3" />
      <span className="text-[10px] font-extrabold">Yoklama bekliyor</span>
    </button>
  );
}

/** Teslim tarihini "Bugün", "Yarın" ya da tarih olarak yazar. */
function dueLabel(dueDate: string): string {
  const now = new Date();
  if (dueDate === getOrbitToday(now)) return "Bugün";
  // Türkiye'de yaz saati yok: 24 saat sonrası, Türkiye takviminde yarındır.
  const tomorrow = getOrbitToday(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  if (dueDate === tomorrow) return "Yarın";
  return formatTrDate(dueDate);
}

export function HomeworkPanel({
  homework,
  isPending,
  isError,
  onRetry,
  onNavigate,
}: {
  homework: UpcomingHomework[] | undefined;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  onNavigate: Navigate;
}) {
  return (
    <section className={PANEL}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-[17px] font-extrabold tracking-[-.03em] text-slate-900">
            Yaklaşan ödevler
          </h2>
          <p className="mt-1 text-[11px] text-slate-500">
            Önümüzdeki 7 gün, teslim tarihine göre
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate("Ödevler")}
          className="text-blue-600"
        >
          <span className="text-[11px] font-bold">Tüm ödevler</span>
        </button>
      </div>
      <div className="mt-4 space-y-2.5">
        {isPending ? <CardSkeleton /> : null}
        {isError ? (
          <ErrorState message="Yaklaşan ödevler alınamadı." onRetry={onRetry} />
        ) : null}
        {homework && homework.length === 0 ? (
          <EmptyState title="Önümüzdeki 7 günde teslim edilecek ödev yok" />
        ) : null}
        {homework?.map(item => {
          const label = dueLabel(item.dueDate);
          const urgent = label === "Bugün" || label === "Yarın";
          return (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-slate-100 px-3.5 py-3"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-600 ring-1 ring-violet-100">
                <CalendarDays className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-bold text-slate-800">
                  {item.title}
                </p>
                <p className="mt-0.5 truncate text-[10px] text-slate-500">
                  {[item.subject, item.className].filter(Boolean).join(" · ")}
                </p>
              </div>
              <Badge tone={urgent ? "amber" : "slate"}>{label}</Badge>
            </div>
          );
        })}
      </div>
    </section>
  );
}
