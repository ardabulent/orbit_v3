import {
  BookOpen,
  CalendarClock,
  ChevronRight,
  CircleCheck,
  ClipboardCheck,
  CreditCard,
  GraduationCap,
  Megaphone,
  UserPlus,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { isDemoMode } from "@/auth/runtime";
import {
  useAdminOverview,
  usePaymentOverview,
  useTodayLessons,
} from "@/education/educationQueries";
import type { TodayLesson } from "@/education/overviewService";
import { formatTrDate, getOrbitToday } from "@/education/trDate";
import {
  Badge,
  CardSkeleton,
  EmptyState,
  ErrorState,
  StatCard,
} from "../shared";
import type { Section } from "../types";

/**
 * Yönetici Genel Bakış.
 *
 * Eskiden bütün kartlarını demo modülünden alıyordu ve gerçek modda her şeye
 * sıfır diyordu (ROADMAP §4.23 B3). Artık iki veritabanı fonksiyonuna bağlı
 * (`admin_overview_counts`, `today_lessons`) ve ölçülmemiş hiçbir cümle
 * kurmuyor: "Sistemler çalışıyor" gibi bir rozet, arkasında ölçüm yoksa
 * yalnız süstür (**K-03**).
 *
 * Ekranın işi sayı sergilemek değil, **yöneticiye bugün neye bakması
 * gerektiğini söylemek**. Bu yüzden ağırlık "Dikkat isteyenler" listesinde;
 * her satır sorunun çözüleceği sekmeye götürüyor.
 */
export function AdminDashboard({
  onNavigate,
}: {
  onNavigate: (section: Section) => void;
}) {
  const overviewQuery = useAdminOverview({ enabled: !isDemoMode });
  const lessonsQuery = useTodayLessons({ enabled: !isDemoMode });
  const paymentQuery = usePaymentOverview({ enabled: !isDemoMode });

  return (
    <>
      <OverviewHeader />
      {isDemoMode ? (
        <div className="mt-5">
          <EmptyState
            title="Önizleme modu"
            description="Genel Bakış yalnız gerçek kurum verisini gösterir. Önizlemede sayı uydurulmaz."
          />
        </div>
      ) : (
        <>
          <StatsRow
            query={overviewQuery}
            overdueInstallments={paymentQuery.data?.overdueCount ?? null}
          />
          <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_1fr]">
            <AttentionPanel
              query={overviewQuery}
              overdueInstallments={paymentQuery.data?.overdueCount ?? null}
              onNavigate={onNavigate}
            />
            <QuickActions onNavigate={onNavigate} />
          </div>
          <TodayLessonsPanel query={lessonsQuery} onNavigate={onNavigate} />
        </>
      )}
    </>
  );
}

function OverviewHeader() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-[0_10px_30px_rgba(15,23,42,.04)] sm:px-7">
      <div className="absolute -right-20 -top-28 h-64 w-64 rounded-full bg-sky-100/70 blur-3xl" />
      <div className="relative flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-blue-600">
            Kurum genel bakış
          </p>
          <h1 className="mt-2 font-display text-[27px] font-extrabold tracking-[-.055em] text-slate-950 sm:text-[33px]">
            Bugün kurumda neler var?
          </h1>
          <p className="mt-2 max-w-2xl text-[12px] leading-5 text-slate-500">
            Dikkat isteyen durumlar, bugünün dersleri ve yoklama durumu.
          </p>
        </div>
        {/* "Bugün" veritabanıyla aynı kaynaktan: Türkiye saati (`orbit_today`). */}
        <Badge tone="blue">{formatTrDate(getOrbitToday())}</Badge>
      </div>
    </section>
  );
}

type OverviewQuery = ReturnType<typeof useAdminOverview>;
type LessonsQuery = ReturnType<typeof useTodayLessons>;

function StatsRow({
  query,
  overdueInstallments,
}: {
  query: OverviewQuery;
  overdueInstallments: number | null;
}) {
  if (query.isPending) {
    return (
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <CardSkeleton key={index} />
        ))}
      </div>
    );
  }
  if (query.isError || !query.data) {
    return (
      <ErrorState
        className="mt-5"
        message="Kurum sayıları alınamadı."
        onRetry={() => void query.refetch()}
      />
    );
  }

  const counts = query.data;
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Aktif öğrenci"
        value={String(counts.activeStudents)}
        icon={Users}
        tone="blue"
      />
      <StatCard
        label="Aktif sınıf"
        value={String(counts.activeClasses)}
        icon={GraduationCap}
        tone="violet"
      />
      <StatCard
        label="Bugünkü ders"
        value={String(counts.lessonsToday)}
        icon={CalendarClock}
        tone="green"
      />
      <StatCard
        label="Vadesi geçmiş taksit"
        // Ödeme sayısı alınamadıysa sıfır yazılmaz; "—" bilinmediğini söyler.
        value={overdueInstallments === null ? "—" : String(overdueInstallments)}
        icon={CreditCard}
        tone={overdueInstallments ? "rose" : "amber"}
      />
    </div>
  );
}

