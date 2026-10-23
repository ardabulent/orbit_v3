import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CredentialsPanel } from "@/components/credentials/CredentialsPanel";
import type {
  AccountRecordKind,
  OpenAccountResult,
} from "@/education/accountForRecord";
import { useOpenAccountForRecord } from "@/education/useOpenAccountForRecord";

/**
 * Var olan kayda hesap açma penceresi (ana plan 1.7): onay → açılıyor →
 * giriş fişi (ya da hata). Fiş gösterilirken pencere yalnız panelin
 * "Tamam"ıyla kapanır; şifre bir daha gösterilmez. Listeler ancak o zaman
 * tazelenir — tazeleme satırı "hesap var" hâline geçirip bu pencereyi
 * barındıran bileşeni kaldırır (`useOpenAccountForRecord`).
 */
export function OpenAccountDialog({
  kind,
  recordId,
  recordName,
  branchId,
  onClose,
}: {
  kind: AccountRecordKind;
  recordId: string;
  recordName: string;
  branchId: string | null;
  onClose: () => void;
}) {
  const { open, refresh } = useOpenAccountForRecord();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OpenAccountResult | null>(null);
  const label = kind === "student" ? "Öğrenci" : "Veli";

  const finish = () => {
    onClose();
    void refresh();
  };

  const handleOpenChange = (next: boolean) => {
    if (next || working || result) return;
    onClose();
  };

  const submit = async () => {
    setWorking(true);
    setError(null);
    try {
      setResult(await open({ kind, recordId, fullName: recordName, branchId }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hesap açılamadı.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {result ? "Giriş hesabı açıldı" : `${label} için giriş hesabı aç`}
          </DialogTitle>
          <DialogDescription>
            {result
              ? result.linked
                ? `${recordName} artık bu bilgilerle ORBIT'e girebilir.`
                : "Hesap açıldı ama kayda bağlanamadı."
              : `${recordName} için yeni bir giriş numarası ve geçici şifre üretilir; ilk girişte şifresini değiştirmesi istenir.`}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3">
            {!result.linked && result.message ? (
              <p
                role="alert"
                className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-[12px] leading-5 text-amber-900"
              >
                {result.message}
              </p>
            ) : null}
            <CredentialsPanel
              subjectLabel={label}
              subjectName={recordName}
              credentials={result.credentials}
              onDone={finish}
            />
          </div>
        ) : (
          <>
            {error ? (
              <p
                role="alert"
                className="text-[12px] font-semibold text-rose-600"
              >
                {error}
              </p>
            ) : null}
            <DialogFooter>
              <button
                type="button"
                onClick={onClose}
                disabled={working}
                className="inline-flex h-9 items-center rounded-lg px-4 text-sm font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={working}
                className="inline-flex h-9 items-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {working ? "Açılıyor…" : error ? "Yeniden dene" : "Hesabı aç"}
              </button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
