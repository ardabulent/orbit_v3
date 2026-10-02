import { createClient, z } from "../_shared/deps.ts";
import {
  isAllowedOrigin,
  jsonResponse,
  preflightResponse,
} from "../_shared/http.ts";
import {
  generateTemporaryPassword,
  temporaryPasswordExpiresAt,
} from "../_shared/temporaryPassword.ts";
import { setPasswordLock } from "../_shared/passwordLock.ts";
import {
  beginFunctionCall,
  finishFunctionCall,
  idempotencyKeyFrom,
} from "../_shared/requestGuard.ts";

/**
 * Kurum yöneticisine yeni geçici şifre üretir.
 *
 * Kurtarma zincirinin son halkası: kurum yöneticisi şifresini kaybederse
 * başvuracağı yer platform operatörüdür. Bu işlem olmadan kayıp bir geçici
 * şifre kurumun tamamını erişilemez kılar — ilk denemede tam olarak bu yaşandı
 * ve tek çare yeni bir kurum açmak oldu.
 *
 * Yalnızca **kurum yöneticisini** hedefler. Öğretmen, öğrenci ve velinin
 * şifresini kurum yöneticisi kendi panelinden sıfırlar; operatörün kurum
 * kullanıcı listesine erişimi yoktur ve olmamalıdır.
 */

const requestSchema = z.object({
  organizationId: z.string().uuid(),
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

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const guard = await beginFunctionCall(
    adminClient,
    "reset-admin-password",
    userData.user.id,
    idempotencyKeyFrom(request),
    "[reset-admin-password]"
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

  const { data: operator, error: operatorError } = await adminClient
    .from("platform_operators")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .eq("status", "active")
    .maybeSingle();

  if (operatorError) {
    // Yetki kontrolü yapılamadıysa isteği geçirmek yerine reddediyoruz.
    console.error("[reset-admin-password] operator lookup failed");
    return jsonResponse({ error: "service_unavailable" }, 503, origin);
  }

  if (!operator) {
    return jsonResponse({ error: "forbidden" }, 403, origin);
  }

  let input: z.infer<typeof requestSchema>;
  try {
    input = requestSchema.parse(await request.json());
  } catch {
    return jsonResponse({ error: "invalid_request" }, 400, origin);
  }

  // En düşük `person_code`'a sahip aktif admin: kurumun kurucu yöneticisi.
  // Bir kurumda birden fazla admin olabilir; hangisinin sıfırlanacağı
  // belirsiz bırakılmamalı.
  const { data: membership, error: membershipError } = await adminClient
    .from("organization_memberships")
    .select("user_id, person_code, organization_id")
    .eq("organization_id", input.organizationId)
    .eq("role", "admin")
    .eq("status", "active")
    .order("person_code", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    console.error("[reset-admin-password] membership lookup failed");
    return jsonResponse({ error: "service_unavailable" }, 503, origin);
  }

  if (!membership) {
    return jsonResponse({ error: "admin_not_found" }, 404, origin);
  }

  const { data: organization, error: organizationError } = await adminClient
    .from("organizations")
    .select("code, name")
    .eq("id", input.organizationId)
    .maybeSingle();

  if (organizationError || !organization) {
    return jsonResponse({ error: "organization_not_found" }, 404, origin);
  }

  const temporaryPassword = generateTemporaryPassword();

  const { error: updateError } = await adminClient.auth.admin.updateUserById(
    membership.user_id,
    { password: temporaryPassword }
  );

  if (updateError) {
    console.error("[reset-admin-password] password update failed");
    return jsonResponse({ error: "password_update_failed" }, 409, origin);
  }

  const passwordExpiresAt = temporaryPasswordExpiresAt();

  // Kilit, şifre değişiminden SONRA yazılmak ZORUNDA:
  // `on_auth_password_changed` tetikleyicisi `auth.users` üzerindeki
  // şifre güncellemesinde çalışıp bayrağı düşürüyor. Yani sıra bir
  // tercih değil kısıt ve ters çevrilemez.
  //
  // Bu yüzden burada atomiklik mümkün değil: şifre GoTrue'da değişti,
  // kilit bizim veritabanımızda yazılıyor ve ikisi tek bir işleme
  // giremiyor. Yazılamazsa geçici şifre süresiz ve değiştirilmesi
  // zorunlu olmayan bir kimlik bilgisine dönüşür — tek seferlik bir
  // hatanın bedeli bu olmamalı, o yüzden sınırlı sayıda yeniden
  // deneniyor (v1.2-16). Sonuç yine dürüstçe bildiriliyor.
  const lockSet = await setPasswordLock(
    adminClient,
    membership.user_id,
    passwordExpiresAt,
    "[reset-admin-password]"
  );

  // Operatörün kimlik bilgisi ürettiği kayda geçmek ZORUNDA. Bu, "operatör
  // yetki yükseltebilir ama gizlice yapamaz" taahhüdünün çalıştırılabilir
  // karşılığıdır; bkz. `.ai/PROJECT_STATE.md` bölüm 10.
  //
  // Şifrenin kendisi yazılmıyor — yalnızca işlemin olduğu.
  const { error: auditError } = await adminClient
    .from("platform_audit_events")
    .insert({
      actor_user_id: userData.user.id,
      action: "platform.admin_password_reset",
      entity_type: "organization_membership",
      entity_id: membership.user_id,
      organization_id: input.organizationId,
      metadata: {
        organization_name: organization.name,
        login_number: `${organization.code}${membership.person_code}`,
      },
    });

  if (auditError) {
    // Şifre bu noktada zaten değişti. Denetim yazılamadı diye hata dönmek,
    // operatöre "başarısız" gösterip aslında değişmiş bir şifre bırakırdı;
    // tekrar denerse eski şifre de yenisi de geçersiz olurdu.
    //
    // Sessiz de geçilmiyor: yanıttaki `audit_written` alanı operatöre işlemin
    // ize geçmediğini bildirir. Bkz. `PROJECT_STATE.md` bölüm 10.
    console.error("[reset-admin-password] audit write failed");
  }

  // Giriş numarası çağrı defterinden v1.4-00'da çıkarıldı — gerekçesi
  // `create-member`'daki notta ve `PLATFORM_SETTINGS` §5'te. Bu fonksiyonu
  // platform operatörü çağırıyor; defterdeki satır bir kuruma bağlanamıyor ve
  // kurum silindiğinde onunla gitmiyor. Numara `platform_audit_events`'te
  // duruyor, orası zaten operatörün okuduğu yer.
  await finishFunctionCall(
    adminClient,
    guard.callId,
    { password_reset: true },
    "[reset-admin-password]"
  );

  return jsonResponse(
    {
      data: {
        organization_code: organization.code,
        login_number: `${organization.code}${membership.person_code}`,
        temporary_password: temporaryPassword,
        password_expires_at: passwordExpiresAt,
        password_lock_set: lockSet,
        audit_written: !auditError,
      },
    },
    200,
    origin
  );
});
