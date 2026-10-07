import type { IssuedCredentials } from "@/components/credentials/IssuedCredentials";
import { userFacingErrorText } from "@/lib/userFacingError";
import type { EducationRole } from "@/components/educationAccess";
import { supabase } from "@/lib/supabaseClient";

export type MemberStatus = "invited" | "active" | "suspended";
export type CreatableMemberRole = Exclude<EducationRole, "admin">;
export type MemberRole = EducationRole;

export type LinkedPersonInfo = {
  type: "student" | "guardian";
  id: string;
  name: string;
};

export type OrganizationMember = {
  membershipId: string;
  displayName: string | null;
  loginNumber: string | null;
  role: EducationRole;
  branchName: string | null;
  status: MemberStatus;
  linkedPerson?: LinkedPersonInfo | null;
};

const educationRoles = new Set<EducationRole>([
  "admin",
  "teacher",
  "student",
  "parent",
]);

export function isEducationRole(value: string): value is EducationRole {
  return educationRoles.has(value as EducationRole);
}

const memberStatuses = new Set<MemberStatus>([
  "invited",
  "active",
  "suspended",
]);

export function isMemberStatus(value: string): value is MemberStatus {
  return memberStatuses.has(value as MemberStatus);
}

const ROLE_ORDER: Record<EducationRole, number> = {
  admin: 1,
  teacher: 2,
  student: 3,
  parent: 4,
};

/**
 * Giriş numarasını formatlar.
 *
 * Kurum kodu ve kişi kodu mevcutsa ikisini birleştirerek 8 haneli numarayı üretir.
 * İkisinden biri yoksa (null veya undefined), uydurulmuş bir numara üretmek yerine
 * null döner (K-03).
 */
export function formatLoginNumber(
  organizationCode: number | null | undefined,
  personCode: number | null | undefined
): string | null {
  if (
    organizationCode === null ||
    organizationCode === undefined ||
    personCode === null ||
    personCode === undefined
  ) {
    return null;
  }

  return `${organizationCode}${personCode}`;
}

/**
 * Üyeleri rol ve ad hiyerarşisine göre sıralar:
 * 1. Rol sırası: admin -> teacher -> student -> parent
 * 2. Aynı roldeki üyeler: Türkçe ada göre alfabetik sıralama (A -> Z).
 *    Adı okunamayan (null) kayıtlar kendi rol grubunun sonunda yer alır.
 */
export function sortMembers(
  members: OrganizationMember[]
): OrganizationMember[] {
  return [...members].sort((a, b) => {
    const orderA = ROLE_ORDER[a.role] ?? 99;
    const orderB = ROLE_ORDER[b.role] ?? 99;
    if (orderA !== orderB) {
      return orderA - orderB;
    }

    // Adı okunamayanlar (null) kendi rol grubunun en sonuna gider (K-03 / K-09).
    if (a.displayName === null && b.displayName === null) {
      return 0;
    }
    if (a.displayName === null) {
      return 1;
    }
    if (b.displayName === null) {
      return -1;
    }

    return a.displayName.localeCompare(b.displayName, "tr");
  });
}

type MembershipQueryRow = {
  id: string;
  user_id: string;
  branch_id: string | null;
  person_code: number | null;
  role: string;
  status: string;
};

/**
 * Kurumun tüm üyelerini yükler ve sıralı olarak döndürür.
 *
 * Okuma kullanıcının kendi oturumuyla yapılır; RLS politikaları (#100)
 * kurum yöneticisinin yalnızca kendi kurum üyelerini görmesini garanti eder.
 *
 * Hata durumlarında boş liste döndürülmez veya hata yutulmaz; kullanıcıya
 * ve çağıran bileşene hata fırlatılır.
 */
