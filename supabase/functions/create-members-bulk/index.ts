import { createClient, z } from "../_shared/deps.ts";
import {
  isAllowedOrigin,
  jsonResponse,
  preflightResponse,
} from "../_shared/http.ts";
import { createMemberAccount } from "../_shared/memberAccount.ts";
import {
  beginFunctionCall,
  finishFunctionCall,
  idempotencyKeyFrom,
} from "../_shared/requestGuard.ts";

/**
 * Var olan öğrenci (ve isteğe bağlı velileri) kayıtlarına toplu giriş hesabı
 * açar (2026-10-23, ana plan 1.8).
 *
 * **Neden ayrı bir fonksiyon, `create-member` döngüsü değil.** `create-member`
 * yönetici başına saatte 60 hesapla sınırlı; 200 öğrenciyi Excel'le aktaran bir
 * kurum o sınıra takılır. Sınırı genişletmek yerine yetki daraltıldı:
 *
 *   * Bu fonksiyon AD ALMAZ, kayıt kimliği alır. Ad ve şube kayıttan, çağıranın
 *     KENDİ yetkisiyle (RLS) okunur. Göremediği kayda hesap açamaz.
 *   * Yalnız hesabı OLMAYAN kayda hesap açar. Yani anahtarı ele geçirilmiş bir
 *     yönetici bile kurumdaki kayıt sayısından fazla hesap üretemez ve rastgele
 *     adla hesap açamaz — `create-member`'ın 60/saat sınırının koruduğu risk
 *     (keyfi hesap üretimi) burada yapısal olarak yok.
 *   * Bir çağrıda en çok 10 öğrenci (velileriyle en çok 30 hesap); hız sınırı
 *     çağrı başına (`internal_begin_function_call`, 30/saat → saatte 300 öğrenci).
 *
 * Her hesap `create-member` ile AYNI yoldan açılır (`_shared/memberAccount.ts`)
 * ve kayda çağıranın yetkisiyle bağlanır (`link_student_account` /
 * `link_guardian_account`; yetki SQL'de). Kalemler sırayla işlenir; biri
 * başarısız olursa kalanlar denenir ve her kalemin sonucu döner. Hesap açılıp
 * bağlanamadıysa giriş bilgisi yine döner — geçici şifre yalnız bir kez üretilir.
 *
 * Geçici şifreler hiçbir yere yazılmaz; kapı defterine (`finishFunctionCall`)
 * yalnız sayılar gider.
 */
const MAX_STUDENTS = 10;
const MAX_ACCOUNTS = 30;

const requestSchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1).max(MAX_STUDENTS),
  includeGuardians: z.boolean().default(false),
});

