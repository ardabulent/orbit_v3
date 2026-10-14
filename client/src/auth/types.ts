import type { ReactNode } from "react";
import type { EducationRole } from "@/components/educationAccess";

/**
 * Kurum üyeliğinden gelen kimlik yüzü. Platform operatörünün tasarım gereği
 * yoktur; bkz. `.ai/DECISION_LOG.md` — "Platform operatörü ayrı bir eksendir".
 */
export type MembershipIdentity = {
  membershipId: string;
  role: EducationRole;
  organizationId: string;
  organizationName: string;
  /** Giriş numarasının ilk dört hanesi. */
  organizationCode: number | null;
  branchId: string | null;
  branchName: string | null;
};

/** Platform operatörlüğünden gelen kimlik yüzü. */
export type PlatformOperatorIdentity = {
  role: "owner" | "operator";
};

/**
 * Kullanıcının ilk şifre değişim kilit durumu:
 * - "required": Profil başarıyla okundu ve geçici şifreyle açılan hesap henüz şifresini değiştirmedi.
 * - "clear": Profil başarıyla okundu ve hesap kilitli değil (kendi şifresini belirlemiş).
 * - "unresolved": Profil okunamadı (ağ hatası veya profil satırı yok). Fail-closed prensibi gereği panele alınmaz.
 */
export type PasswordLockState = "required" | "clear" | "unresolved";

/**
 * Kullanıcının kurtarma kanalı (recovery_email) durumu:
 * - "configured": Profil başarıyla okundu ve doğrulanmış kurtarma e-postası mevcut.
 * - "missing": Profil başarıyla okundu ancak kurtarma e-postası tanımlı değil (null veya boş).
 * - "unresolved": Profil okunamadı (ağ hatası veya profil satırı yok). Durum bilinemiyor (K-03 / K-04).
 */
export type RecoveryChannelState = "configured" | "missing" | "unresolved";

/**
 * Kimlik iki bağımsız eksen taşır ve bir kullanıcı ikisinden birine, hiçbirine
 * veya her ikisine birden sahip olabilir.
 *
 * İkisinden birini diğerine göre öncelikli saymak yerine her ikisi de
 * çözümleniyor; hangi panelin gösterileceğine çağıran taraf karar veriyor.
 * Öncelik kuralı koysaydık, hem kurum üyesi hem operatör olan bir kişi
 * diğer panele hiç ulaşamazdı — ki test kurumu silinene kadar (Faz F) kurucu
 * ekip üyesi tam olarak bu durumda olacak.
 */
export type AuthIdentity = {
  userId: string;
  displayName: string;
  demo: boolean;
  /**
   * Kullanıcının ilk şifre değişim kilit durumu.
   *
   * Bayrağın tek doğruluk kaynağı `profiles` tablosudur; istemci onu yalnızca
   * OKUR. Kullanıcı kendi eliyle düşüremez — sütun düzeyi GRANT engelliyor —
   * ve şifre gerçekten değiştiğinde veritabanı tetikleyicisi kendiliğinden
   * düşürüyor. Profil okunamadığında "unresolved" durumuna geçer.
   */
  passwordLock: PasswordLockState;
  /** Geçici şifrenin son geçerlilik anı (ISO). Kilit yoksa veya okunamadıysa `null`. */
  passwordExpiresAt: string | null;
  /**
   * Kullanıcının kurtarma kanalı durumu.
   *
   * `passwordLock` gibi **zorunlu**: isteğe bağlı olsaydı `undefined` dördüncü
   * bir durum olurdu ve üçlü ayrımın varlık sebebi tam olarak bunu önlemek.
   * Her kimlik kuran yer bu alanı bilerek doldurmak zorunda.
   */
  recoveryChannel: RecoveryChannelState;
  /** Kurtarma e-postası adresi. Tanımlı değilse veya okunamadıysa `null`. */
  recoveryEmail: string | null;
  /** Aktif kurum üyeliği yoksa `null`. */
  membership: MembershipIdentity | null;
  /** Aktif platform operatörlüğü yoksa `null`. */
  platformOperator: PlatformOperatorIdentity | null;
};

export type LoginInput = {
  email: string;
  password: string;
  demoRole: EducationRole;
};

export type AuthContextValue = {
  identity: AuthIdentity | null;
  loading: boolean;
  demoMode: boolean;
  /**
   * Kullanıcı bir şifre sıfırlama bağlantısıyla geldi ve henüz yeni şifresini
   * belirlemedi. Bu sırada oturum teknik olarak açıktır ancak kullanıcı panele
   * alınmaz; aksi halde şifresini hiç belirleyemeden içeri girerdi.
   */
  passwordRecovery: boolean;
  signIn: (input: LoginInput) => Promise<void>;
  signOut: () => Promise<void>;
  switchDemoRole: (role: EducationRole) => void;
  /**
   * Giriş numarası ya da e-posta için şifre sıfırlama bağlantısı ister.
   * Bağlantı doğrulanmış kurtarma adresine gider; hesabın kayıtlı olup
   * olmadığını sızdırmaz.
   */
  requestPasswordReset: (identifier: string) => Promise<void>;
  /** Yeni şifreyi kaydeder ve oturumu kapatır; kullanıcı yeni şifresiyle giriş yapar. */
  completePasswordReset: (newPassword: string) => Promise<void>;
  /** Şifre belirlemeden vazgeçildiğinde kurtarma oturumunu kapatır. */
  cancelPasswordRecovery: () => Promise<void>;
  /**
   * Zorunlu ilk şifre değişimini tamamlar ve kimliği yeniler.
   * Kurtarma akışından farkı: oturum kapatılmaz, kullanıcı içeride kalır.
   */
  completeRequiredPasswordChange: (newPassword: string) => Promise<void>;
  /**
   * Oturumu ve kimlik bilgilerini yeniden okur. Bilgi okuma hatası alan kilit
   * ekranında kullanıcının işlemi tekrar denemesini sağlar.
   */
  refreshIdentity: () => Promise<void>;
};

export type AuthProviderProps = {
  children: ReactNode;
};
