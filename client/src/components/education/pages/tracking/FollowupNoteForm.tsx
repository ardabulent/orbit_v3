import { useState } from "react";
import {
  NOTE_BODY_MAX,
  NOTE_KIND_LABELS,
  NOTE_KINDS,
  validateNoteInput,
  type FollowupNoteInput,
  type NoteKind,
} from "@/education/followupNoteService";
import { getOrbitToday } from "@/education/trDate";

const fieldClass =
  "h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-semibold text-slate-700";

/**
 * Not ekleme ve düzeltme formu (4.10c). Doğrulama ekranda da yapılır ama
 * kural veritabanında (tarih tetikleyicide, uzunluk check'te).
 */
export function FollowupNoteForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: FollowupNoteInput;
  submitLabel: string;
  onSubmit: (input: FollowupNoteInput) => Promise<void>;
  onCancel?: () => void;
}) {
  const today = getOrbitToday();
  const [kind, setKind] = useState<NoteKind>(initial?.kind ?? "observation");
  const [occurredOn, setOccurredOn] = useState(initial?.occurredOn ?? today);
  const [body, setBody] = useState(initial?.body ?? "");
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const input = { kind, occurredOn, body };
  const problem = validateNoteInput(input, today);

  const submit = async () => {
    setTouched(true);
    if (problem) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit(input);
      if (!initial) {
        setBody("");
        setTouched(false);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <label className="grid gap-1 text-[11px] font-bold text-slate-500">
          Tür
          <select
            value={kind}
            onChange={e => setKind(e.target.value as NoteKind)}
            className={fieldClass}
          >
            {NOTE_KINDS.map(value => (
              <option key={value} value={value}>
                {NOTE_KIND_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-[11px] font-bold text-slate-500">
          Tarih
          <input
            type="date"
            value={occurredOn}
            max={today}
            onChange={e => setOccurredOn(e.target.value)}
            className={fieldClass}
          />
        </label>
      </div>
      <label className="grid gap-1 text-[11px] font-bold text-slate-500">
        Not
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          maxLength={NOTE_BODY_MAX}
          rows={3}
          placeholder="Ne gözlendi, ne konuşuldu, ne kararlaştırıldı?"
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[12px] text-slate-700"
        />
      </label>
      <p className="text-[11px] text-amber-700">
        Sağlık, din, siyasi görüş gibi özel nitelikli bilgi yazmayın. Not
        öğrenci ve veliye görünmez; kurum yöneticileri ve öğrenciyi okutan
        öğretmenler görür.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={saving}
          className="h-9 rounded-lg bg-slate-900 px-3 text-[12px] font-bold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {saving ? "Kaydediliyor…" : submitLabel}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-lg border border-slate-200 px-3 text-[12px] font-bold text-slate-600 hover:bg-slate-50"
          >
            Vazgeç
          </button>
        ) : null}
        <span className="ml-auto text-[11px] text-slate-400">
          {body.trim().length} / {NOTE_BODY_MAX}
        </span>
      </div>
      {touched && problem ? (
        <p role="alert" className="text-[11px] font-bold text-rose-600">
          {problem}
        </p>
      ) : error ? (
        <p role="alert" className="text-[11px] font-bold text-rose-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
