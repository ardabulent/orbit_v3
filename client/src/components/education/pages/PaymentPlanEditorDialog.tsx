import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  educationKeys,
  usePlanInstallments,
} from "@/education/educationQueries";
import {
  formatCurrency,
  savePaymentPlan,
  type Installment,
} from "@/education/paymentService";
import {
  buildSchedule,
  sumAmounts,
  type ScheduleRow,
} from "@/education/paymentSchedule";
import { addDaysIso, getOrbitToday } from "@/education/trDate";
import { CardSkeleton } from "../shared";
import { InstallmentScheduleTable } from "./InstallmentScheduleTable";

export type EditablePlan = {
  id: string;
  studentId: string;
  name: string;
  totalAmount: number;
};

const FIELD =
  "h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[12px] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const LABEL = "grid gap-1 text-[11px] font-bold text-slate-600";

/**
 * Ödeme planı TEK ekran (2026-09-30). Plan, peşinat ve taksitler aynı
 * pencerede kurulur ve tek düğmeyle `save_payment_plan` ile birlikte
 * kaydedilir. Var olan planda ödenmiş taksitler kilitli görünür; yalnız
 * ödenmemiş kısım yeniden düzenlenir.
 */
export function PaymentPlanEditorDialog({
  open,
  onOpenChange,
  organizationId,
  students,
  plan,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  students: { id: string; name: string }[];
  plan?: EditablePlan | null;
  onDone?: () => void;
}) {
  const installmentsQuery = usePlanInstallments({
    organizationId,
    planId: plan?.id,
    enabled: open && Boolean(plan?.id),
  });
  const loading = Boolean(plan?.id) && installmentsQuery.isLoading;
  // Her açılış yeni bir form (2026-10-01, tarayıcıda yakalandı): önceki
  // planın peşinatı ve tablosu yeni "Yeni plan" penceresine taşınıyordu.
  // Açılış sayacı forma anahtar olur; React'in önerdiği "önceki değeri
  // render sırasında karşılaştır" deseni (effect değil).
  const [openCount, setOpenCount] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setOpenCount(count => count + 1);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>
            {plan ? "Ödeme planını düzenle" : "Yeni ödeme planı"}
          </DialogTitle>
          <DialogDescription>
            Paket, peşinat ve taksitleri burada kurun; tek düğmeyle birlikte
            kaydedilir.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <CardSkeleton />
        ) : installmentsQuery.error ? (
          <p role="alert" className="text-[12px] font-bold text-rose-600">
            Taksitler alınamadı: {installmentsQuery.error.message}
          </p>
        ) : (
          <PlanEditorForm
            key={`${plan?.id ?? "yeni"}-${openCount}`}
            organizationId={organizationId}
            students={students}
            plan={plan ?? null}
            existing={installmentsQuery.data ?? []}
            onSaved={() => {
              onOpenChange(false);
              onDone?.();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PlanEditorForm({
  organizationId,
  students,
  plan,
  existing,
  onSaved,
}: {
  organizationId: string;
  students: { id: string; name: string }[];
  plan: EditablePlan | null;
  existing: Installment[];
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const today = getOrbitToday();
  const paid = existing
    .filter(i => i.paidAt)
    .sort((a, b) => a.sequenceNo - b.sequenceNo);
  const paidTotal = sumAmounts(paid);

  const [studentId, setStudentId] = useState(plan?.studentId ?? "");
  const [name, setName] = useState(plan?.name ?? "");
  const [total, setTotal] = useState<string>(
    plan ? String(plan.totalAmount) : ""
  );
  const [downPayment, setDownPayment] = useState("");
  const [downPaymentDate, setDownPaymentDate] = useState(today);
  const [count, setCount] = useState("8");
  const [firstDueDate, setFirstDueDate] = useState(addDaysIso(today, 30));
  const [rows, setRows] = useState<ScheduleRow[]>(() =>
    existing
      .filter(i => !i.paidAt)
      .sort((a, b) => a.sequenceNo - b.sequenceNo)
      .map(i => ({ dueDate: i.dueDate, amount: i.amount }))
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const totalNumber = Number(total);
  const scheduled = sumAmounts([...paid, ...rows]);
  const difference = Math.round((totalNumber - scheduled) * 100) / 100;
  const rowsValid = rows.every(r => r.dueDate && r.amount > 0);
  const canSave =
    Boolean(studentId) &&
    name.trim().length > 0 &&
    total !== "" &&
    totalNumber >= 0 &&
    difference === 0 &&
    rowsValid &&
    !saving;

  const generate = () => {
    setError(null);
    const built = buildSchedule({
      total: totalNumber - paidTotal,
      downPayment: Number(downPayment) || 0,
      downPaymentDate,
      installmentCount: Number(count),
      firstDueDate,
    });
    if (built.length === 0) {
      setError(
        "Tablo kurulamadı: toplam tutarı, taksit sayısını ve ilk taksit gününü kontrol edin (peşinat toplamdan büyük olamaz)."
      );
      return;
    }
    setRows(built);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await savePaymentPlan({
        organizationId,
        planId: plan?.id ?? null,
        studentId: plan ? null : studentId,
        name,
        totalAmount: totalNumber,
        installments: rows.map(r => ({
          dueDate: r.dueDate,
          amount: r.amount,
        })),
      });
      toast.success(
        plan ? "Ödeme planı güncellendi" : "Ödeme planı kaydedildi",
        {
          description: `${name.trim()} · ${paid.length + rows.length} taksit`,
        }
      );
      onSaved();
      // Pencere hemen kapanır; listeler arkada yenilenir (önceden yenileme
      // bitene kadar birkaç saniye açık kalıyordu).
      void Promise.all(
        [
          educationKeys.payments(organizationId),
          educationKeys.paymentOverview(organizationId),
          educationKeys.students(organizationId),
          educationKeys.planInstallments(organizationId),
        ].map(queryKey => queryClient.invalidateQueries({ queryKey }))
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Plan kaydedilemedi."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={LABEL}>
          Öğrenci
          <select
            value={studentId}
            onChange={e => setStudentId(e.target.value)}
            disabled={Boolean(plan) || saving}
            className={FIELD}
          >
            <option value="">Öğrenci seçin…</option>
            {students.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className={LABEL}>
          Paket adı
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="ör. YKS Paketi 2026-27"
            disabled={saving}
            className={FIELD}
          />
        </label>
        <label className={LABEL}>
          Toplam tutar (₺)
          <input
            type="number"
            min="0"
            step="0.01"
            value={total}
            onChange={e => setTotal(e.target.value)}
            disabled={saving}
            className={FIELD}
          />
        </label>
      </div>

      <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
        <p className="text-[12px] font-extrabold text-slate-800">
          {paid.length > 0
            ? `Kalan ${formatCurrency(totalNumber - paidTotal)} tutarı taksitlere böl`
            : "Taksitlere böl"}
        </p>
        <div className="mt-2 grid gap-3 sm:grid-cols-4">
          <label className={LABEL}>
            Peşinat (₺)
            <input
              type="number"
              min="0"
              step="0.01"
              value={downPayment}
              onChange={e => setDownPayment(e.target.value)}
              placeholder="0"
              disabled={saving}
              className={FIELD}
            />
          </label>
          <label className={LABEL}>
            Peşinat günü
            <input
              type="date"
              value={downPaymentDate}
              onChange={e => setDownPaymentDate(e.target.value)}
              disabled={saving || !(Number(downPayment) > 0)}
              className={FIELD}
            />
          </label>
          <label className={LABEL}>
            Taksit sayısı
            <input
              type="number"
              min="1"
              max="60"
              value={count}
              onChange={e => setCount(e.target.value)}
              disabled={saving}
              className={FIELD}
            />
          </label>
          <label className={LABEL}>
            İlk taksit günü
            <input
              type="date"
              value={firstDueDate}
              onChange={e => setFirstDueDate(e.target.value)}
              disabled={saving}
              className={FIELD}
            />
          </label>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={saving || !(totalNumber > 0)}
          className="mt-3 h-9 rounded-lg bg-slate-900 px-4 text-white hover:bg-slate-800 disabled:opacity-40"
        >
          <span className="text-[12px] font-bold">
            {rows.length > 0
              ? "Tabloyu yeniden oluştur"
              : "Taksit tablosunu oluştur"}
          </span>
        </button>
        <p className="mt-1.5 text-[10px] text-slate-500">
          Taksitler aylık ve tam lira; kuruş farkı son taksite eklenir. Tabloyu
          aşağıda satır satır düzeltebilirsiniz.
        </p>
      </section>

      {paid.length > 0 || rows.length > 0 ? (
        <InstallmentScheduleTable
          paid={paid}
          rows={rows}
          onChange={setRows}
          disabled={saving}
        />
      ) : null}

      <div
        className={`rounded-lg px-3 py-2 text-[12px] font-bold ${
          total === ""
            ? "bg-slate-50 text-slate-500"
            : difference === 0
              ? "bg-emerald-50 text-emerald-800"
              : "bg-amber-50 text-amber-800"
        }`}
      >
        Taksitler toplamı {formatCurrency(scheduled)} · Paket{" "}
        {formatCurrency(Number.isFinite(totalNumber) ? totalNumber : 0)}
        {total !== "" && difference !== 0
          ? ` · ${difference > 0 ? "eksik" : "fazla"} ${formatCurrency(Math.abs(difference))}`
          : ""}
        {!rowsValid ? " · her satırın tarihi ve tutarı olmalı" : ""}
      </div>

      {error ? (
        <p role="alert" className="text-[12px] font-bold text-rose-600">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void save()}
          disabled={!canSave}
          className="h-10 rounded-lg bg-blue-600 px-5 text-white hover:bg-blue-700 disabled:opacity-40"
        >
          <span className="text-[13px] font-bold">
            {saving ? "Kaydediliyor…" : "Planı kaydet"}
          </span>
        </button>
      </div>
    </div>
  );
}
