import { describeContent, totalContentRows } from "./organizationContent";

/**
 * Platform denetim kaydının olay kodlarının okunabilir karşılıkları.
 * Bilinmeyen kod ekranda ham haliyle gösterilir — gizlenirse denetim kaydı,
 * kaydı yazan koddan habersiz kalır.
 *
 * Veritabanı ya da Edge Function'ın yazdığı her `platform.*` kodunun burada
 * karşılığı olmalı: `supabase/tests/deployment/platformAuditLabels.test.ts`
 * zorlar (test turu B13, 2026-10-18: "platform.organization_delete_refused"
 * panelde ham kod olarak görünüyordu).
 */
/**
 * Olayın kısa ayrıntısı. Yalnız bilinen ve kişisel veri taşımayan alanlar
 * okunur; bilinmeyen olayda `null` (ayrıntı satırı çizilmez).
 *
 * `platform.retention_purged`: gece temizliğinin tablo başına sildiği
 * sayılar (2026-10-23) — silinen içerik değil, yalnız kaç tane.
 * `platform.organization_purged`: boşaltılan kurumun tablo başına sayıları
 * (2026-10-25); kurum silinince adı başka yerden okunamadığı için ad da.
 */
export function platformActionDetail(
  action: string,
  metadata: Record<string, unknown> | null | undefined
): string | null {
  if (!metadata) return null;
  if (action === "platform.organization_purged") {
    const lines = describeContent(
      metadata.deleted as Record<string, unknown> | undefined
    );
    const name =
      typeof metadata.organization_name === "string"
        ? `${metadata.organization_name}: `
        : "";
    const shown = lines
      .slice(0, 4)
      .map(line => `${line.rows} ${line.label}`)
      .join(", ");
    return `${name}${totalContentRows(lines)} içerik kaydı silindi${
      shown ? ` (${shown}${lines.length > 4 ? ", …" : ""})` : ""
    }`;
  }
  if (action !== "platform.retention_purged") return null;
  const parts: [string, string][] = [
    ["messages", "mesaj"],
    ["message_notifications", "mesaj bildirimi"],
    ["conversations", "sohbet"],
    ["client_error_reports", "ekran hata kaydı"],
    ["email_deliveries", "e-posta kaydı"],
    ["function_calls", "eski çağrı kaydı"],
    ["password_reset_sources", "şifre sıfırlama kaynak kaydı"],
  ];
  const text = parts
    .map(([key, label]) => {
      const value = Number(metadata[key]);
      return Number.isFinite(value) && value > 0 ? `${value} ${label}` : null;
    })
    .filter(Boolean)
    .join(", ");
  return text || null;
}

export const PLATFORM_ACTION_LABELS: Record<string, string> = {
  "platform.organization_created": "Kurum oluşturuldu",
  "platform.organization_deleted": "Kurum silindi",
  "platform.organization_delete_refused":
    "Kurum silme reddedildi (kurumda kayıt var)",
  "platform.operator_added": "Operatör eklendi",
  "platform.operator_suspended": "Operatör askıya alındı",
  "platform.admin_password_reset": "Kurum yöneticisine yeni şifre üretildi",
  "platform.retention_purged": "Saklama süresi (30 gün) dolan kayıtlar silindi",
  "platform.organization_closed": "Kurum kapatıldı",
  "platform.organization_reopened": "Kurum yeniden açıldı",
  "platform.organization_purged": "Kurum boşaltıldı (içerik kalıcı silindi)",
};
