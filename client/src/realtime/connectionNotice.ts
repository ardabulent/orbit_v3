import type { OrganizationChannelStatus } from "./useOrganizationChannel";

/**
 * Bağlantı uyarısında ne yazacağı (2026-10-12, ROADMAP v1.5-12).
 *
 * Önceden kopma kullanıcıya hiç görünmüyordu: internet giderse kayıt
 * düğmeleri hata tostu veriyor, canlı kanal düşerse ekran sessizce
 * bayatlıyordu. Bağlantı geri gelince sorgular zaten kendiliğinden
 * tazeleniyor (`useOrganizationChannel`, K-22); eksik olan bunun
 * söylenmesiydi.
 *
 * Kısa kopmalar uyarı üretmez: çağıran, durum `GRACE_MS` boyunca sürmeden
 * göstermez — sekme değişiminde ya da ağ geçişinde yanıp sönmesin.
 */
export const CONNECTION_NOTICE_GRACE_MS = 5000;

export type ConnectionNotice = {
  kind: "offline" | "live-paused";
  title: string;
  detail: string;
};

export function connectionNotice(input: {
  online: boolean;
  channelStatus: OrganizationChannelStatus;
}): ConnectionNotice | null {
  if (!input.online) {
    return {
      kind: "offline",
      title: "İnternet bağlantısı yok.",
      detail:
        "Bu arada yaptığınız değişiklikler kaydedilemez. Bağlantı gelince ekran kendiliğinden yenilenir.",
    };
  }
  // Kanal hiç açılmadıysa (IDLE, CONNECTING) ya da açıksa uyarı yok: ilk
  // yükleme ekranın kendi iskeletiyle gösteriliyor.
  if (
    input.channelStatus === "TIMED_OUT" ||
    input.channelStatus === "CLOSED" ||
    input.channelStatus === "CHANNEL_ERROR"
  ) {
    return {
      kind: "live-paused",
      title: "Canlı güncellemeler durdu.",
      detail:
        "Başkalarının yaptığı değişiklikler şu an ekrana gelmiyor. Yeniden bağlanılıyor; bağlanınca ekran yenilenir.",
    };
  }
  return null;
}
