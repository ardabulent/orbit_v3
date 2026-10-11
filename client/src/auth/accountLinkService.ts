import { useContext } from "react";
import { userFacingErrorText } from "@/lib/userFacingError";
import { createClient } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "@/lib/supabaseClient";
import { isDemoMode } from "@/auth/runtime";
import { AuthContext } from "@/auth/AuthContext";
import type { EducationRole } from "@/components/educationAccess";
import { useQuery } from "@tanstack/react-query";

export interface LinkedAccount {
  userId: string;
  displayName: string;
  role: EducationRole;
  organizationId: string;
  organizationName: string;
  isCurrent: boolean;
}

export interface ParkedSession {
  access_token: string;
  refresh_token: string;
}

export const PARKED_SESSION_KEY = "orbit:parked-session";

/**
 * `link_accounts` RPC'sinin `details` makine etiketlerine göre kullanıcıya
 * gösterilecek Türkçe hata mesajları.
 *
 * ⚠️ `details` çoğuldur (`error.details`), `detail` değil. Hata çevirisi servis
 * katmanında yapılır ve `new Error(çeviri)` fırlatılır; ekran katmanı
 * `err.message` okur ve ikinci kez çeviri yapmaz.
 */
export const LINK_ERROR_MESSAGES: Record<string, string> = {
  code_unknown: "Bağlama kodu geçersiz.",
  code_expired: "Bağlama kodunun süresi dolmuş. Yeni bir kod alın.",
  code_consumed: "Bu kod zaten kullanılmış.",
  self_link: "Bir hesabı kendisine bağlayamazsınız.",
  password_not_taken_over:
    "Hesabı bağlamadan önce geçici şifrenizi değiştirin.",
  consumer_without_membership: "Bu hesabın aktif bir üyeliği yok.",
  // ⚠️ Üreten taraf için ayrı etiket: eskiden `issueAccountLinkCode` bunu
  // kendi içinde özel bir `if` ile çeviriyordu. Çeviri tek yerde durur (K-06),
  // yoksa yeni bir etiket eklendiğinde biri güncellenip diğeri unutuluyor —
  // v1.5-07'de tam bu oldu ve servis testi yakaladı.
  issuer_without_membership: "Bu hesabın aktif bir üyeliği yok.",
  already_linked_elsewhere: "Bu hesap başka bir kişi kaydına bağlı.",
  issuer_password_not_taken_over:
    "Bağlama kodu almadan önce geçici şifrenizi değiştirin.",
  not_linked: "Bu hesap başka bir hesaba bağlı değil.",
};

export function translateLinkError(error: {
  details?: string | null;
  message?: string;
}): string {
  const details = error?.details?.trim();
  if (details && details in LINK_ERROR_MESSAGES) {
    return LINK_ERROR_MESSAGES[details];
  }
  return error?.message || "Hesap bağlanamadı.";
}

/**
 * 12 haneli ham bağlama kodunu ekranda okunabilir `XXXX-XXXX-XXXX` biçiminde
 * gruplar.
 */
export function formatLinkCode(code: string): string {
  const clean = code.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const parts = clean.match(/.{1,4}/g);
  return parts ? parts.join("-") : clean;
}

export function getParkedSession(): ParkedSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PARKED_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.access_token === "string" &&
      typeof parsed.refresh_token === "string"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function setParkedSession(session: ParkedSession | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!session) {
      window.sessionStorage.removeItem(PARKED_SESSION_KEY);
    } else {
      window.sessionStorage.setItem(
        PARKED_SESSION_KEY,
        JSON.stringify(session)
      );
    }
  } catch {
    // Gizli sekme veya storage kotası durumunda sessizce geç
  }
}

export function clearParkedSession(): void {
  setParkedSession(null);
}

/**
 * Çağıran hesap için tek kullanımlık bir bağlama kodu üretir.
 *
 * Kod sunucuda hash'lenmiş olarak saklanır; ham hâli yalnız bu fonksiyondan
 * bir kez döner. Aynı hesabın önceki kodlarının süresi sunucuda bitirilir.
 */
export async function issueAccountLinkCode(): Promise<string> {
  const { data, error } = await supabase.rpc("issue_account_link_code");

  if (error) {
    const details = (error as { details?: string | null })?.details?.trim();
    if (details && details in LINK_ERROR_MESSAGES) {
      throw new Error(LINK_ERROR_MESSAGES[details]);
    }
    throw new Error(userFacingErrorText(error) ?? "Bağlama kodu üretilemedi.");
  }

  if (!data || typeof data !== "string") {
    throw new Error("Bağlama kodu alınamadı.");
  }

  return data;
}

