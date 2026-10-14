import { supabase } from "@/lib/supabaseClient";
import {
  isNetworkError,
  NETWORK_ERROR_TEXT,
  userFacingErrorText,
} from "@/lib/userFacingError";
import { resolveLoginIdentifier } from "./loginIdentifier";

/**
 * Şifre kurtarma (2026-10-13, #118, göç 20261102000000).
 *
 * - **Kurtarma adresi:** kişi Ayarlar'da adresini yazar → `recovery-email`
 *   fonksiyonu 6 haneli kodu o adrese gönderir → kod `confirm_recovery_email`
 *   ile doğrulanınca adres kaydedilir. Doğrulanmamış adres hiçbir zaman
 *   kaydedilmez (sütuna doğrudan yazma yetkisi yok).
 * - **Şifremi unuttum:** giriş numarası ya da e-posta → `request-password-reset`
 *   bağlantıyı kurtarma adresine (yoksa gerçek giriş adresine) gönderir.
 *   Yanıt, hesabın var olup olmadığını söylemez.
 */

type FunctionErrorBody = {
  error?: unknown;
  message?: unknown;
  limit?: unknown;
};

async function readErrorBody(
  error: unknown
): Promise<FunctionErrorBody | undefined> {
  const context = (error as { context?: { json?: () => Promise<unknown> } })
    ?.context;
  if (!context?.json) return undefined;
  try {
    return (await context.json()) as FunctionErrorBody;
  } catch (parseError) {
    console.error(
      "[recoveryService] error body unreadable",
      String(parseError)
    );
    return undefined;
  }
}

const ERROR_TEXT: Record<string, string> = {
  email_unavailable:
    "E-posta gönderimi şu anda yapılandırılmamış. Kurum yöneticinize başvurun.",
  email_failed: "E-posta gönderilemedi. Adresi kontrol edip tekrar deneyin.",
  rate_limited: "Çok fazla deneme yapıldı. Bir saat sonra tekrar deneyin.",
  password_change_required: "Önce şifrenizi değiştirmeniz gerekiyor.",
  request_in_progress:
    "İsteğiniz işleniyor, birkaç saniye sonra tekrar deneyin.",
  invalid_input: "Giriş numaranızı (8 hane) ya da e-posta adresinizi yazın.",
};

async function functionErrorText(
  error: unknown,
  fallback: string
): Promise<string> {
  if (isNetworkError(error)) return NETWORK_ERROR_TEXT;
  const body = await readErrorBody(error);
  if (typeof body?.message === "string" && userFacingErrorText(body.message)) {
    return body.message;
  }
  if (typeof body?.error === "string" && body.error in ERROR_TEXT) {
    return ERROR_TEXT[body.error];
  }
  return fallback;
}

/** Giriş ekranındaki tek alanın değeri geçerli mi (numara ya da e-posta). */
export function isRecoveryIdentifier(value: string): boolean {
  return resolveLoginIdentifier(value) !== null;
}

export async function requestPasswordResetLink(
  identifier: string
): Promise<void> {
  const { error } = await supabase.functions.invoke("request-password-reset", {
    body: { identifier: identifier.trim() },
  });
  if (error) {
    throw new Error(
      await functionErrorText(
        error,
        "Şifre sıfırlama isteği gönderilemedi. Lütfen daha sonra tekrar deneyin."
      )
    );
  }
}

export async function sendRecoveryCode(email: string): Promise<void> {
  const { error } = await supabase.functions.invoke("recovery-email", {
    body: { email: email.trim() },
    // Her deneme yeni bir istek: aynı anahtar, gönderilemeyen bir kodun
    // sonucunu tekrar oynatırdı.
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });
  if (error) {
    throw new Error(
      await functionErrorText(
        error,
        "Doğrulama kodu gönderilemedi. Lütfen tekrar deneyin."
      )
    );
  }
}

/** Doğruysa kaydedilen adresi döndürür; kod yanlışsa `null`. */
export async function confirmRecoveryCode(
  code: string
): Promise<string | null> {
  const { data, error } = await supabase.rpc("confirm_recovery_email", {
    verification_code: code.trim(),
  });
  if (error) {
    throw new Error(
      userFacingErrorText(error) ?? "Kod doğrulanamadı. Lütfen tekrar deneyin."
    );
  }
  return typeof data === "string" ? data : null;
}

export async function removeRecoveryEmail(): Promise<void> {
  const { error } = await supabase.rpc("remove_my_recovery_email");
  if (error) {
    throw new Error(
      userFacingErrorText(error) ??
        "Kurtarma adresi kaldırılamadı. Lütfen tekrar deneyin."
    );
  }
}