type ItemResult = {
  kind: "student" | "guardian";
  recordId: string;
  fullName: string;
  /** Velinin hangi öğrenci için açıldığı (fişte gösterilir). */
  forStudent?: string;
  status:
    "created" | "already_has_account" | "not_found" | "failed" | "skipped";
  linked?: boolean;
  login_number?: string;
  temporary_password?: string;
  error?: string;
};

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
  // Kayıtlar ve bağlama ÇAĞIRANIN yetkisiyle: RLS ve link_* RPC'leri karar verir.
  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });

  const guard = await beginFunctionCall(
    adminClient,
    "create-members-bulk",
    userData.user.id,
    idempotencyKeyFrom(request),
    "[create-members-bulk]"
  );
  if (guard.kind === "replay") {
    // Tekrarlanan toplu istek: hesaplar zaten açıldı, şifreler dönemez.
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

  const studentIds = [...new Set(input.studentIds)];
  const { data: students, error: studentsError } = await userClient
    .from("students")
    .select("id, full_name, branch_id, auth_user_id")
    .in("id", studentIds)
    .is("archived_at", null);
  if (studentsError) {
    console.error("[create-members-bulk] students read failed");
    await finishFunctionCall(
      adminClient,
      guard.callId,
      { failed: "read" },
      "[create-members-bulk]"
    );
    return jsonResponse({ error: "service_unavailable" }, 503, origin);
  }

  type StudentRow = {
    id: string;
    full_name: string;
    branch_id: string | null;
    auth_user_id: string | null;
  };
  const studentById = new Map(
    ((students ?? []) as StudentRow[]).map(row => [row.id, row])
  );

  type Work = {
    kind: "student" | "guardian";
    recordId: string;
    fullName: string;
    branchId: string | null;
    hasAccount: boolean;
    forStudent?: string;
  };
  const work: Work[] = [];
  const results: ItemResult[] = [];

  for (const id of studentIds) {
    const row = studentById.get(id);
    if (!row) {
      results.push({
        kind: "student",
        recordId: id,
        fullName: "",
        status: "not_found",
      });
      continue;
    }
    work.push({
      kind: "student",
      recordId: row.id,
      fullName: row.full_name,
      branchId: row.branch_id,
      hasAccount: Boolean(row.auth_user_id),
    });
  }

  if (input.includeGuardians && studentById.size > 0) {
    const { data: links, error: linksError } = await userClient
      .from("student_guardians")
      .select("student_id, guardians(id, full_name, auth_user_id, archived_at)")
      .in("student_id", [...studentById.keys()])
      .is("archived_at", null);
    if (linksError) {
      console.error("[create-members-bulk] guardian links read failed");
    } else {
      const seen = new Set<string>();
      type GuardianRow = {
        id: string;
        full_name: string;
        auth_user_id: string | null;
        archived_at: string | null;
      };
      // Tipsiz istemci gömülü ilişkiyi dizi sanıyor; PostgREST çoka-bir
      // ilişkide tek nesne döndürür. İkisi de kabul edilir.
      for (const link of (links ?? []) as unknown as Array<{
        student_id: string;
        guardians: GuardianRow | GuardianRow[] | null;
      }>) {
        const guardian = Array.isArray(link.guardians)
          ? (link.guardians[0] ?? null)
          : link.guardians;
        if (!guardian || guardian.archived_at || seen.has(guardian.id))
          continue;
        seen.add(guardian.id);
        const student = studentById.get(link.student_id);
        work.push({
          kind: "guardian",
          recordId: guardian.id,
          fullName: guardian.full_name,
          // Velinin şubesi yok; çocuğunun şubesi — "Yeni öğrenci" akışı da böyle.
          // Şube yöneticisi kurum geneli hesap açamaz; bu yüzden null değil.
          branchId: student?.branch_id ?? null,
          hasAccount: Boolean(guardian.auth_user_id),
          forStudent: student?.full_name,
        });
      }
    }
  }

  let opened = 0;
  for (const item of work) {
    const base = {
      kind: item.kind,
      recordId: item.recordId,
      fullName: item.fullName,
      ...(item.forStudent ? { forStudent: item.forStudent } : {}),
    };
    if (item.hasAccount) {
      results.push({ ...base, status: "already_has_account" });
      continue;
    }
    if (opened >= MAX_ACCOUNTS) {
      results.push({ ...base, status: "skipped", error: "batch_limit" });
      continue;
    }
    const account = await createMemberAccount(
      adminClient,
      userData.user.id,
      {
        fullName: item.fullName,
        role: item.kind === "student" ? "student" : "parent",
        branchId: item.branchId,
      },
      "[create-members-bulk]"
    );
    if (!account.ok) {
      results.push({ ...base, status: "failed", error: account.error });
      // Yetkisiz çağıran ilk kalemde reddedilir; kalanını denemek boşa iş.
      if (account.error === "forbidden") break;
      continue;
    }
    opened += 1;
    const { error: linkError } = await userClient.rpc(
      item.kind === "student"
        ? "link_student_account"
        : "link_guardian_account",
      item.kind === "student"
        ? {
            target_student_id: item.recordId,
            target_membership_id: account.membershipId,
          }
        : {
            target_guardian_id: item.recordId,
            target_membership_id: account.membershipId,
          }
    );
    if (linkError) console.error("[create-members-bulk] link failed");
    results.push({
      ...base,
      status: "created",
      linked: !linkError,
      login_number: account.loginNumber,
      temporary_password: account.temporaryPassword,
    });
  }

  const count = (status: ItemResult["status"]) =>
    results.filter(result => result.status === status).length;
  await finishFunctionCall(
    adminClient,
    guard.callId,
    {
      created: count("created"),
      already_has_account: count("already_has_account"),
      failed: count("failed") + count("not_found") + count("skipped"),
    },
    "[create-members-bulk]"
  );

  return jsonResponse({ data: { items: results } }, 200, origin);
});
