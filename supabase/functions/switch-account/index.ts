import { createClient, z } from "../_shared/deps.ts";
import {
  isAllowedOrigin,
  jsonResponse,
  preflightResponse,
} from "../_shared/http.ts";
import {
  beginFunctionCall,
  finishFunctionCall,
  idempotencyKeyFrom,
} from "../_shared/requestGuard.ts";

/**
 * Kişinin kendi hesapları arasında geçiş yapması (v1.4-17).
 *
 * **Bu dosya ince bir kabuktur.** Güvenlik kararı —"bu iki hesap aynı kişiye
 * mi ait"— `internal_begin_account_switch` içinde ve gerekçesi migration'da.
 * Sebep ev kuralı: `service_role` RLS'i baypas ettiği için bu sınır hiçbir
 * politikadan geçmiyor, dolayısıyla **pgTAP'in görebildiği** yerde durmak
 * zorunda.
 *
 * **Jeton istemciye geçirilmiyor.** `admin.generateLink` yanıtı
 * `hashed_token`'ın yanında **6 haneli bir `email_otp`** de taşıyor
 * (2026-09-14'te yerel yığında ölçüldü). İkisi de tarayıcıya gitseydi, tek
 * kullanımlık olmalarına rağmen ağda ve konsolda birer sır daha dolaşırdı.
 * `verify` burada yapılıyor; dışarı yalnız oturumun kendisi çıkıyor.
 */

const requestSchema = z.object({
  targetUserId: z.string().uuid(),
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

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: "service_unavailable" }, 503, origin);
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
    "switch-account",
    userData.user.id,
    idempotencyKeyFrom(request),
    "[switch-account]"
  );

  if (guard.kind === "replay") {
    // ⚠️ Tekrar oynatmada oturum DÖNMÜYOR. Çağrı defteri özeti bir oturum
    // taşıyamaz (kimlik belirteci yasak, `functionCallLedger` kapısı) ve
    // taşısaydı bile aynı jetonu ikinci kez vermek tek kullanımlık olmasını
    // anlamsız kılardı. İstemci yeni bir istek atar.
    return jsonResponse({ error: "request_in_progress" }, 409, origin);
  }

  if (guard.kind === "password_locked") {
    // Kilitli çağıran (geçici ya da süresi dolmuş şifre) hiçbir işi

    // yaptıramaz; önce şifresini değiştirmeli (v1.5-20, K-25).

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
    // Koruma çalışmıyorken korunan işi yapmak, korumayı hiç yazmamakla aynı
    // şey (K-04) — ve korunan iş burada bir oturum açmak.
    return jsonResponse({ error: "service_unavailable" }, 503, origin);
  }

  const { data: targetEmail, error: switchError } = await adminClient.rpc(
    "internal_begin_account_switch",
    {
      caller_user_id: userData.user.id,
      target_user_id: input.targetUserId,
    }
  );

  if (switchError || !targetEmail) {
    // Sebep dışarı **verilmiyor**. Diğer fonksiyonlar `hint`/`detail`
    // geçiriyor çünkü oradaki ret kullanıcının düzeltebileceği bir durumu
    // anlatıyor ("önce atamaları arşivleyin"). Burada ret "bu hesap senin
    // değil" demek ve ayrıntısı, bir hesabın var olup olmadığını sorgulamanın
    // yolu olurdu.
    await finishFunctionCall(
      adminClient,
      guard.callId,
      { switched: false },
      "[switch-account]"
    );

    return jsonResponse({ error: "switch_refused" }, 403, origin);
  }

  const { data: linkData, error: linkError } =
    await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: targetEmail as string,
    });

  if (linkError || !linkData?.properties?.hashed_token) {
    await finishFunctionCall(
      adminClient,
      guard.callId,
      { switched: false },
      "[switch-account]"
    );

    return jsonResponse({ error: "switch_unavailable" }, 503, origin);
  }

  const { data: sessionData, error: verifyError } =
    await authClient.auth.verifyOtp({
      type: "magiclink",
      token_hash: linkData.properties.hashed_token,
    });

  if (verifyError || !sessionData?.session) {
    await finishFunctionCall(
      adminClient,
      guard.callId,
      { switched: false },
      "[switch-account]"
    );

    return jsonResponse({ error: "switch_unavailable" }, 503, origin);
  }

  // Denetim kaydı `internal_begin_account_switch` içinde yazıldı; burada
  // ikinci bir kayıt atılmıyor (**K-06**).
  //
  // Özette yalnız bir bayrak var: çağrı defteri kimlik belirteci taşıyamaz
  // (`functionCallLedger` kapısı) ve bir oturum, taşınabilecek en ağır
  // belirteçtir.
  await finishFunctionCall(
    adminClient,
    guard.callId,
    { switched: true },
    "[switch-account]"
  );

  return jsonResponse(
    {
      data: {
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
        expires_at: sessionData.session.expires_at ?? null,
      },
    },
    200,
    origin
  );
});
