import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Target } from "lucide-react";
import { useAuth } from "@/auth/useAuth";
import { educationKeys } from "@/education/queries/educationKeys";
import {
  saveStudentTargets,
  TARGET_NET_MAX,
  type StudentTargetChange,
} from "@/education/studentTargetService";
import type { TrackingStudentRow } from "@/education/tracking/trackingTypes";

const TOTAL = "__toplam__";

const toInput = (value: number | undefined) =>
  value === undefined ? "" : String(value).replace(".", ",");

/**
 * Hedef net düzenleyicisi (4.10b): toplam hedef ve öğrencinin sonucu olan
 * her ders. Boş bırakılan kutu hedefi kaldırır. Yazma yetkisi RLS'te
 * (yönetici ve okutan öğretmen); bu bileşen yalnız kullanıcı deneyimidir.
 */
export function StudentTargetsEditor({ row }: { row: TrackingStudentRow }) {
  const { identity } = useAuth();
  const organizationId = identity?.membership?.organizationId ?? "";
  const queryClient = useQueryClient();

  const fields = [
    { key: TOTAL, label: "Toplam net" },
    ...row.subjectNets.map(s => ({ key: s.subjectId, label: s.subjectName })),
  ];
  const initial = Object.fromEntries(
    fields.map(field => [
      field.key,
      toInput(
        row.targets.find(t =>
          field.key === TOTAL ? !t.subjectId : t.subjectId === field.key
        )?.targetNet
      ),
    ])
  );

  const [values, setValues] = useState<Record<string, string>>(initial);
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "saving" }
    | { kind: "saved" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const changes: StudentTargetChange[] = [];
  let problem: string | null = null;
  for (const field of fields) {
    const text = (values[field.key] ?? "").trim();
    if (text === (initial[field.key] ?? "")) continue;
    const subjectId = field.key === TOTAL ? undefined : field.key;
    if (text === "") {
      changes.push({ subjectId, targetNet: null });
      continue;
    }
    const value = Number(text.replace(",", "."));
    if (!Number.isFinite(value) || value < 0 || value > TARGET_NET_MAX) {
      problem = `${field.label}: hedef 0 ile ${TARGET_NET_MAX} net arasında olmalı.`;
      continue;
    }
    changes.push({ subjectId, targetNet: value });
  }

  const save = async () => {
    setState({ kind: "saving" });
    try {
      await saveStudentTargets(organizationId, row.studentId, changes);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["education", "trackingMetrics"],
        }),
        queryClient.invalidateQueries({
          queryKey: educationKeys.studentTargets(organizationId, row.studentId),
        }),
      ]);
      setState({ kind: "saved" });
    } catch (error) {
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "Kaydedilemedi.",
      });
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-slate-100 p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
        <Target className="h-3.5 w-3.5" aria-hidden /> Hedef net
      </p>
      <div className="mt-2 flex flex-wrap items-end gap-3">
        {fields.map(field => (
          <label
            key={field.key}
            className="grid gap-1 text-[11px] font-bold text-slate-500"
          >
            {field.label}
            <input
              inputMode="decimal"
              value={values[field.key] ?? ""}
              onChange={e =>
                setValues(current => ({
                  ...current,
                  [field.key]: e.target.value,
                }))
              }
              placeholder="—"
              className="h-9 w-24 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-semibold text-slate-700"
            />
          </label>
        ))}
        <button
          type="button"
          onClick={() => void save()}
          disabled={
            changes.length === 0 || problem !== null || state.kind === "saving"
          }
          className="h-9 rounded-lg bg-slate-900 px-3 text-[12px] font-bold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {state.kind === "saving" ? "Kaydediliyor…" : "Hedefleri kaydet"}
        </button>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        Boş kutu hedefi kaldırır. Öğrenci ve velisi hedefi kendi ekranında
        görür, değiştiremez. Ders hedefi için öğrencinin o derste sonucu olmalı.
      </p>
      {problem ? (
        <p role="alert" className="mt-1 text-[11px] font-bold text-rose-600">
          {problem}
        </p>
      ) : state.kind === "saved" ? (
        <p
          role="status"
          className="mt-1 text-[11px] font-bold text-emerald-700"
        >
          Hedefler kaydedildi.
        </p>
      ) : state.kind === "error" ? (
        <p role="alert" className="mt-1 text-[11px] font-bold text-rose-600">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
