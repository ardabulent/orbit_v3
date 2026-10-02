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
import { syntheticEmailFor } from "../_shared/syntheticEmail.ts";
import { setPasswordLock } from "../_shared/passwordLock.ts";
import {
  beginFunctionCall,
  finishFunctionCall,
} from "../_shared/requestGuard.ts";

const requestSchema = z.object({
  organizationName: z.string().trim().min(2).max(120),
  organizationSlug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  branchName: z.string().trim().min(2).max(120),
  adminFullName: z.string().trim().min(2).max(120),
});

/**
 * Sentetik adresin alan adı. RFC 2606 gereği `.invalid` hiçbir zaman
 * çözümlenmez. İstemcideki `loginIdentifier.ts` ile aynı değer olmak zorunda;
 * ikisi ayrışırsa oluşturulan hesaba giriş yapılamaz.
 */
/** Yeni bir kurumun ilk kişisi. Veritabanı da aynı değeri hesaplar ve doğrular. */
const FIRST_PERSON_CODE = 1000;

/**
 * Geçici şifrenin ömrü. Dağıtılıp hiç kullanılmayan kâğıtlardaki şifreler
 * süresiz geçerli kalmamalı; bkz. `.ai/DECISION_LOG.md` — "Kimlik ve Giriş
 * Bilgisi Mimarisi".
 */
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

  const token = authorization.slice("Bearer ".length);
  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } =
    await authClient.auth.getUser(token);

  if (userError || !userData.user) {
    return jsonResponse({ error: "forbidden" }, 403, origin);
  }

  // Operatörlük `platform_operators` tablosundan okunur, JWT'deki
  // `app_metadata.platform_admin` bayrağından değil. Aynı bilgiyi iki düzlemde
  // saklamak bu projede altı kez soruna yol açmış olan drift kalıbıdır; tek
  // doğruluk kaynağı tablodur (bkz. `.ai/DECISION_LOG.md` — "Platform
  // operatörü ayrı bir eksendir").
  //
  // Sorgu `service_role` ile yapılır. Kullanıcının kendi token'ıyla yapılsaydı
  // RLS devreye girer ve operatör olmayan biri için satır dönmezdi; sonuç aynı
  // olurdu ancak "operatör değil" ile "sorgu başarısız" ayrımı kaybolurdu.
  const operatorCheckClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: operator, error: operatorError } = await operatorCheckClient
    .from("platform_operators")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .eq("status", "active")
    .maybeSingle();

  if (operatorError) {
    // Yetki kontrolü yapılamadıysa isteği geçirmek yerine reddediyoruz.
    console.error("[bootstrap-organization] operator lookup failed");
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

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Bu fonksiyon idempotency anahtarı ALMIYOR ve buna ihtiyacı yok:
  // `organizations_slug_key` benzersiz, tekrarlanan kurulum zaten
  // çakışmayla reddediliyor.
  // Hız sınırına ise dahil — kaçak bir döngü yine durdurulmalı.
  const guard = await beginFunctionCall(
    adminClient,
    "bootstrap-organization",
    userData.user.id,
    null,
    "[bootstrap-organization]"
  );

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

  // Sıra zorunlu: sentetik adres kurum kodunu içeriyor, dolayısıyla kod
  // kullanıcıdan önce; kullanıcı ise üyeliğin foreign key'i olduğu için
  // kurumdan önce yaratılmak zorunda. Kod bu yüzden ayrı ayrılıyor.
  const { data: reservedCode, error: reserveError } = await adminClient.rpc(
    "internal_reserve_organization_code"
  );

  if (reserveError || typeof reservedCode !== "number") {
    console.error("[bootstrap-organization] code reservation failed");
    return jsonResponse({ error: "service_unavailable" }, 503, origin);
  }

  const loginNumber = `${reservedCode}${FIRST_PERSON_CODE}`;
  const syntheticEmail = syntheticEmailFor(loginNumber);
  const temporaryPassword = generateTemporaryPassword();

  // `inviteUserByEmail` DEĞİL. Davet, teslim edilemez `.invalid` adresini
  // reddeder; kabul etse bile kullanıcı şifresini belirlemeden panele düşer.
  // `email_confirm: true` çünkü doğrulanacak bir kutu yok — adres zaten
  // yalnızca kimlik belirteci.
  const { data: created, error: createError } =
    await adminClient.auth.admin.createUser({
      email: syntheticEmail,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { full_name: input.adminFullName },
    });

  if (createError || !created.user) {
    console.error("[bootstrap-organization] admin user creation failed");
    return jsonResponse({ error: "admin_create_failed" }, 409, origin);
  }

  const { data: bootstrap, error: bootstrapError } = await adminClient.rpc(
    "internal_bootstrap_organization",
    {
      organization_name: input.organizationName,
      organization_slug: input.organizationSlug,
      organization_code: reservedCode,
      branch_name: input.branchName,
      admin_user_id: created.user.id,
      admin_person_code: FIRST_PERSON_CODE,
      actor_user_id: userData.user.id,
    }
  );

  if (bootstrapError) {
    // Kurum kurulamadıysa yaratılan kullanıcı ortada kalmamalı: kimseye ait
    // olmayan, hiçbir kuruma bağlı olmayan bir hesap giriş yapabilir ve
    // kimlik çözümlemesinde hataya düşer.
    const { error: cleanupError } = await adminClient.auth.admin.deleteUser(
      created.user.id
    );
    if (cleanupError) {
      console.error("[bootstrap-organization] user cleanup failed");
    }
    return jsonResponse(
      { error: "organization_bootstrap_failed" },
      409,
      origin
    );
  }

  // Kilit, kullanıcı oluşturulduktan SONRA yazılır. Sebebi
  // `on_auth_password_changed`: `auth.users` üzerinde bir şifre GÜNCELLEMESİ
  // olduğunda bayrağı düşürüyor. Bu sıra bir tercih değil kısıttır ve
  // şifreyi değiştiren bütün akışlar için geçerli.
  const passwordExpiresAt = temporaryPasswordExpiresAt();

  // Kurum ve kullanıcı bu noktada oluştu. Bayrak yazılamadıysa kilit devreye
  // girmez — kullanıcı geçici şifresiyle **süresiz** dolaşabilir. İsteği
  // başarısız saymak doğru değil (kurum var ve giriş bilgisi operatörün
  // ekranında bir kez görünecek), ama tek bir anlık hatanın bedeli de bu
  // olmamalı: yazma sınırlı sayıda yeniden deneniyor (v1.2-16).
  //
  // Yine de başarısız olursa gizlenmiyor — yanıttaki `password_lock_set`
  // taşıyor ve operatör ekranında görünüyor.
  const lockSet = await setPasswordLock(
    adminClient,
    created.user.id,
    passwordExpiresAt,
    "[bootstrap-organization]"
  );

  // `internal_bootstrap_organization` denetim kaydını `audit_events`'e yazar,
  // yani KURUMUN kaydına. Operatör o tabloyu okuyamaz (policy kurum admini
  // istiyor) ve okuyabilmesi de doğru olmaz. Platform ekseninin kaydı ayrıdır;
  // panelin denetim listesi bu satırdan besleniyor. Yazılmazsa panel kurum
  // oluşturmayı hiç görmez.
  const organizationId = (bootstrap as { organization_id?: string } | null)
    ?.organization_id;

  const { error: auditError } = await adminClient
    .from("platform_audit_events")
    .insert({
      actor_user_id: userData.user.id,
      action: "platform.organization_created",
      entity_type: "organization",
      entity_id: organizationId ?? null,
      organization_id: organizationId ?? null,
      metadata: {
        organization_name: input.organizationName,
        organization_slug: input.organizationSlug,
        branch_name: input.branchName,
        admin_full_name: input.adminFullName,
        // Giriş numarası kaydediliyor, geçici şifre KAYDEDİLMİYOR. Şifre
        // yalnızca bu yanıtta bir kez görünür ve hiçbir yere yazılmaz.
        // Denetim kaydının amacı "operatör kimlik bilgisi üretti" olgusunu
        // görünür kılmak; şifrenin kendisini saklamak değil.
        login_number: (bootstrap as { login_number?: string } | null)
          ?.login_number,
      },
    });

  // Kurum bu noktada zaten oluştu. Denetim kaydı yazılamadı diye isteği
  // başarısız saymak, var olan bir kurumu "oluşmadı" göstermek olurdu; çağıran
  // taraf tekrar denerse slug çakışmasıyla karşılaşır.
  //
  // Ama sessiz de geçilemez: `PROJECT_STATE.md` bölüm 10 denetim kaydını
  // ZORUNLU kılıyor. "Zorunlu" burada "işlemi durdurur" değil, "yazılamadığı
  // operatörden gizlenemez" demektir — yanıttaki `audit_written` bunu taşır.
  if (auditError) {
    console.error("[bootstrap-organization] platform audit write failed");
  }

  // Geçici şifre yanıtta BİR KEZ dönüyor ve hiçbir yere yazılmıyor. Operatör
  // ekranda görür, kuruma teslim eder; kaybolursa yenisi üretilir. Düz metin
  // şifre saklamak KVKK açısından savunulamaz ve gereksizdir.
  await finishFunctionCall(
    adminClient,
    guard.callId,
    { completed: true },
    "[bootstrap-organization]"
  );

  return jsonResponse(
    {
      data: {
        ...(bootstrap as Record<string, unknown>),
        temporary_password: temporaryPassword,
        password_expires_at: passwordExpiresAt,
        password_lock_set: lockSet,
        audit_written: !auditError,
      },
    },
    201,
    origin
  );
});
