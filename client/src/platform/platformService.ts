import { supabase } from "@/lib/supabaseClient";
import type { IssuedCredentials } from "@/components/credentials/IssuedCredentials";
import type { AuditPage } from "@/audit/auditService";

export type { AuditPage };

/**
 * Platform panelinin veri katmanı.
 *
 * Okumaların tamamı kullanıcının kendi oturumuyla yapılır; yetkiyi RLS
 * belirler (bkz. `20260824014500_platform_operator_reads.sql`). Panelde
 * `service_role` kullanılmaz — kullanılsaydı, panelin açık olduğu her sekme
 * tarayıcıda tam yetkili bir anahtar taşıyor olurdu.
 *
 * Tek yazma yolu `bootstrap-organization` Edge Function'ıdır ve o da
 * operatörlüğü sunucu tarafında yeniden doğrular.
 */

export type PlatformOrganization = {
  id: string;
  name: string;
  slug: string;
  code: number | null;
  archivedAt: string | null;
  createdAt: string;
};

export type PlatformOperatorRow = {
  userId: string;
  displayName: string | null;
  role: "owner" | "operator";
  status: "active" | "suspended";
  note: string | null;
  createdAt: string;
};

export type PlatformAuditEvent = {
  id: number;
  actorUserId: string | null;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  organizationId: string | null;
  organizationName: string | null;
  createdAt: string;
};

export type CreateOrganizationInput = {
  organizationName: string;
  organizationSlug: string;
  branchName: string;
  adminFullName: string;
};

/**
 * Kurum kurulduğunda bir kez dönen giriş bilgisi.
 *
 * Geçici şifre **hiçbir yere kaydedilmez** — ne veritabanına, ne denetim
 * kaydına, ne tarayıcı deposuna. Yalnızca bu yanıtta gelir ve ekranda bir kez
 * gösterilir. Kaybolursa yenisi üretilir.
 */
export type OrganizationCredentials = IssuedCredentials & {
  organizationCode: number;
};

/**
 * Edge Function'ın döndürdüğü hata kodlarının Türkçe karşılıkları.
 *
 * Ham kodu ekrana basmıyoruz; operatör "admin_invite_failed" görünce ne
 * yapacağını bilemez. Bilinmeyen kod, sessizce yutulmak yerine genel mesajla
 * gösterilir ve kodun kendisi konsola düşer.
 */
const CREATE_ERROR_MESSAGES: Record<string, string> = {
  unauthorized: "Oturumunuz düşmüş görünüyor. Tekrar giriş yapın.",
  forbidden: "Bu işlem için platform operatörü yetkisi gerekiyor.",
  invalid_request:
    "Gönderilen bilgiler geçersiz. Alanları kontrol edip tekrar deneyin.",
  admin_create_failed:
    "Kurum yöneticisi hesabı oluşturulamadı. Lütfen tekrar deneyin; sorun sürerse geliştirme ekibine bildirin.",
  organization_bootstrap_failed:
    "Kurum oluşturulamadı. Kısa ad (slug) başka bir kurumda kullanılıyor olabilir.",
  service_unavailable:
    "Servis şu anda yanıt vermiyor. Birkaç dakika sonra tekrar deneyin.",
  password_change_required:
    "Bu işlemi yapmadan önce şifrenizi değiştirmeniz gerekiyor. Çıkış yapıp yeni şifre belirleyin.",
  origin_not_allowed:
    "Bu adres sunucu tarafında izinli değil. Geliştirme ekibine bildirin.",
  admin_not_found:
    "Bu kurumun aktif bir yöneticisi bulunamadı. Geliştirme ekibine bildirin.",
  organization_not_found: "Kurum bulunamadı. Listeyi yenileyip tekrar deneyin.",
  password_update_failed: "Yeni şifre kaydedilemedi. Lütfen tekrar deneyin.",
  confirmation_mismatch:
    "Yazdığınız ad kurum adıyla eşleşmiyor. Silme işlemi yapılmadı.",
  organization_delete_failed:
    "Kurum silinemedi. Listeyi yenileyip tekrar deneyin.",
  organization_not_empty:
    "Bu kurumda kayıt bulunduğu için silme reddedildi. Kayıtlar kaldırılmadan kurum silinemez.",
};

export function createOrganizationErrorMessage(code: unknown): string {
  if (typeof code === "string" && code in CREATE_ERROR_MESSAGES) {
    return CREATE_ERROR_MESSAGES[code];
  }

  return "Kurum oluşturulamadı. Lütfen tekrar deneyin.";
}

