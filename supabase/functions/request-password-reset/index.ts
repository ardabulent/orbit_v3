import { createClient, z } from "../_shared/deps.ts";
import {
  isAllowedOrigin,
  jsonResponse,
  preflightResponse,
} from "../_shared/http.ts";
import { sendMail, smtpConfig } from "../_shared/mailer.ts";
import { orbitHtml } from "../_shared/mailMessage.ts";
import { syntheticEmailFor } from "../_shared/syntheticEmail.ts";

/**
 * Şifremi unuttum (2026-10-13, #118).
 *
 * Giriş ekranından OTURUMSUZ çağrılır (`verify_jwt = false`). Kişi giriş
 * numarasını ya da e-postasını yazar; sıfırlama bağlantısını GoTrue değil biz
 * üretiriz (`admin.generateLink`, posta göndermez) ve kişinin **doğrulanmış
 * kurtarma adresine** biz göndeririz. Giriş adresi `…@orbit.invalid` ise ve
 * kurtarma adresi yoksa hiçbir şey gönderilmez. Karar: DECISION_LOG "Auth
 * e-postası hiç değişmez; kurtarma linkini biz üretir, biz göndeririz".
 *
 * **Hesabın varlığı sızmaz.** Yanıt her durumda aynıdır ve gönderim yanıttan
 * SONRA yapılır (`EdgeRuntime.waitUntil`): var olan bir hesabın isteği posta
 * gönderimi kadar uzun sürseydi, süreye bakarak hangi numaraların gerçek
 * olduğu öğrenilebilirdi.
 *
 * Hız sınırı SQL'de (`internal_claim_password_reset`): kişi başına saatte 3,
 * sistemde saatte 100 gönderim.
 */

const requestSchema = z.object({
  identifier: z.string().trim().min(3).max(254),
});

const LOGIN_NUMBER = /^[1-9]\d{3}[1-9]\d{3}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

declare const EdgeRuntime:
  { waitUntil(promise: Promise<unknown>): void } | undefined;

function loginEmailFor(identifier: string): string | null {
  const value = identifier.replace(/\s+/g, "");
  if (LOGIN_NUMBER.test(value)) return syntheticEmailFor(value);
  if (EMAIL.test(value)) return value.toLowerCase();
  return null;
}

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
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const mail = smtpConfig();

  if (!supabaseUrl || !serviceRoleKey || !mail) {
    return jsonResponse({ error: "email_unavailable" }, 503, origin);
  }

  let input: z.infer<typeof requestSchema>;
  try {
    input = requestSchema.parse(await request.json());
  } catch {
    return jsonResponse({ error: "invalid_input" }, 400, origin);
  }

  const loginEmail = loginEmailFor(input.identifier);
  if (!loginEmail) {
    return jsonResponse({ error: "invalid_input" }, 400, origin);
  }

  const accepted = jsonResponse({ data: { accepted: true } }, 200, origin);

  // Bağlantı, isteğin geldiği uygulama adresine döner. Origin yoksa (tarayıcı
  // dışı çağrı) gönderim yapılmaz; yanıt yine aynıdır.
  if (!origin) {
    return accepted;
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const work = (async () => {
    const { data: target, error: claimError } = await adminClient
      .rpc("internal_claim_password_reset", { target_login_email: loginEmail })
      .maybeSingle<{
        user_id: string;
        auth_email: string;
        destination: string;
        delivery_id: number;
      }>();

    if (claimError) {
      console.error("[request-password-reset] claim failed");
      return;
    }
    if (!target) return;

    // Sonuç deftere düşer (`email_deliveries`); yazılamazsa gönderim yine
    // yapılır, kayıt düşer.
    const finish = async (status: "sent" | "failed", reason?: string) => {
      const { error } = await adminClient.rpc(
        "internal_finish_email_delivery",
        {
          delivery_id: target.delivery_id,
          delivery_status: status,
          failure_reason: reason ?? null,
        }
      );
      if (error) console.error("[request-password-reset] ledger write failed");
    };

    const { data: link, error: linkError } =
      await adminClient.auth.admin.generateLink({
        type: "recovery",
        email: target.auth_email,
        options: { redirectTo: `${origin}/sifre-belirle` },
      });

    const actionLink = link?.properties?.action_link;
    if (linkError || !actionLink) {
      console.error("[request-password-reset] link generation failed");
      await finish("failed", "link_failed");
      return;
    }

    try {
      await sendMail(mail, {
        to: target.destination,
        subject: "ORBIT şifre sıfırlama",
        text: [
          "Merhaba,",
          "",
          "ORBIT hesabınız için şifre sıfırlama istendi. Yeni şifrenizi belirlemek için bağlantıyı açın:",
          actionLink,
          "",
          "Bağlantı bir saat geçerlidir ve tek kullanımlıktır.",
          "Bu isteği siz yapmadıysanız bu e-postayı dikkate almayın; şifreniz değişmez.",
        ].join("\n"),
        html: orbitHtml(
          [
            "Merhaba,",
            "ORBIT hesabınız için şifre sıfırlama istendi. Yeni şifrenizi belirlemek için aşağıdaki düğmeye basın.",
            "Bağlantı bir saat geçerlidir ve tek kullanımlıktır.",
          ],
          { label: "Yeni şifre belirle", url: actionLink }
        ),
      });
      await finish("sent");
    } catch (sendError) {
      const reason = sendError instanceof Error ? sendError.message : "unknown";
      console.error("[request-password-reset] mail failed", reason);
      await finish("failed", reason);
    }
  })();

  if (typeof EdgeRuntime !== "undefined") {
    EdgeRuntime.waitUntil(work);
  } else {
    await work;
  }

  return accepted;
});
