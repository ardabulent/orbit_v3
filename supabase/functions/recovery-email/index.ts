import { createClient, z } from "../_shared/deps.ts";
import {
  isAllowedOrigin,
  jsonResponse,
  preflightResponse,
} from "../_shared/http.ts";
import { sendMail, smtpConfig } from "../_shared/mailer.ts";
import { orbitHtml } from "../_shared/mailMessage.ts";
import {
  beginFunctionCall,
  finishFunctionCall,
  idempotencyKeyFrom,
} from "../_shared/requestGuard.ts";

/**
 * Kurtarma adresine doğrulama kodu gönderir (2026-10-13, #118).
 *
 * Kişi Ayarlar'da adresini yazar; 6 haneli kod üretilir (SQL,
 * `internal_start_recovery_email_challenge`) ve o adrese gönderilir. Kodun
 * geri girilmesi bu fonksiyondan geçmez: `confirm_recovery_email` RPC'si
 * oturumla çağrılır ve pgTAP ile sınanır. Adres yalnız kod doğrulanınca
 * `profiles.recovery_email`'e yazılır.
 *
 * Hız sınırı ortak çağrı kapısında (varsayılan saatte 10); kilitli hesap
 * (geçici şifre) kod isteyemez.
 */

/** Kayıt öneki; çağrı defteri özetine giren bir şey değil. */
const LOG = "[recovery-email]";

const requestSchema = z.object({
  email: z.string().trim().min(5).max(254),
});

Deno.serve(async request => {
  const origin = request.headers.get("origin");

  if (!isAllowedOrigin(origin)) {
    return jsonResponse({ error: "origin_not_allowed" }, 403, null);
  }

  if (request.method === "OPTIONS") {
    return preflightResponse(origin);
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405, origin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const mail = smtpConfig();

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: "service_unavailable" }, 503, origin);
  }
  if (!mail) {
    return jsonResponse({ error: "email_unavailable" }, 503, origin);
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return jsonResponse({ error: "unauthorized" }, 401, origin);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(
    authorization.slice("Bearer ".length)
  );

  if (userError || !userData.user) {
    return jsonResponse({ error: "forbidden" }, 403, origin);
  }

  let input: z.infer<typeof requestSchema>;
  try {
    input = requestSchema.parse(await request.json());
  } catch {
    return jsonResponse({ error: "invalid_input" }, 400, origin);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const guard = await beginFunctionCall(
    adminClient,
    "recovery-email",
    userData.user.id,
    idempotencyKeyFrom(request),
    LOG
  );

  if (guard.kind === "replay") {
    return jsonResponse(
      { data: { replayed: true, ...(guard.outcome ?? {}) } },
      200,
      origin
    );
  }
  if (guard.kind === "password_locked") {
    return jsonResponse({ error: "password_change_required" }, 403, origin);
  }
  if (guard.kind === "in_progress") {
    return jsonResponse({ error: "request_in_progress" }, 409, origin);
  }
  if (guard.kind === "rate_limited") {
    return jsonResponse(
      { error: "rate_limited", limit: guard.limit },
      429,
      origin
    );
  }
  if (guard.kind !== "proceed") {
    return jsonResponse({ error: "service_unavailable" }, 503, origin);
  }

  const { data: code, error: codeError } = await adminClient.rpc(
    "internal_start_recovery_email_challenge",
    { target_user_id: userData.user.id, target_email: input.email }
  );

  if (codeError || typeof code !== "string") {
    // 22023: adres biçimi ya da sentetik adres — veritabanının Türkçe cümlesi
    // kullanıcıya aynen gider.
    if (codeError?.code === "22023") {
      return jsonResponse(
        { error: "invalid_email", message: codeError.message },
        400,
        origin
      );
    }
    console.error(`${LOG} challenge could not be created`);
    return jsonResponse({ error: "service_unavailable" }, 503, origin);
  }

  // Gönderim deftere düşer (`email_deliveries`, göç 20261103000000): adres ve
  // kod yazılmaz, yalnız sonuç. Defter yazılamazsa gönderim yine yapılır.
  const { data: deliveryId, error: ledgerError } = await adminClient.rpc(
    "internal_begin_email_delivery",
    { target_user_id: userData.user.id, delivery_kind: "recovery_code" }
  );
  if (ledgerError) console.error(`${LOG} ledger write failed`);

  const finishDelivery = async (status: "sent" | "failed", reason?: string) => {
    if (typeof deliveryId !== "number") return;
    const { error } = await adminClient.rpc("internal_finish_email_delivery", {
      delivery_id: deliveryId,
      delivery_status: status,
      failure_reason: reason ?? null,
    });
    if (error) console.error(`${LOG} ledger write failed`);
  };

  try {
    await sendMail(mail, {
      to: input.email.trim().toLowerCase(),
      subject: `ORBIT doğrulama kodu: ${code}`,
      text: [
        "Merhaba,",
        "",
        `ORBIT hesabınıza bu adresi kurtarma e-postası olarak eklemek için doğrulama kodunuz: ${code}`,
        "",
        "Kod 15 dakika geçerlidir. Bu isteği siz yapmadıysanız bu e-postayı dikkate almayın.",
      ].join("\n"),
      html: orbitHtml([
        "Merhaba,",
        "ORBIT hesabınıza bu adresi kurtarma e-postası olarak eklemek için doğrulama kodunuz:",
        code,
        "Kod 15 dakika geçerlidir.",
      ]),
    });
  } catch (sendError) {
    const reason = sendError instanceof Error ? sendError.message : "unknown";
    console.error(`${LOG} mail failed`, reason);
    await finishDelivery("failed", reason);
    await finishFunctionCall(
      adminClient,
      guard.callId,
      { code_sent: false },
      LOG
    );
    return jsonResponse({ error: "email_failed" }, 502, origin);
  }

  await finishDelivery("sent");
  await finishFunctionCall(adminClient, guard.callId, { code_sent: true }, LOG);

  return jsonResponse({ data: { code_sent: true } }, 200, origin);
});
