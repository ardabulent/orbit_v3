import { useState } from "react";
import { isDemoMode } from "@/auth/runtime";
import { getTodayWeekDay, type WeekDay } from "@/education/weekDays";
import { schedule as defaultSchedule } from "../educationData";
import { filterScheduleForRole } from "../scopeFilters";
import {
  Badge,
  EmptyState,
  ErrorState,
  PageHeader,
  TableSkeleton,
} from "../shared";
import type { Role, ScheduleItem } from "../types";
import { ScheduleArchiveDialog } from "./ScheduleArchiveDialog";
import { ScheduleDayList } from "./ScheduleDayList";
import { ScheduleEntryFormDialog } from "./ScheduleEntryFormDialog";
import {
  ALL,
  filterSchedule,
  NO_TEACHER,
  teacherOptions,
  type ScheduleFilter,
} from "./scheduleGrid";
import { ScheduleWeekGrid } from "./ScheduleWeekGrid";

/**
 * Ders programı (karar 2026-09-28): geniş ekranda haftalık tablo, telefonda
 * gün gün liste. Üstte sınıf süzgeci (programda birden çok sınıf varsa) ve
 * yöneticide öğretmen süzgeci; "Öğretmensiz" seçeneği atama bekleyen dersleri
 * bulmanın yoludur.
 *
 * Yazma eylemleri yalnız yöneticide ve canlı modda verilir; bu bir kullanıcı
 * deneyimi kararıdır, yetki sınırı RLS'tedir.
 */
export function SchedulePage({
  role,
  schedule: scheduleList = defaultSchedule,
  isLoading = false,
  error = null,
  onRetry,
  truncated = false,
  limit,
  organizationId = "",
  classes = [],
}: {
  role: Role;
  schedule?: ScheduleItem[];
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  truncated?: boolean;
  /** Üst sınırın tek kaynağı servistedir; bant onu tekrar etmez, gösterir (K-06). */
  limit?: number;
  organizationId?: string;
  classes?: { id: string; name: string }[];
}) {
  const today = getTodayWeekDay();
  const canWrite = role === "admin" && !isDemoMode;

  const [filter, setFilter] = useState<ScheduleFilter>({
    classId: ALL,
    teacher: ALL,
  });
  const [formOpen, setFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ScheduleItem | null>(null);
  const [addAt, setAddAt] = useState<{ day: WeekDay; time?: string }>({
    day: today,
  });
  const [entryToArchive, setEntryToArchive] = useState<ScheduleItem | null>(
    null
  );

  const roleFiltered = filterScheduleForRole(scheduleList, role, isDemoMode);
  const visible = filterSchedule(roleFiltered, filter);

  // Süzgeçte yalnız programda geçen sınıflar; ad sınıf listesinden, yoksa
  // program satırından okunur.
  const classNames = new Map(classes.map(c => [c.id, c.name]));
  const classOptions = [
    ...new Map(
      roleFiltered
        .filter(item => item.classId)
        .map(item => [
          item.classId as string,
          classNames.get(item.classId as string) ?? item.group ?? "Sınıf",
        ])
    ),
  ].sort((a, b) => a[1].localeCompare(b[1], "tr"));
  const teachers = role === "admin" ? teacherOptions(roleFiltered) : [];
  const unassigned = roleFiltered.filter(item => !item.membershipId).length;

  const openAdd = (day: WeekDay = today, time?: string) => {
    setEditingEntry(null);
    setAddAt({ day, time });
    setFormOpen(true);
  };
  const openEdit = (item: ScheduleItem) => {
    setEditingEntry(item);
    setFormOpen(true);
  };

  return (
    <>
      <PageHeader
        eyebrow="Haftalık plan"
        title={
          role === "student"
            ? "Ders programım"
            : role === "parent"
              ? "Öğrenci ders programı"
              : "Ders programı"
        }
        description="Haftanın derslerini, öğretmenlerini ve saatlerini tek tabloda izleyin."
        action={canWrite ? "Ders programı ekle" : undefined}
        onAction={canWrite ? () => openAdd() : undefined}
      />
      {truncated ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-[11px] font-semibold text-amber-800">
          Liste üst sınıra ({limit} kayıt) ulaştı. Kalan kayıtları görmek için
          filtreleri kullanın.
        </div>
      ) : null}

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_16px_rgba(15,23,42,.025)]">
        {classOptions.length > 1 || teachers.length > 1 || unassigned > 0 ? (
          <div className="mb-4 flex flex-wrap items-center gap-3 border-b border-slate-100 pb-4">
            {classOptions.length > 1 ? (
              <FilterSelect
                label="Sınıf"
                value={filter.classId}
                onChange={classId => setFilter(f => ({ ...f, classId }))}
                options={classOptions.map(([key, label]) => ({ key, label }))}
              />
            ) : null}
            {teachers.length > 1 ? (
              <FilterSelect
                label="Öğretmen"
                value={filter.teacher}
                onChange={teacher => setFilter(f => ({ ...f, teacher }))}
                options={teachers}
              />
            ) : null}
            {role === "admin" && unassigned > 0 ? (
              <button
                type="button"
                onClick={() => setFilter({ classId: ALL, teacher: NO_TEACHER })}
                className="ml-auto"
              >
                <Badge tone="amber">{unassigned} ders öğretmensiz</Badge>
              </button>
            ) : null}
          </div>
        ) : null}

        {isLoading ? (
          <TableSkeleton
            rows={4}
            columns={3}
            className="border-0 p-0 shadow-none"
          />
        ) : error ? (
          <ErrorState
            title="Ders programı görüntülenemedi"
            message={error.message}
            onRetry={onRetry}
          />
        ) : visible.length === 0 ? (
          <EmptyState
            title={
              roleFiltered.length === 0
                ? "Ders programı boş"
                : "Bu süzgeçte ders yok"
            }
            description={
              roleFiltered.length === 0
                ? "Henüz planlanmış bir ders yok."
                : "Süzgeci değiştirerek diğer dersleri görebilirsiniz."
            }
          />
        ) : (
          <>
            <div className="hidden md:block">
              <ScheduleWeekGrid
                items={visible}
                showClass={filter.classId === ALL && classOptions.length > 1}
                today={today}
                onEdit={canWrite ? openEdit : undefined}
                onRemove={canWrite ? setEntryToArchive : undefined}
                onAddAt={canWrite ? openAdd : undefined}
              />
            </div>
            <div className="md:hidden">
              <ScheduleDayList
                items={visible}
                today={today}
                onEdit={canWrite ? openEdit : undefined}
                onRemove={canWrite ? setEntryToArchive : undefined}
              />
            </div>
          </>
        )}
      </section>

      {formOpen && organizationId ? (
        <ScheduleEntryFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          organizationId={organizationId}
          classes={classes}
          entry={editingEntry}
          defaultDay={addAt.day}
          defaultStartsAt={addAt.time}
          defaultClassId={filter.classId === ALL ? undefined : filter.classId}
          onDone={() => setEditingEntry(null)}
        />
      ) : null}

      {entryToArchive && organizationId ? (
        <ScheduleArchiveDialog
          organizationId={organizationId}
          entry={entryToArchive}
          onClose={() => setEntryToArchive(null)}
        />
      ) : null}
    </>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { key: string; label: string }[];
}) {
  return (
    <label className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
      {label}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[12px] font-semibold text-slate-800"
      >
        <option value={ALL}>Tümü</option>
        {options.map(option => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
