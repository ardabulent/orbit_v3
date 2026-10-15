import { AlertTriangle } from "lucide-react";
import { Switch } from "@/components/ui/switch";

type NotificationKey =
  "attendance" | "homeworkDue" | "parentContact" | "weeklyDigest";

const ROWS: {
  key: NotificationKey;
  title: string;
  description: string;
  defaultChecked: boolean;
}[] = [
  {
    key: "attendance",
    title: "Devamsızlık bildirimleri",
    description: "Yoklamada işaretlenmeyen öğrenciler için anlık bildirim.",
    defaultChecked: true,
  },
  {
    key: "homeworkDue",
    title: "Ödev teslim hatırlatmaları",
    description: "Teslim tarihi yaklaşan ödevler için hatırlatma.",
    defaultChecked: true,
  },
  {
    key: "parentContact",
    title: "Veli iletişim bildirimleri",
    description: "Veliyle yeni bir görüşme/notu paylaşıldığında bildirim.",
    defaultChecked: true,
  },
  {
    key: "weeklyDigest",
    title: "Haftalık özet e-postası",
    description: "Her Pazartesi devam ve akademik özet e-postası.",
    defaultChecked: false,
  },
];

export function SettingsNotificationsSection() {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-[18px] font-extrabold text-slate-900">
          Bildirim Tercihleri
        </h2>
        <button
          type="button"
          disabled
          className="inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-slate-900 px-4 text-[11px] font-bold text-white shadow-[0_8px_16px_rgba(15,23,42,.12)] transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          Değişiklikleri Kaydet
        </button>
      </div>
      <div className="mt-5 space-y-2.5">
        {ROWS.map(row => (
          <div
            key={row.key}
            className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 p-3"
          >
            <div className="min-w-0">
              <p className="text-[12px] font-extrabold text-slate-800">
                {row.title}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-500">
                {row.description}
              </p>
            </div>
            <Switch disabled checked={row.defaultChecked} />
          </div>
        ))}
      </div>
      <p className="mt-4 flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] leading-5 text-slate-600">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
        <span>
          <strong>Bu bölümdeki tercihler henüz işlemiyor.</strong> Bildirim
          gönderimi ve haftalık özet e-postası özellikleri, e-posta sağlayıcısı
          entegrasyonu tamamlandığında devreye alınacaktır.
        </span>
      </p>
    </>
  );
}