/**
 * Reddedilen silmenin gerekçesi (Issue #150).
 *
 * Tablo adları ham hâlleriyle gösteriliyor ve bu bilinçli: bu ekranı yalnızca
 * platform operatörleri görüyor, onlar da geliştirme ekibinin kendisi. "Bazı
 * kayıtlar var" demek, hangi tabloya bakacağını bilen birine hiçbir şey
 * söylemez.
 *
 * Liste okunamazsa red yine bildiriliyor. Gerekçeyi gösterememek, silmeye izin
 * vermek için sebep değildir.
 */
export function organizationNotEmptyMessage(blockingContent: unknown): string {
  const base = CREATE_ERROR_MESSAGES.organization_not_empty;

  if (!Array.isArray(blockingContent) || blockingContent.length === 0) {
    return base;
  }

  const parts = blockingContent
    .map(entry => {
      const row = entry as { table?: unknown; rows?: unknown };
      return typeof row.table === "string" && typeof row.rows === "number"
        ? `${row.table} (${row.rows} kayıt)`
        : null;
    })
    .filter((part): part is string => part !== null);

  if (parts.length === 0) {
    return base;
  }

  return `${base} Engelleyen kayıtlar: ${parts.join(", ")}.`;
}

export const DEFAULT_ORGANIZATION_LIMIT = 100;

export type OrganizationListResult = {
  rows: PlatformOrganization[];
  truncated: boolean;
};

export async function loadOrganizations(
  limit = DEFAULT_ORGANIZATION_LIMIT
): Promise<OrganizationListResult> {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, slug, code, archived_at, created_at")
    .order("code", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error("Kurum listesi yüklenemedi.");
  }

  const rows = (data ?? []).map(row => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    code: row.code,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
  }));

  return {
    rows,
    truncated: rows.length === limit,
  };
}

export const DEFAULT_OPERATOR_LIMIT = 50;

export type OperatorListResult = {
  rows: PlatformOperatorRow[];
  truncated: boolean;
};

export async function loadOperators(
  limit = DEFAULT_OPERATOR_LIMIT
): Promise<OperatorListResult> {
  const { data, error } = await supabase
    .from("platform_operators")
    .select("user_id, role, status, note, created_at")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error("Operatör listesi yüklenemedi.");
  }

  const rawRows = data ?? [];
  const names = await loadDisplayNames(rawRows.map(row => row.user_id));

  const rows = rawRows.map(row => ({
    userId: row.user_id,
    displayName: names.get(row.user_id) ?? null,
    role: row.role,
    status: row.status,
    note: row.note,
    createdAt: row.created_at,
  }));

  return {
    rows,
    truncated: rows.length === limit,
  };
}

export const DEFAULT_PLATFORM_AUDIT_LIMIT = 50;

export async function loadAuditEvents(
  limit = DEFAULT_PLATFORM_AUDIT_LIMIT,
  cursor?: number | null
): Promise<AuditPage<PlatformAuditEvent>> {
  let query = supabase
    .from("platform_audit_events")
    .select(
      "id, actor_user_id, action, entity_type, entity_id, organization_id, created_at"
    )
    .order("id", { ascending: false });

  if (cursor !== undefined && cursor !== null) {
    query = query.lt("id", cursor);
  }

  const { data, error } = await query.limit(limit + 1);

  if (error) {
    throw new Error("Denetim kaydı yüklenemedi.");
  }

  const rawRows = data ?? [];
  const hasMore = rawRows.length > limit;
  const slicedRows = hasMore ? rawRows.slice(0, limit) : rawRows;
  const nextCursor =
    hasMore && slicedRows.length > 0
      ? slicedRows[slicedRows.length - 1].id
      : null;

  const actorIds = slicedRows
    .map(row => row.actor_user_id)
    .filter((value): value is string => Boolean(value));

  // İsimler ayrı sorgulanıyor. Supabase'in gömülü join'i (`profiles(...)`)
  // burada çalışmaz: `platform_audit_events.actor_user_id` `auth.users`'a
  // bakıyor, `public.profiles`'a değil; PostgREST ilişkiyi göremiyor.
  const [names, organizationNames] = await Promise.all([
    loadDisplayNames(actorIds),
    loadOrganizationNames(),
  ]);

  const rows = slicedRows.map(row => ({
    id: row.id,
    actorUserId: row.actor_user_id,
    actorName: row.actor_user_id
      ? (names.get(row.actor_user_id) ?? null)
      : null,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    organizationId: row.organization_id,
    organizationName: row.organization_id
      ? (organizationNames.get(row.organization_id) ?? null)
      : null,
    createdAt: row.created_at,
  }));

  return {
    rows,
    nextCursor,
  };
}