export async function loadOrganizationMembers(
  organizationId: string,
  organizationCode: number | null
): Promise<OrganizationMember[]> {
  const { data: memberships, error: membershipsError } = await supabase
    .from("organization_memberships")
    .select("id, user_id, branch_id, person_code, role, status")
    .eq("organization_id", organizationId);

  if (membershipsError) {
    throw new Error("Kurum üyeleri yüklenemedi. Lütfen tekrar deneyin.");
  }

  const rows: MembershipQueryRow[] = memberships ?? [];
  if (rows.length === 0) {
    return [];
  }

  // user_id ve branch_id listelerini tekilleştir
  const userIds = rows
    .map(r => r.user_id)
    .filter((id, index, arr) => arr.indexOf(id) === index);
  const branchIds = rows
    .map(r => r.branch_id)
    .filter((id): id is string => Boolean(id))
    .filter((id, index, arr) => arr.indexOf(id) === index);

  const studentUserIds = rows
    .filter(r => r.role === "student")
    .map(r => r.user_id)
    .filter((id, index, arr) => arr.indexOf(id) === index);

  const parentUserIds = rows
    .filter(r => r.role === "parent")
    .map(r => r.user_id)
    .filter((id, index, arr) => arr.indexOf(id) === index);

  const [profilesResult, branchesResult, studentsResult, guardiansResult] =
    await Promise.all([
      userIds.length > 0
        ? supabase.from("profiles").select("id, display_name").in("id", userIds)
        : Promise.resolve({ data: [], error: null }),
      branchIds.length > 0
        ? supabase.from("branches").select("id, name").in("id", branchIds)
        : Promise.resolve({ data: [], error: null }),
      studentUserIds.length > 0
        ? supabase
            .from("students")
            .select("id, full_name, auth_user_id")
            .eq("organization_id", organizationId)
            .is("archived_at", null)
            .in("auth_user_id", studentUserIds)
        : Promise.resolve({ data: [], error: null }),
      parentUserIds.length > 0
        ? supabase
            .from("guardians")
            .select("id, full_name, auth_user_id")
            .eq("organization_id", organizationId)
            .is("archived_at", null)
            .in("auth_user_id", parentUserIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (profilesResult.error) {
    throw new Error("Üye profilleri yüklenemedi. Lütfen tekrar deneyin.");
  }

  if (branchesResult.error) {
    throw new Error("Şube bilgileri yüklenemedi. Lütfen tekrar deneyin.");
  }

  if (studentsResult.error) {
    throw new Error(
      "Öğrenci bağlantı bilgileri yüklenemedi. Lütfen tekrar deneyin."
    );
  }

  if (guardiansResult.error) {
    throw new Error(
      "Veli bağlantı bilgileri yüklenemedi. Lütfen tekrar deneyin."
    );
  }

  const profileMap = new Map<string, string>(
    (profilesResult.data ?? []).map(p => [p.id, p.display_name])
  );
  const branchMap = new Map<string, string>(
    (branchesResult.data ?? []).map(b => [b.id, b.name])
  );
  const studentMap = new Map<string, { id: string; name: string }>();
  for (const s of (studentsResult.data ?? []) as {
    id: string;
    full_name: string;
    auth_user_id: string | null;
  }[]) {
    if (s.auth_user_id) {
      studentMap.set(s.auth_user_id, { id: s.id, name: s.full_name });
    }
  }

  const guardianMap = new Map<string, { id: string; name: string }>();
  for (const g of (guardiansResult.data ?? []) as {
    id: string;
    full_name: string;
    auth_user_id: string | null;
  }[]) {
    if (g.auth_user_id) {
      guardianMap.set(g.auth_user_id, { id: g.id, name: g.full_name });
    }
  }

  const members: OrganizationMember[] = rows.map(row => {
    if (!isEducationRole(row.role)) {
      throw new Error("Kurum üyeliğinde tanınmayan bir rol bulundu.");
    }

    if (!isMemberStatus(row.status)) {
      throw new Error("Kurum üyeliğinde tanınmayan bir durum bulundu.");
    }

    // Profil satırı yoksa null atanır; "İsimsiz Üye" gibi uydurulmuş bir değer
    // kullanılmaz (K-03 / K-09).
    const profileName = profileMap.get(row.user_id);
    const displayName = profileName !== undefined ? profileName : null;

    const branchName = row.branch_id
      ? (branchMap.get(row.branch_id) ?? null)
      : null;

    let linkedPerson: LinkedPersonInfo | null | undefined = undefined;
    if (row.role === "student") {
      const s = studentMap.get(row.user_id);
      linkedPerson = s ? { type: "student", id: s.id, name: s.name } : null;
    } else if (row.role === "parent") {
      const g = guardianMap.get(row.user_id);
      linkedPerson = g ? { type: "guardian", id: g.id, name: g.name } : null;
    }

    return {
      membershipId: row.id,
      displayName,
      loginNumber: formatLoginNumber(organizationCode, row.person_code),
      role: row.role,
      branchName,
      status: row.status,
      linkedPerson,
    };
  });

  return sortMembers(members);
}

const MEMBER_ERROR_MESSAGES: Record<string, string> = {
  unauthorized: "Oturumunuz düşmüş görünüyor. Tekrar giriş yapın.",
  forbidden:
    "Bu işlem için kurum yöneticisi yetkisi gerekiyor veya üye bulunamadı.",
  invalid_input: "Geçersiz üyelik bilgisi gönderildi.",
  lookup_failed: "Üye yetkilendirmesi doğrulanamadı. Lütfen tekrar deneyin.",
  password_update_failed: "Yeni şifre kaydedilemedi. Lütfen tekrar deneyin.",
  service_unavailable:
    "Servis şu anda yanıt vermiyor. Birkaç dakika sonra tekrar deneyin.",
  password_change_required:
    "Bu işlemi yapmadan önce şifrenizi değiştirmeniz gerekiyor. Çıkış yapıp yeni şifre belirleyin.",
  origin_not_allowed: "Bu adres sunucu tarafında izinli değil.",
  member_create_failed:
    "Üye oluşturulamadı. Bilgileri kontrol edip tekrar deneyin.",
};

export type FunctionErrorPayload = {
  error?: string;
  code?: string;
  detail?: string | null;
  hint?: string | null;
};

async function readFunctionErrorPayload(
  error: unknown
): Promise<FunctionErrorPayload | undefined> {
  const context = (error as { context?: { json?: () => Promise<unknown> } })
    ?.context;

  if (!context?.json) {
    console.error(
      "[memberService] edge function failed",
      (error as Error | null)?.message
    );
    return undefined;
  }

  try {
    const body = (await context.json()) as FunctionErrorPayload;
    return body;
  } catch {
    return undefined;
  }
}

async function readFunctionErrorCode(error: unknown): Promise<unknown> {
  const payload = await readFunctionErrorPayload(error);
  return payload?.error;
}

export function memberErrorMessage(code: unknown, fallback: string): string {
  if (typeof code === "string" && code in MEMBER_ERROR_MESSAGES) {
    return MEMBER_ERROR_MESSAGES[code];
  }
  return fallback;
}

export class MembershipActionError extends Error {
  readonly code?: string;
  readonly detail?: string | null;
  readonly hint?: string | null;
  readonly isNeutralInfo: boolean;

  constructor(
    message: string,
    options?: {
      code?: string;
      detail?: string | null;
      hint?: string | null;
      isNeutralInfo?: boolean;
    }
  ) {
    super(message);
    this.name = "MembershipActionError";
    this.code = options?.code;
    this.detail = options?.detail;
    this.hint = options?.hint;
    this.isNeutralInfo = Boolean(options?.isNeutralInfo);
  }
}

/**
 * ORB03 tetikleyici hatasının detayını ayrıştırır ve Türkçe insan dostu cümleye çevirir.
 * Ham detail dizgesini ('ders ataması=2, rehberlik=1...') doğrudan kullanıcıya basmaz (K-23).
 */
function formatORB03Message(detail?: string | null): string {
  if (!detail) {
    return "Bu üyenin üzerinde ayakta duran ders veya rehberlik ataması bulunuyor. Rolü değiştirmek için önce sınıf yönetiminden ilgili atamaları arşivleyin.";
  }

  const classMatch = detail.match(/ders atamas[ıi]=(\d+)/i);
  const mentorMatch = detail.match(/rehberlik=(\d+)/i);
  const scheduleMatch = detail.match(/program sat[ıi]r[ıi]=(\d+)/i);

  const classes = classMatch ? parseInt(classMatch[1], 10) : 0;
  const mentors = mentorMatch ? parseInt(mentorMatch[1], 10) : 0;
  const schedules = scheduleMatch ? parseInt(scheduleMatch[1], 10) : 0;

  const parts: string[] = [];
  if (classes > 0) parts.push(`${classes} ders ataması`);
  if (mentors > 0) parts.push(`${mentors} rehberlik görevi`);
  if (schedules > 0) parts.push(`${schedules} ders programı satırı`);

  if (parts.length > 0) {
    return `Bu üyenin üzerinde aktif ${parts.join(", ")} bulunuyor. Rolü değiştirmek için önce sınıf yönetiminden ilgili atamaları arşivleyin.`;
  }

  return "Bu üyenin üzerinde ayakta duran ders veya rehberlik ataması bulunuyor. Rolü değiştirmek için önce sınıf yönetiminden ilgili atamaları arşivleyin.";
}

/**
 * Üye işlemleri (rol değiştirme ve çıkarma) Edge Function hatalarını
 * kullanıcının düzeltebileceği Türkçe cümlelere çevirir (#280, #282).
 */
export type MembershipActionErrorContext = {
  isSelf?: boolean;
  targetName?: string | null;
};

export function translateMembershipActionError(
  err: unknown,
  action?: "change_role" | "remove",
  context?: MembershipActionErrorContext
): string {
  if (err instanceof MembershipActionError) {
    return err.message;
  }

  const payload =
    typeof err === "object" && err !== null && "error" in err
      ? (err as FunctionErrorPayload)
      : undefined;

  const code = payload?.code ?? (err as { code?: string })?.code;
  const errorName =
    payload?.error ??
    (err as { error?: string })?.error ??
    (err as Error)?.message;
  const detail = payload?.detail ?? (err as { detail?: string | null })?.detail;
  const hint = payload?.hint ?? (err as { hint?: string | null })?.hint;

  if (code === "ORB03") {
    return formatORB03Message(detail);
  }

  if (code === "ORB06") {
    const isSelf = context?.isSelf ?? true;
    if (action === "remove") {
      return "Kurumun tek yöneticisi kurumdan çıkarılamaz. Önce başka bir üyeyi yönetici yapın.";
    }
    if (isSelf) {
      return "Kurumun tek yöneticisisiniz. Rolünüzü değiştirmeden önce başka bir üyeyi yönetici yapın.";
    }
    return "Kurumun tek yöneticisinin rolü değiştirilemez. Önce başka bir üyeyi yönetici yapın.";
  }

  if (code === "ORB04") {
    if (
      action === "change_role" ||
      hint?.includes("Rol zaten") ||
      hint?.includes("değerde")
    ) {
      return "Rol zaten bu değerde; herhangi bir değişiklik yapılmadı.";
    }
    if (
      action === "remove" ||
      hint?.includes("çıkarılmış") ||
      hint?.includes("suspended")
    ) {
      return "Bu üyelik zaten kurumdan çıkarılmış durumda.";
    }
    return hint || "Hedeflenen durum zaten sağlanmış durumda.";
  }

  if (code === "42501") {
    if (
      hint?.includes("devri") ||
      hint?.includes("administrator") ||
      errorName?.includes("admin")
    ) {
      return "Kurum yöneticilerinin rolü buradan değiştirilemez veya kurumdan çıkarılamaz. Yönetici devri ayrı bir işlemdir.";
    }
    return "Bu işlem için kurum yöneticisi yetkisi gerekiyor.";
  }

  if (code === "23503") {
    return "Üyelik kaydı bulunamadı.";
  }

  if (
    errorName === "request_in_progress" ||
    errorName?.includes("request_in_progress")
  ) {
    return "İşlem şu anda devam ediyor. Lütfen birkaç saniye sonra tekrar deneyin.";
  }

  if (
    errorName === "password_change_required" ||
    errorName?.includes("password_change_required")
  ) {
    return "Bu işlemi yapmadan önce şifrenizi değiştirmeniz gerekiyor. Çıkış yapıp yeni şifre belirleyin.";
  }

  if (errorName === "rate_limited" || errorName?.includes("rate_limited")) {
    return "Çok fazla istek gönderildi. Lütfen biraz bekleyip tekrar deneyin.";
  }

  if (errorName === "unauthorized" || errorName?.includes("unauthorized")) {
    return "Oturumunuz düşmüş görünüyor. Tekrar giriş yapın.";
  }

  if (
    errorName === "service_unavailable" ||
    errorName?.includes("service_unavailable")
  ) {
    return "Servis şu anda yanıt vermiyor. Birkaç dakika sonra tekrar deneyin.";
  }

  // Türkçe veritabanı uyarısı ve ağ hatası gösterilir; İngilizce teknik
  // metin gösterilmez (B6, 2026-10-07 — `lib/userFacingError.ts`).
  const shown = userFacingErrorText(err);
  if (shown) {
    return shown;
  }

  return "İşlem gerçekleştirilemedi. Lütfen tekrar deneyin.";
}

export function isNeutralMembershipInfo(err: unknown): boolean {
  if (err instanceof MembershipActionError) {
    return err.isNeutralInfo;
  }
  const code =
    (err as { code?: string })?.code ?? (err as { error?: string })?.error;
  return code === "ORB04";
}

/**
 * Arayüzdeki şube seçim anahtarını sunucu sözleşmesindeki branchId değerine dönüştürür.
 *
 * Sunucu sözleşmesinde (`create-member` ve `internal_create_membership`):
 * - `null`: Kurum geneli yetkisi (tüm şubeleri görür)
 * - `"<uuid>"`: Yalnızca ilgili şubeye bağlı yetki
 *
 * Arayüzde "henüz seçim yapılmadı" durumunu sunucudaki "kurum geneli" (null)
 * ile karıştırmamak için üçüncü durum `undefined` olarak çözümlenir (K-03 / K-04).
 *
 * - `""` veya `undefined` -> `undefined` (seçim henüz yapılmadı, form gönderilemez)
 * - `"__all__"` -> `null` (kurum geneli seçildi)
 * - `"<id>"` -> `"<id>"` (belirli şube seçildi)
 */
export function resolveBranchSelection(
  selection: string | null | undefined
): string | null | undefined {
  if (selection === undefined || selection === null || selection === "") {
    return undefined;
  }
  if (selection === "__all__") {
    return null;
  }
  return selection;
}

export async function createMember(
  input: {
    fullName: string;
    role: Exclude<EducationRole, "admin">;
    branchId: string | null;
  },
  /**
   * Aynı işlemin tekrarını sunucuya tanıtan anahtar (v1.2-17).
   *
   * **Değeri, çağıranın onu saklamasından geliyor.** Her denemede yeni bir
   * anahtar üretilirse koruma hiçbir şey yapmaz: sunucu iki farklı istek
   * görür. Anahtar, kullanıcının *aynı* eylemi tekrar denemesi boyunca sabit
   * kalmalı — `MemberCreateDialog` bunu bir `ref`te tutuyor.
   */
  idempotencyKey?: string
): Promise<IssuedCredentials> {
  const { data, error } = await supabase.functions.invoke("create-member", {
    body: {
      fullName: input.fullName.trim(),
      role: input.role,
      branchId: input.branchId,
    },
    ...(idempotencyKey
      ? { headers: { "Idempotency-Key": idempotencyKey } }
      : {}),
  });

  if (error) {
    throw new Error(
      memberErrorMessage(
        await readFunctionErrorCode(error),
        "Üye oluşturulamadı. Bilgileri kontrol edip tekrar deneyin."
      )
    );
  }

  const payload = (data as { data?: Record<string, unknown> } | null)?.data;
  const loginNumber = payload?.login_number;
  const temporaryPassword = payload?.temporary_password;
  const passwordLockSet =
    typeof payload?.password_lock_set === "boolean"
      ? payload.password_lock_set
      : undefined;
  const auditWritten =
    typeof payload?.audit_written === "boolean"
      ? payload.audit_written
      : undefined;

  if (payload?.replayed === true) {
    // Sunucu bu anahtarı daha önce görmüş: iş **yapıldı**, ikinci kez
    // yapılmadı. Geçici şifre dönmüyor çünkü hiçbir yere yazılmadı — mesaj
    // bunu saklamak yerine ne yapılacağını söylüyor (K-03, K-14).
    const numara =
      typeof payload.login_number === "string"
        ? ` (giriş no ${payload.login_number})`
        : "";
    throw new Error(
      `Bu istek zaten işlenmişti${numara}. Üye ikinci kez oluşturulmadı ve ` +
        "geçici şifre yeniden gösterilemez; görmek için üye satırından " +
        "şifreyi sıfırlayın."
    );
  }

  if (
    typeof loginNumber !== "string" ||
    typeof temporaryPassword !== "string"
  ) {
    throw new Error(
      "Üye oluşturuldu ancak yanıt okunamadı. İşlemi tekrarlamayın; önce üyeler listesini kontrol edin."
    );
  }

  return {
    loginNumber,
    temporaryPassword,
    passwordLockSet,
    auditWritten,
    membershipId:
      typeof payload?.membership_id === "string"
        ? payload.membership_id
        : undefined,
  };
}

/**
 * Kurumdaki bir üyenin şifresini sıfırlar ve yeni geçici şifre üretir.
 *
 * Bu işlem kurum yöneticisi tarafından çağrılır (`reset-member-password`
 * Edge Function). Üretilen geçici şifre veritabanında saklanmaz, yalnızca
 * bu yanıtta bir kez döner.
 */
export async function resetMemberPassword(
  membershipId: string,
  /** Bkz. `createMember` — anahtarın işe yaraması onu saklamaya bağlı. */
  idempotencyKey?: string
): Promise<IssuedCredentials> {
  const { data, error } = await supabase.functions.invoke(
    "reset-member-password",
    {
      body: { membershipId },
      ...(idempotencyKey
        ? { headers: { "Idempotency-Key": idempotencyKey } }
        : {}),
    }
  );

  if (error) {
    throw new Error(
      memberErrorMessage(
        await readFunctionErrorCode(error),
        "Yeni şifre üretilemedi. Lütfen tekrar deneyin."
      )
    );
  }

  const payload = (data as { data?: Record<string, unknown> } | null)?.data;
  const loginNumber = payload?.login_number;
  const temporaryPassword = payload?.temporary_password;
  const passwordLockSet =
    typeof payload?.password_lock_set === "boolean"
      ? payload.password_lock_set
      : undefined;
  const auditWritten =
    typeof payload?.audit_written === "boolean"
      ? payload.audit_written
      : undefined;

  if (payload?.replayed === true) {
    // Sunucu bu anahtarı daha önce görmüş: iş **yapıldı**, ikinci kez
    // yapılmadı. Geçici şifre dönmüyor çünkü hiçbir yere yazılmadı — mesaj
    // bunu saklamak yerine ne yapılacağını söylüyor (K-03, K-14).
    const numara =
      typeof payload.login_number === "string"
        ? ` (giriş no ${payload.login_number})`
        : "";
    throw new Error(
      `Bu istek zaten işlenmişti${numara}. Şifre ikinci kez sıfırlanmadı; ` +
        "elinizdeki fiş geçerli. Fişi kaybettiyseniz sıfırlamayı yeniden " +
        "başlatın."
    );
  }

  // Şifre sunucuda zaten değişti. Yanıtı okuyamazsak sessizce başarılı
  // dönmek, kimsenin bilmediği bir şifreyle hesabı büsbütün kilitlemek
  // olurdu.
  if (
    typeof loginNumber !== "string" ||
    typeof temporaryPassword !== "string"
  ) {
    throw new Error(
      "Şifre sıfırlandı ancak yanıt okunamadı. İşlemi tekrarlayın; yeni şifre üretilecektir."
    );
  }

  return {
    loginNumber,
    temporaryPassword,
    passwordLockSet,
    auditWritten,
  };
}

export type ChangeMemberRoleResult = {
  roleChanged: boolean;
  role: MemberRole;
};

/**
 * Kurumdaki bir üyenin rolünü değiştirir (v1.4-07 · #280, v1.4-08 · #282).
 *
 * Yönetici devri ve çoklu yönetici meşrudur; terfi veya kendini indirme
 * bu fonksiyondan yürütülür. Tek kısıt: son aktif yönetici indirilemez (ORB06).
 *
 * Yazma RLS ile değil, 'change-member-role' Edge Function üzerinden yürütülür.
 */
export async function changeMemberRole(
  membershipId: string,
  role: EducationRole,
  idempotencyKey?: string
): Promise<ChangeMemberRoleResult> {
  const { data, error } = await supabase.functions.invoke(
    "change-member-role",
    {
      body: { membershipId, role },
      ...(idempotencyKey
        ? { headers: { "Idempotency-Key": idempotencyKey } }
        : {}),
    }
  );

  if (error) {
    const payload = await readFunctionErrorPayload(error);
    const code = payload?.code;
    const isNeutral = code === "ORB04";
    const message = translateMembershipActionError(
      payload ?? error,
      "change_role"
    );
    throw new MembershipActionError(message, {
      code: payload?.code,
      detail: payload?.detail,
      hint: payload?.hint,
      isNeutralInfo: isNeutral,
    });
  }

  const dataObj = data as {
    data?: { role_changed?: boolean; role?: MemberRole };
    error?: string;
    code?: string;
    detail?: string | null;
    hint?: string | null;
  } | null;

  if (dataObj?.error && !dataObj.data) {
    const isNeutral = dataObj.code === "ORB04";
    const message = translateMembershipActionError(dataObj, "change_role");
    throw new MembershipActionError(message, {
      code: dataObj.code,
      detail: dataObj.detail,
      hint: dataObj.hint,
      isNeutralInfo: isNeutral,
    });
  }

  const payload = dataObj?.data;

  return {
    roleChanged: payload?.role_changed ?? true,
    role: payload?.role ?? role,
  };
}

export type RemoveMemberResult = {
  removed: boolean;
  role: string;
  unlinkedStudentId: string | null;
  unlinkedGuardianId: string | null;
};

/**
 * Bir üyeliği kurumdan çıkarır (status = suspended) (v1.4-07 · #280).
 *
 * DELETE yapılmaz (FK'lar RESTRICT).
 * Öğrenci ve velide EK OLARAK akademik kaydın hesap bağı koparılır (auth_user_id = null).
 * Yönetici çıkarılamaz (v1.4-08).
 *
 * Yazma RLS ile değil, 'remove-member' Edge Function üzerinden yürütülür.
 */
export async function removeMember(
  membershipId: string,
  idempotencyKey?: string
): Promise<RemoveMemberResult> {
  const { data, error } = await supabase.functions.invoke("remove-member", {
    body: { membershipId },
    ...(idempotencyKey
      ? { headers: { "Idempotency-Key": idempotencyKey } }
      : {}),
  });

  if (error) {
    const payload = await readFunctionErrorPayload(error);
    const code = payload?.code;
    const isNeutral = code === "ORB04";
    const message = translateMembershipActionError(payload ?? error, "remove");
    throw new MembershipActionError(message, {
      code: payload?.code,
      detail: payload?.detail,
      hint: payload?.hint,
      isNeutralInfo: isNeutral,
    });
  }

  const dataObj = data as {
    data?: {
      removed?: boolean;
      role?: string;
      unlinked_student_id?: string | null;
      unlinked_guardian_id?: string | null;
    };
    error?: string;
    code?: string;
    detail?: string | null;
    hint?: string | null;
  } | null;

  if (dataObj?.error && !dataObj.data) {
    const isNeutral = dataObj.code === "ORB04";
    const message = translateMembershipActionError(dataObj, "remove");
    throw new MembershipActionError(message, {
      code: dataObj.code,
      detail: dataObj.detail,
      hint: dataObj.hint,
      isNeutralInfo: isNeutral,
    });
  }

  const outcome = dataObj?.data;

  return {
    removed: outcome?.removed ?? true,
    role: outcome?.role ?? "",
    unlinkedStudentId: outcome?.unlinked_student_id ?? null,
    unlinkedGuardianId: outcome?.unlinked_guardian_id ?? null,
  };
}