type AttentionItem = {
  count: number;
  label: string;
  hint: string;
  target: Section;
};

function AttentionPanel({
  query,
  overdueInstallments,
  onNavigate,
}: {
  query: OverviewQuery;
  overdueInstallments: number | null;
  onNavigate: (section: Section) => void;
}) {
  const counts = query.data;
  const items: AttentionItem[] = [];
  if (counts) {
    items.push(
      {
        count: counts.classesMissingAttendanceToday,
        label: "sınıfın bugünkü yoklaması alınmadı",
        hint: "Bugün dersi olan sınıflar",
        target: "Yoklama",
      },
      {
        count: counts.studentsWithoutClass,
        label: "öğrenci hiçbir sınıfa kayıtlı değil",
        hint: "Sınıfa atanmayan öğrenci programda görünmez",
        target: "Sınıflar",
      },
      {
        count: counts.studentsWithoutGuardian,
        label: "öğrencinin velisi bağlanmamış",
        hint: "Veli bildirim ve duyuru alamaz",
        target: "Öğrenciler",
      }
    );
    // Ödeme sayısı ayrı sorgudan gelir; alınamadıysa (`null`) satır çizilmez.
    if (overdueInstallments !== null) {
      items.push({
        count: overdueInstallments,
        label: "taksitin vadesi geçti",
        hint: "Ödenmemiş ve son günü geçmiş",
        target: "Kayıt ve Ödemeler",
      });
    }
  }
  const visibleItems = items.filter(item => item.count > 0);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_16px_rgba(15,23,42,.03)]">
      <h2 className="font-display text-[17px] font-extrabold tracking-[-.03em] text-slate-900">
        Dikkat isteyenler
      </h2>
      <p className="mt-1 text-[11px] text-slate-500">
        Her satır, çözüleceği sekmeye götürür
      </p>
      <div className="mt-4 space-y-2.5">
        {query.isPending ? <CardSkeleton /> : null}
        {query.isError ? (
          <p className="text-[11px] text-rose-700">
            Liste, sayılar alınamadığı için gösterilemiyor.
          </p>
        ) : null}
        {counts && visibleItems.length === 0 ? (
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
            onClick={() => onNavigate(item.target)}
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

const QUICK_ACTIONS: {
  label: string;
  target: Section;
  icon: LucideIcon;
}[] = [
  { label: "Yoklama al", target: "Yoklama", icon: ClipboardCheck },
  { label: "Öğrenci ekle", target: "Öğrenciler", icon: UserPlus },
  { label: "Duyuru yaz", target: "İletişim", icon: Megaphone },
  { label: "Ödeme kaydet", target: "Kayıt ve Ödemeler", icon: CreditCard },
];

function QuickActions({
  onNavigate,
}: {
  onNavigate: (section: Section) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_16px_rgba(15,23,42,.03)]">
      <h2 className="font-display text-[17px] font-extrabold tracking-[-.03em] text-slate-900">
        Hızlı işlemler
      </h2>
      <p className="mt-1 text-[11px] text-slate-500">
        İşin yapıldığı sekmeyi açar
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {QUICK_ACTIONS.map(action => (
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

function TodayLessonsPanel({
  query,
  onNavigate,
}: {
  query: LessonsQuery;
  onNavigate: (section: Section) => void;
}) {
  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_16px_rgba(15,23,42,.03)]">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-[17px] font-extrabold tracking-[-.03em] text-slate-900">
            Bugünün dersleri
          </h2>
          <p className="mt-1 text-[11px] text-slate-500">
            Yoklama sınıf başına günde bir kez alınır
          </p>
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
        {query.isPending ? <CardSkeleton /> : null}
        {query.isError ? (
          <ErrorState
            message="Bugünün dersleri alınamadı."
            onRetry={() => void query.refetch()}
          />
        ) : null}
        {query.data && query.data.length === 0 ? (
          <EmptyState
            title="Bugün programda ders yok"
            description="Ders programına eklenen dersler burada gün gün görünür."
          />
        ) : null}
        {query.data?.map(lesson => (
          <LessonRow key={lesson.id} lesson={lesson} onNavigate={onNavigate} />
        ))}
      </div>
    </section>
  );
}

function LessonRow({
  lesson,
  onNavigate,
}: {
  lesson: TodayLesson;
  onNavigate: (section: Section) => void;
}) {
  const details = [lesson.teacher, lesson.room].filter(Boolean).join(" · ");
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
      {lesson.attendanceTaken ? (
        <Badge tone="green">Yoklama alındı</Badge>
      ) : (
        <button
          type="button"
          onClick={() => onNavigate("Yoklama")}
          className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-amber-700 transition hover:bg-amber-100"
        >
          <UsersRound className="h-3 w-3" />
          <span className="text-[10px] font-extrabold">Yoklama bekliyor</span>
        </button>
      )}
    </div>
  );
}