async function loadDisplayNames(
  userIds: string[]
): Promise<Map<string, string>> {
  // `[...new Set(...)]` tsconfig hedefiyle uyumsuz (TS2802). Liste operatör
  // sayısı kadar kısa olduğu için `indexOf` ile tekilleştirmek yeterli.
  const unique = userIds.filter(
    (value, index) => userIds.indexOf(value) === index
  );

  if (unique.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", unique);

  // İsim çözümlenemezse liste yine gösterilir, yalnızca isim yerine kimlik
  // görünür. Yardımcı bir alan yüzünden asıl listeyi kaybetmek doğru olmaz.
  if (error) {
    return new Map();
  }

  return new Map((data ?? []).map(row => [row.id, row.display_name]));
}

async function loadOrganizationNames(): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name");

  if (error) {
    return new Map();
  }

  return new Map((data ?? []).map(row => [row.id, row.name]));
}

/**
 * Kurum yöneticisine yeni geçici şifre üretir.
 *
 * Kurtarma zincirinin son halkası. Bu olmadan kaybolan bir geçici şifre kurumu
 * kalıcı olarak erişilemez kılıyordu; tek çare yeni bir kurum açmaktı.
 */
export async function resetAdminPassword(
  organizationId: string
): Promise<OrganizationCredentials> {
  const { data, error } = await supabase.functions.invoke(
    "reset-admin-password",
    { body: { organizationId } }
  );

  if (error) {
    throw new Error(
      createOrganizationErrorMessage(await readFunctionErrorCode(error))
    );
  }

  const payload = (data as { data?: Record<string, unknown> } | null)?.data;
  const loginNumber = payload?.login_number;
  const temporaryPassword = payload?.temporary_password;
  const organizationCode = payload?.organization_code;
  const passwordLockSet =
    typeof payload?.password_lock_set === "boolean"
      ? payload.password_lock_set
      : undefined;
  const auditWritten =
    typeof payload?.audit_written === "boolean"
      ? payload.audit_written
      : undefined;

  // Şifre sunucuda zaten değişti. Yanıtı okuyamazsak sessizce başarılı dönmek,
  // kimsenin bilmediği bir şifreyle hesabı büsbütün kilitlemek olurdu.
  if (
    typeof loginNumber !== "string" ||
    typeof temporaryPassword !== "string" ||
    typeof organizationCode !== "number"
  ) {
    throw new Error(
      "Şifre sıfırlandı ancak yanıt okunamadı. İşlemi tekrarlayın; yeni şifre üretilecektir."
    );
  }

  return {
    organizationCode,
    loginNumber,
    temporaryPassword,
    passwordLockSet,
    auditWritten,
  };
}

/**
 * `FunctionsHttpError` hata gövdesini `context` üzerinden taşıyor; okunamazsa
 * `null` dönüp genel mesaja düşüyoruz.
 *
 * Çağıranların çoğu yalnızca `error` kodunu istiyor (`readFunctionErrorCode`).
 * Gövdenin tamamı, koda ek olarak veri taşıyan tek yanıt için gerekiyor:
 * silme reddi, hangi tabloda kaç kayıt olduğunu da bildiriyor (Issue #150).
 */
