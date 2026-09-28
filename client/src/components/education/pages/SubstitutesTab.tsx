import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { educationKeys, useSubstitutes } from "@/education/educationQueries";
import {
  cancelSubstitute,
  type SubstituteAssignment,
} from "@/education/substituteService";
import { getOrbitToday } from "@/education/trDate";
import { useSettingsMembers } from "@/settings/settingsQueries";
import { Badge, EmptyState, ErrorState, TableSkeleton } from "../shared";
import type { ScheduleItem } from "../types";
import { formatDateRange, groupSubstitutes } from "./substitutePeriods";
import { SubstituteFormDialog } from "./SubstituteFormDialog";
import { eligibleTeachers } from "./teacherEligibility";

/** Geçmiş vekilliklerden gösterilen en yeni kayıt sayısı. */
const PAST_SHOWN = 10;

/**
 * Ders Programı · Vekiller alt sekmesi (karar 2026-09-28). Yalnız yönetici.
 *
 * Vekil bir öğretmenin yerine, tarih aralığı boyunca geçer; yetkiyi
 * veritabanı verir ve süre bitince kendiliğinden kapatır. Bu ekran kaydı
 * açar ve iptal eder. "Yeni vekil" düğmesi sayfa başlığındadır.
 */
export function SubstitutesTab({
  organizationId,
  schedule,
  addOpen,
  onAddOpenChange,
}: {
  organizationId: string;
  schedule: ScheduleItem[];
  addOpen: boolean;
  onAddOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const today = getOrbitToday();
  const substitutesQuery = useSubstitutes({ organizationId });
  const membersQuery = useSettingsMembers({ organizationId });
  const [toCancel, setToCancel] = useState<SubstituteAssignment | null>(null);

  const members = membersQuery.data ?? [];
  const names = new Map(members.map(m => [m.membershipId, m.displayName]));
  const nameOf = (id: string) => names.get(id) || "adı okunamadı";
  const teachers = eligibleTeachers(members).filter(m => m.status === "active");

  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: educationKeys.substitutes(organizationId),
    });

  const rows = substitutesQuery.data?.rows ?? [];
  const groups = groupSubstitutes(rows, today);

  return (
    <div className="mt-6">
      {substitutesQuery.data?.truncated ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-[11px] font-semibold text-amber-800">
          Liste üst sınıra ulaştı; en eski vekillikler gösterilmiyor.
        </div>
      ) : null}

      {substitutesQuery.isPending ? (
        <TableSkeleton rows={3} columns={3} />
      ) : substitutesQuery.isError ? (
        <ErrorState
          title="Vekillikler görüntülenemedi"
          message={substitutesQuery.error.message}
          onRetry={() => void substitutesQuery.refetch()}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Henüz vekil ataması yok"
          description="Bir öğretmen izinliyken yerine bakacak öğretmeni buradan atayın."
        />
      ) : (
        <div className="space-y-6">
          <Group
            title="Şu an süren"
            empty="Bugün süren vekillik yok."
            rows={groups.current}
            tone="green"
            nameOf={nameOf}
            onCancel={setToCancel}
          />
          <Group
            title="Yaklaşan"
            empty="Planlanmış vekillik yok."
            rows={groups.upcoming}
            tone="blue"
            nameOf={nameOf}
            onCancel={setToCancel}
          />
          {groups.past.length > 0 ? (
            <Group
              title="Geçmiş"
              rows={groups.past.slice(0, PAST_SHOWN)}
              tone="slate"
              nameOf={nameOf}
            />
          ) : null}
        </div>
      )}

      {addOpen ? (
        <SubstituteFormDialog
          onOpenChange={onAddOpenChange}
          organizationId={organizationId}
          teachers={teachers}
          schedule={schedule}
          onCreated={refresh}
        />
      ) : null}

      {toCancel ? (
        <CancelDialog
          organizationId={organizationId}
          row={toCancel}
          label={`${nameOf(toCancel.substituteMembershipId)}, ${nameOf(
            toCancel.absentMembershipId
          )} yerine (${formatDateRange(toCancel.startsOn, toCancel.endsOn)})`}
          onClose={() => setToCancel(null)}
          onDone={refresh}
        />
      ) : null}
    </div>
  );
}

function Group({
  title,
  empty,
  rows,
  tone,
  nameOf,
  onCancel,
}: {
  title: string;
  empty?: string;
  rows: SubstituteAssignment[];
  tone: "green" | "blue" | "slate";
  nameOf: (id: string) => string;
  /** Verilmezse satır iptal edilemez (geçmiş). */
  onCancel?: (row: SubstituteAssignment) => void;
}) {
  return (
    <section>
      <h3 className="mb-2 text-[12px] font-extrabold text-slate-800">
        {title}
        {rows.length > 0 ? (
          <span className="ml-1.5 font-semibold text-slate-400">
            {rows.length}
          </span>
        ) : null}
      </h3>
      {rows.length === 0 ? (
        <p className="text-[11px] text-slate-400">{empty}</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {rows.map(row => (
            <li
              key={row.id}
              className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-1.5 text-[12px] font-bold text-slate-800">
                  <span className="text-slate-500">
                    {nameOf(row.absentMembershipId)}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                  <span>{nameOf(row.substituteMembershipId)}</span>
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {[formatDateRange(row.startsOn, row.endsOn), row.note]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge tone={tone}>{title}</Badge>
                {onCancel ? (
                  <button
                    type="button"
                    onClick={() => onCancel(row)}
                    className="rounded-md border border-rose-200 px-2 py-1 text-rose-600 hover:bg-rose-50"
                  >
                    <span className="text-[11px] font-semibold">İptal et</span>
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CancelDialog({
  organizationId,
  row,
  label,
  onClose,
  onDone,
}: {
  organizationId: string;
  row: SubstituteAssignment;
  label: string;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await cancelSubstitute(organizationId, row.id);
      await onDone();
      toast.success("Vekillik iptal edildi");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "İptal edilemedi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Vekilliği iptal et</DialogTitle>
          <DialogDescription>
            {label}. İptal edilince vekilin bu sınıflara erişimi hemen kapanır;
            kayıt denetim defterinde kalır.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <div
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-[12px] text-rose-700"
          >
            {error}
          </div>
        ) : null}
        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="h-9 rounded-lg border border-slate-200 px-4 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-rose-600 px-4 text-[12px] font-bold text-white transition hover:bg-rose-700 disabled:opacity-50"
          >
            {loading ? "İptal ediliyor…" : "İptal et"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
