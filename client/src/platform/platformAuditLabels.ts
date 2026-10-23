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
export const PLATFORM_ACTION_LABELS: Record<string, string> = {
  "platform.organization_created": "Kurum oluşturuldu",
  "platform.organization_deleted": "Kurum silindi",
  "platform.organization_delete_refused":
    "Kurum silme reddedildi (kurumda kayıt var)",
  "platform.operator_added": "Operatör eklendi",
  "platform.operator_suspended": "Operatör askıya alındı",
  "platform.admin_password_reset": "Kurum yöneticisine yeni şifre üretildi",
};
