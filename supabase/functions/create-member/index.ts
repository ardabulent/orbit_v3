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
import {
  beginFunctionCall,
  finishFunctionCall,
  idempotencyKeyFrom,
} from "../_shared/requestGuard.ts";

/**
 * Üye oluşturma akışı bilinçli olarak auth kullanıcısını önce yaratır: giriş
 * numarası sentetik adresin parçasıdır, person_code ise veritabanı tarafından
 * tahsis edilir. Üyelik RPC'si auth kullanıcısı yaratıldıktan sonra çağrılır.
 *
 * Yetki kararı SQL fonksiyonlarındadır; service_role RLS'i baypas ettiği için
 * istemci tarafındaki veya bu dosyadaki kontroller güvenlik sınırı değildir.
 * Üye oluşturma denetim kaydı RPC'nin aynı işleminde yazıldığı için başarılı
 * RPC yanıtında audit_written sabit olarak true'dur. Kilit bayrağı ise
 * createUser'dan sonra yazılır; auth şifresi yazılırken çalışan tetikleyici
 * bayrağı düşürdüğü için sıra zorunludur.
 */
const requestSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  role: z.enum(["teacher", "student", "parent"]),
  branchId: z.string().uuid().nullable().optional(),
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

  // Kapı, numara tahsisinden ÖNCE. Sıra önemli: `internal_allocate_member_slot`
  // advisory lock'la sıradaki kişi numarasını tüketiyor ve reddedilecek bir
  // çağrının bir numarayı yakmasına gerek yok.
  const guard = await beginFunctionCall(
    adminClient,
    "create-member",
    userData.user.id,
    idempotencyKeyFrom(request),
    "[create-member]"
  );

  if (guard.kind === "replay") {
    // Tekrarlanan istek: üye zaten oluşturuldu. Geçici şifre DÖNMÜYOR ve
    // dönemez — hiçbir yere yazılmadı. Şifre kaybolduysa yol sıfırlamaktır.
    return jsonResponse(
      { data: { replayed: true, ...(guard.outcome ?? {}) } },
      200,
      origin
    );
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

  const { data: slot, error: slotError } = await adminClient
    .rpc("internal_allocate_member_slot", {
      caller_user_id: userData.user.id,
      target_branch_id: input.branchId ?? null,
    })
    .maybeSingle<{
      organization_id: string;
      organization_code: number;
      person_code: number;
    }>();
  if (slotError) {
    console.error("[create-member] slot allocation failed");
    return jsonResponse({ error: "service_unavailable" }, 503, origin);
  }
  if (!slot) {
    return jsonResponse({ error: "forbidden" }, 403, origin);
  }

  const loginNumber = `${slot.organization_code}${slot.person_code}`;
  const temporaryPassword = generateTemporaryPassword();
  const passwordExpiresAt = temporaryPasswordExpiresAt();
  const { data: created, error: createError } =
    await adminClient.auth.admin.createUser({
      email: syntheticEmailFor(loginNumber),
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { full_name: input.fullName.trim() },
    });
  if (createError || !created.user) {
    console.error("[create-member] auth user creation failed");
    return jsonResponse({ error: "member_create_failed" }, 409, origin);
  }

  const { data: membershipId, error: membershipError } = await adminClient.rpc(
    "internal_create_membership",
    {
      caller_user_id: userData.user.id,
      member_user_id: created.user.id,
      organization_id: slot.organization_id,
      branch_id: input.branchId ?? null,
      person_code: slot.person_code,
      member_role: input.role,
      member_full_name: input.fullName.trim(),
      login_number: loginNumber,
      // v1.2-16: kilit artık bu RPC'nin işleminde yazılıyor. Öncesinde
      // aşağıda ayrı bir UPDATE vardı ve başarısız olduğunda üye geçici
      // şifresiyle **süresiz** kalıyordu.
      password_expires_at: passwordExpiresAt,
    }
  );
  if (membershipError || typeof membershipId !== "string") {
    const { error: cleanupError } = await adminClient.auth.admin.deleteUser(
      created.user.id
    );
    if (cleanupError) {
      console.error("[create-member] auth user cleanup failed");
    }
    console.error("[create-member] membership creation failed");
    return jsonResponse({ error: "member_create_failed" }, 409, origin);
  }

  // Kilit ve denetim kaydı, üyelikle **aynı işlemde** yazıldı. RPC bir üyelik
  // kimliği döndürdüyse üçü de vardır; ayrı bir adım kalmadığı için ayrıca
  // başarısız olabilecek bir şey de yok.
  //
  // Alanlar sözleşmede kalıyor: `CredentialsPanel` bunları hâlâ okuyor ve
  // şifre sıfırlama akışlarında (`reset-*`) hâlâ `false` olabiliyorlar.
  // Buradaki değerler **sabit yazılmıyor**, RPC'nin gözlenen sonucundan
  // türetiliyor — daha önce `audit_written` bir olguyu ölçmeden iddia
  // ediyordu.
  const membershipCreated = typeof membershipId === "string";

  // Tekrarlanan istekte döndürülecek özet — **kimlik belirteci taşımaz**.
  //
  // Giriş numarası buradan v1.4-00'da çıkarıldı (`PLATFORM_SETTINGS` §5).
  // Sebebi: `internal_function_calls` kurum taşımayan bir çağrı defteri,
  // dolayısıyla `internal_delete_organization` onu görmüyor ve silinen bir
  // kurumun üyelerine ait satırlar geride kalıyordu. Numarayı hiç yazmayınca
  // temizlenecek bir şey de kalmıyor.
  //
  // Kayıp değil: giriş numarası = kurum kodu + `person_code` ve ikisi de
  // yöneticiye zaten açık. Bedeli ölçüldü ve tek yerde: tekrarlanan istekte
  // istemcinin gösterdiği "(giriş no …)" parantezi artık boş kalıyor —
  // `memberService` bunu zaten koşullu yazıyor, mesaj bozulmuyor.
  //
  // Geçici şifre burada hiç yoktu ve olmayacak: saklamak, şifrenin hiçbir
  // yere yazılmaması kararını bozmak olurdu.
  await finishFunctionCall(
    adminClient,
    guard.callId,
    { member_created: membershipCreated },
    "[create-member]"
  );

  return jsonResponse(
    {
      data: {
        login_number: loginNumber,
        temporary_password: temporaryPassword,
        password_expires_at: passwordExpiresAt,
        password_lock_set: membershipCreated,
        audit_written: membershipCreated,
        // "Yeni öğrenci" akışı hesabı açtıktan sonra öğrenci ya da veli
        // kaydına bağlar (2026-09-28). Bağlama çağıranın kendi yetkisiyle,
        // `link_student_account` / `link_guardian_account` üzerinden yapılır;
        // yetki SQL'de kalır. Kimlik bir sır değil: yönetici üye listesinde
        // zaten görüyor. Tekrarlanan istekte (replayed) dönmez — o yol
        // `finishFunctionCall` özetinden gelir ve kimlik taşımaz.
        membership_id: membershipCreated ? membershipId : null,
      },
    },
    201,
    origin
  );
});