/**
 * Çağıran hesabın kişi bağını koparır ve geriye kalan bağlı hesap sayısını
 * döndürür (v1.5-07/B2).
 *
 * 🔴 **Bu yolun var olması bir güvenlik gereğidir, kolaylık değil.** §4.15'te
 * ölçüldü: bağı koparan hiçbir yol yoktu — ne şemada, ne serviste, ne
 * arayüzde. Yanlış kurulmuş bir bağ ancak `service_role` ile elle
 * müdahaleyle çözülebiliyordu, yani projenin kendi kuralının yasakladığı
 * şeyle. Koparma yetkisi **kişinin kendisinde** (karar 2026-09-16): yönetici
 * koparabilse, bağı hatalı kuran kişi izini de temizleyebilirdi.
 *
 * Grup tek hesaba düşerse sunucu bağı tamamen çözer ve `0` döner.
 */
export async function unlinkAccounts(): Promise<number> {
  const { data, error } = await supabase.rpc("unlink_accounts");

  if (error) {
    throw new Error(
      translateLinkError(error as { details?: string | null; message?: string })
    );
  }

  const remaining = Number(data);
  return Number.isFinite(remaining) ? remaining : 0;
}

/**
 * Verilen bağlama kodunu kullanarak çağıran hesabı kodun üreticisiyle aynı
 * kişi kaydına (`people`) bağlar.
 */
export async function linkAccounts(linkCode: string): Promise<string> {
  const normalized = linkCode.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

  if (!normalized) {
    throw new Error("Lütfen bir bağlama kodu girin.");
  }

  const { data, error } = await supabase.rpc("link_accounts", {
    link_code: normalized,
  });

  if (error) {
    throw new Error(translateLinkError(error));
  }

  return data as string;
}

/**
 * Çağıranın kişi kaydına bağlı, aktif üyeliği olan hesapları listeler.
 *
 * Liste, `internal_begin_account_switch`'in kabul edeceği kümenin aynısıdır:
 * üyeliksiz veya pasif hesaplar sunucuda elenir.
 * Tek satır dönüyorsa çağıranın bağlı kardeşi yoktur.
 */
export async function loadLinkedAccounts(): Promise<LinkedAccount[]> {
  const { data, error } = await supabase.rpc("my_linked_accounts");

  if (error) {
    throw new Error(
      userFacingErrorText(error) ?? "Bağlı hesaplar yüklenemedi."
    );
  }

  return (
    (data as Array<{
      user_id: string;
      display_name: string;
      role: string;
      organization_id: string;
      organization_name: string;
      is_current: boolean;
    }> | null) ?? []
  ).map(row => ({
    userId: row.user_id,
    displayName: row.display_name,
    role: row.role as EducationRole,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    isCurrent: Boolean(row.is_current),
  }));
}

/**
 * Kişinin bağlı kardeş hesapları arasında geçiş yapar (v1.4-17).
 *
 * Geçişte:
 * 1. `switch-account` çağrılır, yeni oturum jetonları gelir.
 * 2. **Mevcut oturum** kendi anahtarımıza (`orbit:parked-session`) yazılır.
 * 3. `supabase.auth.setSession(yeni)` ile aktif oturum değişir.
 * 4. Geri dönüşte aynı şey ters yönde yapılır — ama **park edilmiş jetonla değil**,
 *    yine `switch-account` çağrılarak. Sebep: park edilmiş jeton eskimiş
 *    olabilir ve tazelenmesi bizim işimiz değildir.
 *
 * Yani park etme **yalnız hareketsizlik sayacının kapatabilmesi için** vardır,
 * geri dönüş yolu için değil.
 *
 * Güvenlik kuralları:
 * - Jetonu log'a, URL'ye, `localStorage`'a yazma. `sessionStorage` sekme
 *   başına ve sekme kapanınca biter; kararın dayandığı sınır budur.
 * - `switch-account` bilerek sebep vermez (sebebi vermek hesap varlığını sorgulatır).
 *   403 durumunda genel cümle ("Bu hesaba geçiş yapılamadı.") gösterilir;
 *   sunucudan gelen ham hata metni sızdırılmaz.
 */
export async function switchAccount(targetUserId: string): Promise<void> {
  const { data: currentSessionData } = await supabase.auth.getSession();
  const currentSession = currentSessionData?.session;

  const { data, error } = await supabase.functions.invoke("switch-account", {
    body: { targetUserId },
  });

  if (error) {
    const status = (error as { context?: { status?: number } })?.context
      ?.status;
    let errorCode: string | undefined;
    try {
      const body = await (
        error as { context?: { json?: () => Promise<{ error?: string }> } }
      )?.context?.json?.();
      errorCode = body?.error;
    } catch {
      // JSON okunamadıysa sessiz kal
    }

    if (
      status === 403 ||
      errorCode === "switch_refused" ||
      errorCode === "forbidden" ||
      (error as Error).message?.includes("403")
    ) {
      throw new Error("Bu hesaba geçiş yapılamadı.");
    }

    if (errorCode === "request_in_progress") {
      throw new Error("İşlem devam ediyor. Lütfen bekleyin.");
    }

    if (errorCode === "rate_limited") {
      throw new Error("Çok fazla deneme yapıldı. Lütfen biraz bekleyin.");
    }

    throw new Error("Bu hesaba geçiş yapılamadı.");
  }

  const payload = (
    data as {
      data?: { access_token?: string; refresh_token?: string };
    } | null
  )?.data;

  if (!payload?.access_token || !payload?.refresh_token) {
    throw new Error("Bu hesaba geçiş yapılamadı.");
  }

  // 2026-08-25 kararı: mevcut oturum sessionStorage'a park edilir.
  // Park etme YALNIZ hareketsizlik sayacının kapatabilmesi için vardır.
  if (currentSession?.access_token && currentSession?.refresh_token) {
    setParkedSession({
      access_token: currentSession.access_token,
      refresh_token: currentSession.refresh_token,
    });
  }

  const { error: setSessionError } = await supabase.auth.setSession({
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
  });

  if (setSessionError) {
    throw new Error("Yeni oturum başlatılamadı.");
  }
}

