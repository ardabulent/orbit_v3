import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PrintPortal } from "@/components/credentials/PrintPortal";
import {
  PrintableSlipSheet,
  type SlipEntry,
} from "@/components/credentials/PrintableSlipSheet";
import {
  openAccountsInBulk,
  type BulkAccountsResult,
} from "@/education/bulkAccounts";
import { useOpenAccountForRecord } from "@/education/useOpenAccountForRecord";
import type { Student } from "../types";

/**
 * Hesabı olmayan öğrencilere (ve isteğe bağlı velilerine) toplu giriş hesabı
 * (ana plan 1.8). Seç → aç (10'arlı partiler, ilerleme) → sonuç ve
 * yazdırılabilir fişler. Şifreler yalnız bir kez gösterilir: sonuç ekranı
 * "fişleri aldım" denmeden kapanmaz; listeler ancak o zaman tazelenir.
 *
 * Aday liste pencere açıldığında KOPYALANIR: işlem sürerken canlı güncelleme
 * öğrencileri "hesap var" yapar ve liste değişirdi.
 */
type Phase = "select" | "working" | "done";

const STATUS_TEXT: Record<string, string> = {
  already_has_account: "zaten hesabı vardı",
  not_found: "kayıt bulunamadı",
  failed: "açılamadı",
  skipped: "parti sınırı",
};