async function readFunctionErrorBody(
  error: unknown
): Promise<Record<string, unknown> | null> {
  const context = (error as { context?: { json?: () => Promise<unknown> } })
    .context;

  if (!context?.json) {
    console.error(
      "[platform] edge function failed",
      (error as Error | null)?.message
    );
    return null;
  }

  try {
    return (await context.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function readFunctionErrorCode(error: unknown): Promise<unknown> {
  return (await readFunctionErrorBody(error))?.error;
}

export async function createOrganization(
  input: CreateOrganizationInput
): Promise<OrganizationCredentials> {
  const { data, error } = await supabase.functions.invoke(
    "bootstrap-organization",
    { body: input }
  );

  if (!error) {
    const payload = (data as { data?: Record<string, unknown> } | null)?.data;
    const loginNumber = payload?.login_number;
    const temporaryPassword = payload?.temporary_password;
    const organizationCode = payload?.organization_code;
    const passwordLockSet =
      typeof payload?.password_lock_set === "boolean"
        ? payload.password_lock_set
        : undefined;
    const auditWritten =
      typeof payload?.audit_written === "boolean"
        ? payload.audit_written
        : undefined;

    // Kurum oluştu ama giriş bilgisi yanıttan okunamadıysa sessizce başarılı
    // dönmek en kötü sonuç olurdu: operatör "kuruldu" görür, şifre hiçbir yerde
    // yazılı olmadığı için bir daha ele geçirilemez ve kurum yöneticisi
    // hesabına asla giremez. Sıfırlama gerektiğini açıkça söylüyoruz.
    if (
      typeof loginNumber !== "string" ||
      typeof temporaryPassword !== "string" ||
      typeof organizationCode !== "number"
    ) {
      throw new Error(
        "Kurum oluşturuldu ancak giriş bilgisi okunamadı. Kurum listesinden kontrol edip yöneticiye yeni şifre üretin."
      );
    }

    return {
      organizationCode,
      loginNumber,
      temporaryPassword,
      passwordLockSet,
      auditWritten,
    };
  }

  throw new Error(
    createOrganizationErrorMessage(await readFunctionErrorCode(error))
  );
}

export type DeleteOrganizationResult = {
  organizationName: string;
  organizationCode: number | null;
  deletedMemberships: number;
  deletedBranches: number;
  deletedAuditEvents: number;
  orphanedUsers: number;
  /** Kimliği başka bir yerden talep edildiği için auth hesabı korunan üye sayısı. */
  protectedIdentities: number;
};

/**
 * Kurumu ve ona bağlı her şeyi siler. **Geri alınamaz.**
 *
 * `confirmName` sunucuda da doğrulanıyor; yalnızca istemcide kontrol etmek,
 * doğrudan API çağrısı yapan biri için hiçbir engel olmazdı.
 */
export async function deleteOrganization(
  organizationId: string,
  confirmName: string
): Promise<DeleteOrganizationResult> {
  const { data, error } = await supabase.functions.invoke(
    "delete-organization",
    { body: { organizationId, confirmName } }
  );

  if (error) {
    const body = await readFunctionErrorBody(error);

    // Kurumda kayıt olduğu için reddedilen silme (Issue #150), diğer
    // hatalardan farklı bir mesaj hak ediyor: burada yapılacak şey "tekrar
    // denemek" değil, neyin engellediğine bakmaktır.
    if (body?.error === "organization_not_empty") {
      throw new Error(organizationNotEmptyMessage(body.blocking_content));
    }

    throw new Error(createOrganizationErrorMessage(body?.error));
  }

  const payload = ((data as { data?: Record<string, unknown> } | null)?.data ??
    {}) as Record<string, unknown>;

  return {
    organizationName:
      typeof payload.organization_name === "string"
        ? payload.organization_name
        : confirmName,
    organizationCode:
      typeof payload.organization_code === "number"
        ? payload.organization_code
        : null,
    deletedMemberships: Number(payload.deleted_memberships ?? 0),
    deletedBranches: Number(payload.deleted_branches ?? 0),
    deletedAuditEvents: Number(payload.deleted_audit_events ?? 0),
    orphanedUsers: Number(payload.orphaned_users ?? 0),
    protectedIdentities: Number(payload.protected_identity_count ?? 0),
  };
}

/**
 * Kurumun yapısal sayıları. Kişisel veri İÇERMEZ — yalnızca adet.
 *
 * Operatör `organization_memberships` tablosunu okuyamaz ve okumamalı. Silme
 * onayında "kaç hesap silinecek" sorusunun cevabı ise bir sayıdır ve onu
 * göstermemek, operatörü ne yaptığını bilmeden onaylamaya zorlar.
 */
export type OrganizationStats = {
  memberCount: number;
  adminCount: number;
  branchCount: number;
  auditEventCount: number;
};

function toFiniteInteger(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && Number.isInteger(value) ? value : null;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && Number.isInteger(parsed) ? parsed : null;
  }

  return null;
}

export async function loadOrganizationStats(
  organizationId: string
): Promise<OrganizationStats | null> {
  const { data, error } = await supabase.rpc("platform_organization_stats", {
    target_organization_id: organizationId,
  });

  // Sayı okunamazsa `null` dönüyoruz ve çağıran taraf sayı yerine uyarı
  // gösteriyor. Sıfır göstermek yanıltıcı olurdu: "silinecek hesap yok" diye
  // okunup dolu bir kurum kolayca silinebilirdi.
  if (error || !data) {
    return null;
  }

  const payload = data as Record<string, unknown>;
  const memberCount = toFiniteInteger(payload.member_count);
  const adminCount = toFiniteInteger(payload.admin_count);
  const branchCount = toFiniteInteger(payload.branch_count);
  const auditEventCount = toFiniteInteger(payload.audit_event_count);

  if (
    memberCount === null ||
    adminCount === null ||
    branchCount === null ||
    auditEventCount === null
  ) {
    return null;
  }

  return {
    memberCount,
    adminCount,
    branchCount,
    auditEventCount,
  };
}
