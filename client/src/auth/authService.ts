import type { User } from "@supabase/supabase-js";
import type { EducationRole } from "@/components/educationAccess";
import { supabase } from "@/lib/supabaseClient";
import type {
  AuthIdentity,
  MembershipIdentity,
  PlatformOperatorIdentity,
} from "./types";

const educationRoles = new Set<EducationRole>([
  "admin",
  "teacher",
  "student",
  "parent",
]);

type MembershipRow = {
  id: string;
  organization_id: string;
  branch_id: string | null;
  role: string;
};

export function isEducationRole(value: string): value is EducationRole {
  return educationRoles.has(value as EducationRole);
}

function displayNameFromUser(user: User): string {
  const metadataName = user.user_metadata.full_name;

  if (typeof metadataName === "string" && metadataName.trim()) {
    return metadataName.trim();
  }

  return user.email?.split("@")[0] || "ORBIT Kullanıcısı";
}

/**
 * Kullanıcının aktif kurum üyeliğini çözer. Üyelik yoksa `null` döner; bu bir
 * hata değildir, platform operatörünün tasarım gereği üyeliği yoktur.
 */
async function loadMembershipIdentity(
  userId: string
): Promise<{ identity: MembershipIdentity; closed: boolean } | null> {
  const { data: membership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("id, organization_id, branch_id, role")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<MembershipRow>();

  if (membershipError) {
    throw new Error("Kurum üyeliği doğrulanamadı. Lütfen tekrar deneyin.");
  }

  if (!membership) {
    return null;
  }

  // Rol veritabanından geliyor ama yine de doğrulanıyor: beklenmeyen bir değer
  // sessizce yetki gibi davranmamalı.
  if (!isEducationRole(membership.role)) {
    throw new Error("Kurum üyeliğindeki rol tanınmadı.");
  }

  const [organizationResult, branchResult] = await Promise.all([
    supabase
      .from("organizations")
      .select("name, code, archived_at")
      .eq("id", membership.organization_id)
      .single<{
        name: string;
        code: number | null;
        archived_at: string | null;
      }>(),
    membership.branch_id
      ? supabase
          .from("branches")
          .select("id, name")
          .eq("id", membership.branch_id)
          .single<{ id: string; name: string }>()
      : supabase
          .from("branches")
          .select("id, name")
          .eq("organization_id", membership.organization_id)
          .eq("is_default", true)
          .is("archived_at", null)
          .maybeSingle<{ id: string; name: string }>(),
  ]);

  if (organizationResult.error || branchResult.error) {
    throw new Error("Kurum veya şube bilgisi güvenli şekilde yüklenemedi.");
  }

  return {
    identity: {
      membershipId: membership.id,
      role: membership.role,
      organizationId: membership.organization_id,
      organizationName: organizationResult.data.name,
      organizationCode: organizationResult.data.code,
      branchId: branchResult.data?.id ?? membership.branch_id,
      branchName: branchResult.data?.name ?? null,
    },
    closed: Boolean(organizationResult.data.archived_at),
  };
}

/**
 * Kurum platform operatörü tarafından kapatıldığında (ana plan 2.5,
 * 2026-10-25) gösterilen cümle. Kilit sunucuda: kapalı kurumun kullanıcısı
 * hiçbir tablodan satır okuyamaz (`current_user_must_change_password`). Bu
 * kontrol yalnız kullanıcıya boş bir panel ya da yanlış bir "şifrenizi
 * değiştirin" ekranı yerine doğru sebebi göstermek içindir.
 */
export const ORGANIZATION_CLOSED_MESSAGE =
  "Kurumunuzun ORBIT kullanımı kapatıldı. Bilgi için kurumunuzla iletişime geçin.";

/**
 * Kullanıcının platform operatörlüğünü çözer. Operatör değilse `null` döner.
 *
 * Sorgu kullanıcının kendi oturumuyla yapılır; `platform_operators` üzerindeki
 * RLS, operatör olmayan birine hiçbir satır göstermez. Bu nedenle "operatör
 * değil" ile "satır yok" aynı sonuca varır ve ayrıcalıklı bir istemci
 * gerekmez.
 */
async function loadPlatformOperatorIdentity(
  userId: string
): Promise<PlatformOperatorIdentity | null> {
  const { data, error } = await supabase
    .from("platform_operators")
    .select("role")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle<{ role: "owner" | "operator" }>();

  if (error) {
    throw new Error("Platform yetkisi doğrulanamadı. Lütfen tekrar deneyin.");
  }

  return data ? { role: data.role } : null;
}

type ProfileRow = {
  display_name: string | null;
  must_change_password: boolean;
  password_expires_at: string | null;
  recovery_email: string | null;
};

/**
 * İki deneme arasındaki bekleme. Gecikmesiz bir tekrar, aynı milisaniyede aynı
 * hataya çarpar ve hiçbir şey kazandırmaz; bu kadarlık bir pay bağlantının
 * toparlanmasına yeter ve yalnızca hata yolunda ödenir.
 */
const PROFILE_RETRY_DELAY_MS = 300;

function readProfileRow(userId: string) {
  return supabase
    .from("profiles")
    .select(
      "display_name, must_change_password, password_expires_at, recovery_email"
    )
    .eq("id", userId)
    .maybeSingle<ProfileRow>();
}

/**
 * Profil satırını okur. Geçici ağ hatalarına ve soğuk başlangıç dalgalanmalarına
 * karşı bir kez sessizce yeniden dener. Yeniden deneme yalnızca hata (`error`)
 * durumunda çalışır; satırın bulunamaması (boş dönmesi) geçici bir arıza olmadığı
 * için tekrar denenmez.
 */
async function fetchProfileWithRetry(userId: string) {
  const result = await readProfileRow(userId);

  if (!result.error) {
    return result;
  }

  await new Promise(resolve =>
    globalThis.setTimeout(resolve, PROFILE_RETRY_DELAY_MS)
  );

  return readProfileRow(userId);
}

/**
 * Oturumu açık kullanıcının kimliğini çözer.
 *
 * İki eksen de sorgulanır ve ikisi birden boşsa hata fırlatılır. Yalnızca
 * üyeliğe bakılsaydı, tasarım gereği üyeliği olmayan platform operatörü giriş
 * yapar yapmaz oturumdan atılırdı.
 */
export async function loadAuthenticatedIdentity(
  user: User
): Promise<AuthIdentity> {
  const [resolvedMembership, platformOperator] = await Promise.all([
    loadMembershipIdentity(user.id),
    loadPlatformOperatorIdentity(user.id),
  ]);

  // Operatör kapalı kurum yüzünden kilitlenmez (sunucu da öyle); yalnız o
  // kurumun paneli ona gösterilmez.
  if (resolvedMembership?.closed && !platformOperator) {
    throw new Error(ORGANIZATION_CLOSED_MESSAGE);
  }
  const membership = resolvedMembership?.closed
    ? null
    : (resolvedMembership?.identity ?? null);

  if (!membership && !platformOperator) {
    throw new Error(
      "Bu hesap için aktif bir ORBIT kurum üyeliği veya platform yetkisi bulunamadı."
    );
  }

  const profileResult = await fetchProfileWithRetry(user.id);

  // Profil okunamazsa (ağ hatası veya eksik satır) fail-closed kalınarak
  // "unresolved" durumuna geçilir. Bu durum panele girişi engeller (K-04),
  // ancak kullanıcının şifresini değiştirmeye zorlanması yerine bilgilendirme
  // ve tekrar deneme ekranına düşmesini sağlar.
  const passwordLock = profileResult.data
    ? profileResult.data.must_change_password
      ? "required"
      : "clear"
    : "unresolved";

  // Kurtarma e-postası bilgisi profil tablosundan çözülür. Profil okunamadıysa
  // "kurtarma yöntemi yok" demek yanlış bir iddia olacağı için (K-03 / K-04)
  // durum "unresolved" olarak işaretlenir.
  const recoveryChannel = profileResult.data
    ? profileResult.data.recovery_email &&
      profileResult.data.recovery_email.trim().length > 0
      ? "configured"
      : "missing"
    : "unresolved";

  const recoveryEmail = profileResult.data?.recovery_email?.trim() || null;

  return {
    userId: user.id,
    displayName:
      profileResult.data?.display_name?.trim() || displayNameFromUser(user),
    demo: false,
    passwordLock,
    passwordExpiresAt: profileResult.data?.password_expires_at ?? null,
    recoveryChannel,
    recoveryEmail,
    membership,
    platformOperator,
  };
}
