import type { SupabaseClient } from "./deps.ts";

/**
 * Hız sınırı ve idempotency kapısı — tek kaynak (v1.2-17).
 *
 * **Neyi çözdüğü.** Beş fonksiyonun beşi de kimlik doğrulanmış bir yönetici
 * veya operatör tarafından çağrılıyor, dolayısıyla asıl tehdit anonim sel
 * değil: **yanıt kayboluyor, kullanıcı düğmeye tekrar basıyor.** Sonucu
 * `create-member`'da aynı kişi için iki hesap (üye silme ekranı v1.4-07'ye
 * kadar yok), `reset-*`'te ise az önce kâğıda yazılmış şifrenin sessizce
 * geçersizleşmesi.
 *
 * **Şifre tekrarda dönmez.** Saklanan özet giriş numarasını ve "bu iş yapıldı"
 * olgusunu taşır; geçici şifreyi **taşımaz** ve taşıyamaz — saklamak, şifrenin
 * hiçbir yere yazılmaması kararını bozmak olurdu. Tekrarlanan istek bu yüzden
 * şifreyi geri veremez, yalnızca yeniden üretilmesini engeller.
 *
 * **Kapı kapanamıyorsa istek durur.** `begin` çağrısı başarısız olursa
 * fonksiyon devam etmez: koruma çalışmıyorken korunan işi yapmak, korumayı hiç
 * yazmamaktan farksızdır (**K-04**).
 */

export type GuardDecision =
  | { kind: "proceed"; callId: number }
  | { kind: "replay"; outcome: Record<string, unknown> | null }
  | { kind: "in_progress" }
  | { kind: "rate_limited"; limit: number }
  /** Çağıranın şifresi kilitli (2026-10-03, v1.5-20): önce şifre değişir. */
  | { kind: "password_locked" }
  | { kind: "unavailable" };

/** Anahtarın kabul edilebilir en uzun hâli. */
const MAX_KEY_LENGTH = 200;

/**
 * İstekten idempotency anahtarını okur.
 *
 * Anahtar **isteğe bağlı**: göndermeyen bir çağrı yine hız sınırına tabidir,
 * yalnızca tekrar korumasından yararlanamaz. Böylece sözleşme genişlerken eski
 * istemciler kırılmıyor.
 *
 * Biçim doğrulanıyor: uzunluk sınırı ve dar karakter kümesi. Anahtar bir
 * benzersizlik belirtecidir, serbest metin değil; sınırsız kabul etmek tabloya
 * çağıranın istediği veriyi yazdırmak olurdu.
 */
export function idempotencyKeyFrom(request: Request): string | null {
  const raw = request.headers.get("idempotency-key");

  if (!raw) {
    return null;
  }

  const trimmed = raw.trim();

  if (trimmed.length === 0 || trimmed.length > MAX_KEY_LENGTH) {
    return null;
  }

  return /^[A-Za-z0-9_:.-]+$/.test(trimmed) ? trimmed : null;
}

/**
 * Çağrıyı açar. Dönen karar `proceed` değilse fonksiyon **işi yapmamalıdır**.
 */
export async function beginFunctionCall(
  adminClient: SupabaseClient,
  functionSlug: string,
  callerUserId: string,
  idempotencyKey: string | null,
  logPrefix: string
): Promise<GuardDecision> {
  const { data, error } = await adminClient.rpc(
    "internal_begin_function_call",
    {
      function_slug: functionSlug,
      caller_user_id: callerUserId,
      idempotency_key: idempotencyKey,
    }
  );

  if (error || !data || typeof data !== "object") {
    console.error(`${logPrefix} request guard unavailable`);
    return { kind: "unavailable" };
  }

  const karar = data as Record<string, unknown>;

  if (karar.allowed === true && typeof karar.call_id === "number") {
    return { kind: "proceed", callId: karar.call_id };
  }

  if (karar.reason === "password_locked") {
    return { kind: "password_locked" };
  }

  if (karar.reason === "replay") {
    return {
      kind: "replay",
      outcome: (karar.outcome as Record<string, unknown> | null) ?? null,
    };
  }

  if (karar.reason === "rate_limited") {
    return {
      kind: "rate_limited",
      limit: typeof karar.limit === "number" ? karar.limit : 0,
    };
  }

  if (karar.reason === "in_progress") {
    return { kind: "in_progress" };
  }

  // Tanınmayan bir cevap izin sayılmaz.
  console.error(`${logPrefix} request guard returned an unknown decision`);
  return { kind: "unavailable" };
}

/**
 * Çağrıyı tamamlanmış işaretler.
 *
 * Başarısız olursa iş **geri alınmaz** — iş zaten yapıldı ve "yapılmadı"
 * demek yanlış olurdu. Bedeli, aynı anahtarla gelen bir tekrarın
 * `in_progress` görüp reddedilmesi: güvenli yön bu.
 */
export async function finishFunctionCall(
  adminClient: SupabaseClient,
  callId: number,
  outcome: Record<string, unknown>,
  logPrefix: string
): Promise<void> {
  const { error } = await adminClient.rpc("internal_finish_function_call", {
    call_id: callId,
    outcome,
  });

  if (error) {
    console.error(`${logPrefix} request guard could not be closed`);
  }
}
