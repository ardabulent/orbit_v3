/**
 * Bir hatanın kendi metni kullanıcıya gösterilebilir mi (2026-10-07,
 * ROADMAP §4.23 B6).
 *
 * Hata çevirmenleri bilmedikleri hatanın metnini olduğu gibi gösteriyordu.
 * Bunun bir amacı vardı: veritabanı kendi kuralını Türkçe bir uyarıyla
 * bildiriyor (74 farklı `raise exception`, ör. "Bağlama kodunun süresi
 * dolmuş."). Ama aynı yoldan Postgres'in ve tarayıcının İngilizce teknik
 * metinleri de geçiyordu: internet kesilince "TypeError: Failed to fetch",
 * sayı taşınca "numeric field overflow".
 *
 * Kural:
 *   - ağ hatası          → sabit Türkçe "sunucuya ulaşılamadı" metni
 *   - Türkçe harf içeren  → veritabanının kendi uyarısı, aynen gösterilir
 *   - geri kalanı         → `null`; çağıran kendi genel Türkçe mesajına düşer
 *
 * Türkçe harf ölçütü bilinçli olarak kaba: Türkçe harfi olmayan tek uyarı
 * "Oturum yok" ve o da genel mesaja düşer — İngilizce bir metnin geçmesinden
 * iyidir.
 */
export const NETWORK_ERROR_TEXT =
  "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.";

const NETWORK_PATTERN =
  /failed to fetch|networkerror|load failed|fetcherror|network request failed|network unreachable|connection timeout|timed out|econnrefused|etimedout|err_network|err_internet_disconnected/i;

const TURKISH_LETTER = /[çğıöşüÇĞİÖŞÜ]/;

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message ?? "";
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : "";
  }
  return typeof error === "string" ? error : "";
}

export function isNetworkError(error: unknown): boolean {
  return NETWORK_PATTERN.test(messageOf(error));
}

/** Gösterilecek metin ya da `null` (çağıranın genel mesajı kullanılır). */
export function userFacingErrorText(error: unknown): string | null {
  const message = messageOf(error).trim();
  if (!message) return null;
  if (NETWORK_PATTERN.test(message)) return NETWORK_ERROR_TEXT;
  if (TURKISH_LETTER.test(message)) return message;
  return null;
}
