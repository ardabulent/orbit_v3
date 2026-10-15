import { AlertTriangle } from "lucide-react";
import { useAuth } from "@/auth/useAuth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { SettingsFormField } from "./SettingsFormField";

const DATE_FORMATS = ["DD.MM.YYYY", "YYYY-MM-DD", "DD MMM YYYY"];

export function SettingsSystemSection() {
  const { identity } = useAuth();
  const branch = identity?.membership?.branchName || "—";

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-[18px] font-extrabold text-slate-900">
          Sistem Tercihleri
        </h2>
        <button
          type="button"
          disabled
          className="inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-slate-900 px-4 text-[11px] font-bold text-white shadow-[0_8px_16px_rgba(15,23,42,.12)] transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          Değişiklikleri Kaydet
        </button>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {/* Şube üyelikten geliyor ve panelden yazılmıyor; salt okunur. */}
        <SettingsFormField label="Varsayılan şube" value={branch} disabled />
        <div>
          <Label className="text-[10px] font-extrabold uppercase tracking-[.06em] text-slate-400">
            Tarih biçimi
          </Label>
          <Select value={DATE_FORMATS[0]} disabled>
            <SelectTrigger disabled className="mt-1.5 h-9 w-full text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_FORMATS.map(format => (
                <SelectItem key={format} value={format}>
                  {format}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="mt-4 flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] leading-5 text-slate-600">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
        <span>
          <strong>Bu bölümdeki tercihler salt okunurdur.</strong> Şube bilgisi
          oturum kimliğinizden okunur; sistem tercihleri buradan değiştirilemez.
        </span>
      </p>
    </>
  );
}