export type SecondaryClientFactory = (
  url: string,
  anonKey: string
) => {
  auth: {
    setSession: (tokens: {
      access_token: string;
      refresh_token: string;
    }) => Promise<{ error: unknown }>;
    signOut: () => Promise<{ error: unknown }>;
  };
};

/**
 * Hareketsizlik sayacı tetiklendiğinde veya çıkış yapıldığında park edilmiş
 * oturumu sunucu tarafında da iptal eder (2026-08-25 kararı).
 *
 * Park edilmiş jetonu yalnız sessionStorage'dan silmek yetmez — sunucuda hâlâ
 * geçerli kalır. Bellek-içi depolamayla (`persistSession: false`) ikinci bir
 * Supabase client kurup `setSession(parked)` + `signOut()` çağrılır.
 * Böylece aktif client'ın durumunu bozmadan ikinci oturum gerçekten iptal edilir.
 *
 * Park etme YALNIZ hareketsizlik sayacının kapatabilmesi için vardır, geri
 * dönüş yolu için değil.
 *
 * ⚠️ Güvenlik ve sözleşme kuralları (v1.4-17 Rev 1 / K-04, K-14):
 * - Uydurma / placeholder URL veya anahtar KESİNLİKLE kullanılmaz.
 * - Supabase yapılandırması eksikse (`!supabaseConfigured`) ikinci client
 *   kurulmaz ve durum sessizce yutulmaz; çağırana hata fırlatılır.
 * - Sunucuda kapatma hatası oluşursa sessiz catch içine alınıp gizlenmez;
 *   çağıran (çıkış veya sayaç) işlemin durumunu açıkça bilir.
 */
export async function revokeParkedSession(
  customClientFactory?: SecondaryClientFactory
): Promise<void> {
  const parked = getParkedSession();
  clearParkedSession();
  if (!parked) return;

  if (!customClientFactory && !supabaseConfigured) {
    throw new Error(
      "Park edilmiş oturum kapatılamadı: Supabase yapılandırması eksik."
    );
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const secondaryClient = customClientFactory
    ? customClientFactory(supabaseUrl ?? "", supabaseAnonKey ?? "")
    : createClient(supabaseUrl!, supabaseAnonKey!, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });

  const { error: setSessionError } = await secondaryClient.auth.setSession({
    access_token: parked.access_token,
    refresh_token: parked.refresh_token,
  });

  if (setSessionError) {
    throw new Error(
      `Park edilmiş oturum açılamadı: ${(setSessionError as Error).message || "Bilinmeyen hata"}`
    );
  }

  const { error: signOutError } = await secondaryClient.auth.signOut();
  if (signOutError) {
    throw new Error(
      `Park edilmiş oturum kapatılamadı: ${(signOutError as Error).message || "Bilinmeyen hata"}`
    );
  }
}

/**
 * Hesap bağlama ve geçiş sorgu anahtarları (v1.4-17 / K-19).
 *
 * Anahtar sözleşmesi: `[alan, kaynak, kapsam]`
 *
 * Kapsam HER ZAMAN aktif kullanıcının kimliğini (`userId`) taşır.
 * İki hesap aynı kurumda olsa bile, hesap geçişinde her hesabın kendi
 * `isCurrent` ve bağlı kardeşler listesi birbirinden bağımsızdır (v1.4-17 Rev 1).
 */
export const accountLinkKeys = {
  all: ["accountLink"] as const,
  linkedAccounts: (userId: string) =>
    ["accountLink", "linkedAccounts", { userId }] as const,
};

export type UseLinkedAccountsOptions = {
  userId?: string | null;
  enabled?: boolean;
};

export function useLinkedAccounts(options?: UseLinkedAccountsOptions) {
  const auth = useContext(AuthContext);
  const userId = options?.userId ?? auth?.identity?.userId;
  const isEnabled =
    (options?.enabled ?? (!isDemoMode && typeof window !== "undefined")) &&
    Boolean(userId);

  return useQuery({
    queryKey: userId
      ? accountLinkKeys.linkedAccounts(userId)
      : (["accountLink", "linkedAccounts", { userId: "" }] as const),
    queryFn: loadLinkedAccounts,
    enabled: isEnabled,
  });
}