export function BulkAccountsDialog({
  students,
  onClose,
}: {
  students: Student[];
  onClose: () => void;
}) {
  const [candidates] = useState(() =>
    students.filter(student => !student.hasAccount)
  );
  const groups = useMemo(
    () =>
      [...new Set(candidates.map(c => c.group ?? ""))].sort((a, b) =>
        a.localeCompare(b, "tr")
      ),
    [candidates]
  );
  const [group, setGroup] = useState<string>("__all__");
  const visible = candidates.filter(
    c => group === "__all__" || (c.group ?? "") === group
  );
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(candidates.map(c => c.id))
  );
  const [includeGuardians, setIncludeGuardians] = useState(true);
  const [phase, setPhase] = useState<Phase>("select");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<BulkAccountsResult | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const { refresh } = useOpenAccountForRecord();

  const chosen = visible.filter(c => selected.has(c.id));
  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allVisibleChosen =
    visible.length > 0 && chosen.length === visible.length;

  const start = async () => {
    setPhase("working");
    setProgress(0);
    const outcome = await openAccountsInBulk(
      chosen.map(c => c.id),
      includeGuardians,
      setProgress
    );
    setResult(outcome);
    setPhase("done");
  };

  const created = result?.items.filter(i => i.status === "created") ?? [];
  const problems =
    result?.items.filter(
      i => i.status !== "created" && i.status !== "already_has_account"
    ) ?? [];
  const already =
    result?.items.filter(i => i.status === "already_has_account") ?? [];
  const unlinked = created.filter(i => !i.linked);
  const classOf = new Map(candidates.map(c => [c.id, c.group]));
  const slips: SlipEntry[] = created
    .filter(i => i.credentials)
    .map(i => ({
      subjectLabel: i.kind === "student" ? "Öğrenci" : "Veli",
      subjectName: i.fullName,
      note:
        i.kind === "guardian"
          ? i.forStudent
            ? `Velisi olduğu öğrenci: ${i.forStudent}`
            : undefined
          : (classOf.get(i.recordId) ?? undefined) || undefined,
      credentials: i.credentials!,
    }));

  const handleOpenChange = (next: boolean) => {
    if (next) return;
    if (phase === "working") return;
    if (phase === "done" && created.length > 0) return; // yalnız "Kapat" ile
    onClose();
  };

  const finish = () => {
    onClose();
    void refresh();
  };

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {phase === "done"
              ? "Toplu hesap açma sonucu"
              : "Toplu giriş hesabı aç"}
          </DialogTitle>
          <DialogDescription>
            {phase === "select"
              ? "Hesabı olmayan öğrenciler listelenir. Her birine giriş numarası ve geçici şifre üretilir; ilk girişte şifrelerini değiştirmeleri istenir."
              : phase === "working"
                ? "Hesaplar açılıyor; pencereyi kapatmayın."
                : "Şifreler bir daha gösterilmeyecek. Fişleri yazdırın ya da not alın."}
          </DialogDescription>
        </DialogHeader>

        {phase === "select" ? (
          candidates.length === 0 ? (
            <p className="text-sm text-slate-600">
              Hesabı olmayan öğrenci yok.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-[12px] font-semibold text-slate-600">
                  Sınıf{" "}
                  <select
                    value={group}
                    onChange={e => setGroup(e.target.value)}
                    className="ml-1 h-8 rounded-md border border-input bg-background px-2 text-[12px]"
                  >
                    <option value="__all__">Tümü ({candidates.length})</option>
                    {groups.map(g => (
                      <option key={g} value={g}>
                        {g || "Sınıfsız"} (
                        {candidates.filter(c => (c.group ?? "") === g).length})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-[12px] font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={allVisibleChosen}
                    onChange={() =>
                      setSelected(prev => {
                        const next = new Set(prev);
                        visible.forEach(c =>
                          allVisibleChosen ? next.delete(c.id) : next.add(c.id)
                        );
                        return next;
                      })
                    }
                  />
                  Görünenlerin hepsi
                </label>
              </div>
              <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
                {visible.map(c => (
                  <li key={c.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-[13px]">
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => toggle(c.id)}
                      />
                      <span className="font-semibold text-slate-800">
                        {c.name}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {[c.code, c.group].filter(Boolean).join(" · ")}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <label className="flex items-center gap-2 text-[13px] text-slate-700">
                <input
                  type="checkbox"
                  checked={includeGuardians}
                  onChange={e => setIncludeGuardians(e.target.checked)}
                />
                Hesabı olmayan velilerine de hesap aç (kardeşlerin velisine tek
                hesap)
              </label>
            </div>
          )
        ) : null}

        {phase === "working" ? (
          <div className="space-y-2" aria-live="polite">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-slate-900 transition-all"
                style={{
                  width: `${chosen.length ? Math.round((progress / chosen.length) * 100) : 0}%`,
                }}
              />
            </div>
            <p className="text-[12px] text-slate-600">
              {progress} / {chosen.length} öğrenci işlendi
            </p>
          </div>
        ) : null}

        {phase === "done" && result ? (
          <div className="space-y-3">
            <p className="text-[13px] text-slate-800">
              <strong>{created.length}</strong> hesap açıldı
              {already.length
                ? `, ${already.length} kaydın zaten hesabı vardı`
                : ""}
              {problems.length ? `, ${problems.length} kalemde sorun var` : ""}.
            </p>
            {result.stoppedWith ? (
              <p
                role="alert"
                className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-[12px] text-rose-900"
              >
                İşlem {result.processedStudents}. öğrenciden sonra durdu:{" "}
                {result.stoppedWith} Kalan öğrenciler için pencereyi kapatıp
                yeniden açabilirsiniz; açılanların hesabı var.
              </p>
            ) : null}
            {unlinked.length ? (
              <p
                role="alert"
                className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-[12px] text-amber-900"
              >
                {unlinked.length} hesap açıldı ama kayda bağlanamadı; bu
                hesaplar boşta duruyor ve satırdaki "Giriş hesabı ata"
                listesinden atanabilir.
              </p>
            ) : null}
            {problems.length ? (
              <ul className="text-[12px] text-slate-600">
                {problems.map(p => (
                  <li key={`${p.kind}-${p.recordId}`}>
                    {p.fullName || "Bilinmeyen kayıt"} —{" "}
                    {STATUS_TEXT[p.status] ?? p.status}
                  </li>
                ))}
              </ul>
            ) : null}
            {created.length ? (
              <>
                <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
                  <table className="w-full text-[12px]">
                    <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Kişi</th>
                        <th className="px-3 py-2">Giriş no</th>
                        <th className="px-3 py-2">Geçici şifre</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {created.map(i => (
                        <tr key={`${i.kind}-${i.recordId}`}>
                          <td className="px-3 py-1.5">
                            {i.fullName}
                            <span className="ml-1 text-[10px] text-slate-500">
                              {i.kind === "guardian"
                                ? `veli${i.forStudent ? ` · ${i.forStudent}` : ""}`
                                : "öğrenci"}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 font-mono">
                            {i.credentials?.loginNumber}
                          </td>
                          <td className="px-3 py-1.5 font-mono">
                            {i.credentials?.temporaryPassword}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <PrintPortal>
                  <PrintableSlipSheet entries={slips} />
                </PrintPortal>
                <label className="flex cursor-pointer items-start gap-2.5 text-[12px]">
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={e => setAcknowledged(e.target.checked)}
                    className="mt-0.5 h-4 w-4"
                  />
                  <span>Giriş fişlerini yazdırdım ya da not aldım.</span>
                </label>
              </>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          {phase === "select" ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 items-center rounded-lg px-4 text-sm font-semibold text-muted-foreground hover:bg-muted"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={() => void start()}
                disabled={chosen.length === 0}
                className="inline-flex h-9 items-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {chosen.length} öğrenciye hesap aç
              </button>
            </>
          ) : null}
          {phase === "done" ? (
            <>
              {slips.length ? (
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex h-9 items-center rounded-lg border border-border px-4 text-sm font-semibold hover:bg-muted"
                >
                  Fişleri yazdır ({slips.length})
                </button>
              ) : null}
              <button
                type="button"
                onClick={finish}
                disabled={created.length > 0 && !acknowledged}
                className="inline-flex h-9 items-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
              >
                Kapat
              </button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
