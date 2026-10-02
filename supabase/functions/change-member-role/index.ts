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
 * Kurum yöneticisi, kendi kurumundaki bir üyenin rolünü değiştirir (v1.4-07).
 *
 * **Neden Edge Function, neden RLS değil.** Ölçüldü: `organization_memberships`
 * üzerinde `authenticated` için sıfır yazma yetkisi var ve yalnız iki SELECT
 * politikası; INSERT/UPDATE/DELETE politikası hiç yok. Üyelik bir **kimlik**
 * kaydıdır ve `DECISION_LOG`'un kuralı bunu söylüyor: iş verisi RLS ile
 * yazılır, kimlik işlemleri Edge Function'da kalır.
 *
 * **Bu dosya ince bir kabuktur.** Yetki kararı, kural kontrolü ve denetim
 * kaydı `internal_change_member_role` içinde; gerekçe migration'da. Sebep:
 * `service_role` RLS'i baypas ettiği için bu sınır hiçbir politikadan
 * geçmiyor, dolayısıyla **test edilebilir bir yerde** durmak zorunda — ve
 * orası pgTAP'in görebildiği SQL.
 */

const requestSchema = z.object({
  membershipId: z.string().uuid(),
  // `admin` v1.4-08'de eklendi: yönetici devri terfi + kendini indirme olarak
  // yapılıyor ve ikisi de bu fonksiyondan geçiyor. Son yöneticinin gitmesini
  // engelleyen kural SQL'de bir SAYIM (`ORB06`), burada bir rol yasağı değil.
  role: z.enum(["admin", "teacher", "student", "parent"]),
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
    "change-member-role",
    userData.user.id,
    idempotencyKeyFrom(request),
    "[change-member-role]"
  );

  if (guard.kind === "replay") {
    return jsonResponse(
      { data: { replayed: true, ...(guard.outcome ?? {}) } },
      200,
      origin
    );
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
    // şey (K-04).
    return jsonResponse({ error: "service_unavailable" }, 503, origin);
  }

  const { error: changeError } = await adminClient.rpc(
    "internal_change_member_role",
    {
      caller_user_id: userData.user.id,
      target_membership_id: input.membershipId,
      new_role: input.role,
    }
  );

  if (changeError) {
    // Hata kodları **yutulmuyor ve çevrilmiyor**. `ORB03` ayakta duran ders
    // ataması demek ve `hint` "önce atamaları arşivleyin" diyor; ekranın
    // kullanıcıya söyleyeceği şey tam olarak o. Buradan genel bir
    // "işlem başarısız" dönmek, v1.2-15'in yazdığı kuralı kullanıcıdan
    // saklamak olurdu.
    // `ORB06` (son yönetici) 409'a düşüyor: istek geçerli ama kurumun bugünkü
    // durumu onu kabul edemiyor. Ekranın cevabı "önce başka birini yönetici
    // yap" — `hint` bunu söylüyor.
    const code = changeError.code ?? "unknown";
    const status = code === "42501" ? 403 : code === "23503" ? 404 : 409;

    await finishFunctionCall(
      adminClient,
      guard.callId,
      { role_changed: false, code },
      "[change-member-role]"
    );

    return jsonResponse(
      {
        error: "role_change_refused",
        code,
        detail: changeError.details ?? null,
        hint: changeError.hint ?? null,
      },
      status,
      origin
    );
  }

  // Denetim kaydı `internal_change_member_role` içinde yazıldı; burada ikinci
  // bir kayıt atılmıyor (**K-06**). Faili doğru yazmanın tek yolu onu
  // parametreyle geçirmekti: `service_role` bağlamında `auth.uid()` boştur.
  await finishFunctionCall(
    adminClient,
    guard.callId,
    { role_changed: true },
    "[change-member-role]"
  );

  return jsonResponse(
    { data: { role_changed: true, role: input.role } },
    200,
    origin
  );
});
