import { useState } from "react";
import { AlertTriangle, Download, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { isDemoMode } from "@/auth/runtime";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function SettingsDataManagementSection({
  onResetDemoData,
}: {
  onResetDemoData: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState("CSV");

  return (
    <>
      <h2 className="font-display text-[18px] font-extrabold text-slate-900">
        Veri Yönetimi
      </h2>
      <p className="mt-1 text-[11px] text-slate-500">
        {isDemoMode
          ? "Arşiv, dışa aktarma ve demo verilerini sıfırlama."
          : "Arşiv ve dışa aktarma."}
      </p>
      <div
        className={`mt-5 grid gap-4 ${isDemoMode ? "md:grid-cols-2" : "max-w-xl"}`}
      >
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600">
              <Download className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-[13px] font-extrabold text-slate-900">
                Verileri dışa aktar
              </h3>
              <p className="mt-0.5 text-[10px] text-slate-500">
                Seçili biçimde bir dışa aktarma hazırlanır.
              </p>
            </div>
          </div>
          <div className="mt-4">
            <Select value={exportFormat} onValueChange={setExportFormat}>
              <SelectTrigger className="h-9 w-full text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CSV">CSV</SelectItem>
                <SelectItem value="Excel">Excel</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <button
            onClick={() =>
              toast.info("Dışa aktarma henüz aktif değil", {
                description:
                  "Gerçek dışa aktarma bir sonraki kalıcı veri fazında etkinleşecek.",
              })
            }
            className="mt-4 text-[11px] font-bold text-blue-600"
          >
            Dışa Aktarmayı Hazırla
          </button>
          <p className="mt-4 flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] leading-5 text-slate-600">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <span>
              <strong>Dışa aktarma özelliği henüz aktif değildir.</strong>{" "}
              Gerçek dışa aktarma bir sonraki kalıcı veri fazında
              etkinleştirilecektir.
            </span>
          </p>
        </section>
        {isDemoMode ? (
          <section className="rounded-2xl border border-rose-100 bg-rose-50/40 p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-rose-50 text-rose-600">
                <RotateCcw className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-[13px] font-extrabold text-slate-900">
                  Demo verilerini sıfırla
                </h3>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  Yoklama ve gün planı verileri başlangıç durumuna döner.
                </p>
              </div>
            </div>
            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <DialogTrigger asChild>
                <button className="mt-4 text-[11px] font-bold text-rose-600">
                  Demo Verilerini Sıfırla
                </button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    Demo verilerini sıfırlamak üzeresiniz
                  </DialogTitle>
                  <DialogDescription>
                    Yoklama ve gün planı üzerinde yaptığınız tüm değişiklikler
                    kaybolacak. Bu işlem geri alınamaz.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <button
                    onClick={() => setConfirmOpen(false)}
                    className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 px-4 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Vazgeç
                  </button>
                  <button
                    onClick={() => {
                      onResetDemoData();
                      setConfirmOpen(false);
                    }}
                    className="inline-flex h-9 items-center justify-center rounded-xl bg-rose-600 px-4 text-[11px] font-bold text-white hover:bg-rose-700"
                  >
                    Evet, Sıfırla
                  </button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </section>
        ) : null}
      </div>
    </>
  );
}
