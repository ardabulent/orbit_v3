import { OrbitMark } from "@/components/OrbitMark";
import { EducationLoginScreen } from "@/components/education/LoginScreen";
import { lazy } from "react";
import { ForcePasswordChangeScreen } from "@/components/auth/ForcePasswordChangeScreen";
import { ProfileUnavailableScreen } from "@/components/auth/ProfileUnavailableScreen";
import { useAuth } from "@/auth/useAuth";
import { Redirect } from "wouter";
import { toast } from "sonner";

// Dershane paneli ayrı parça (2026-10-11): giriş ekranı onu beklemeden açılır.
const EducationPlatform = lazy(() =>
  import("@/components/education/EducationPlatform").then(m => ({
    default: m.EducationPlatform,
  }))
);

export default function Home() {
  const {
    identity,
    loading,
    demoMode,
    passwordRecovery,
    signIn,
    signOut,
    switchDemoRole,
    completeRequiredPasswordChange,
    refreshIdentity,
  } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      toast.error("Oturum kapatılamadı", {
        description:
          error instanceof Error
            ? error.message
            : "Lütfen bağlantınızı kontrol edip tekrar deneyin.",
      });
    }
  };

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#eef7ff]">
        <div className="flex items-center gap-3 text-slate-700">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 p-2">
            <OrbitMark inverted className="h-full w-full object-contain" />
          </span>
          <p className="text-sm font-bold">Güvenli oturum yükleniyor…</p>
        </div>
      </main>
    );
  }

  // Davet bağlantıları Site URL'e, yani bu sayfaya düşebilir. Kurtarma
  // sürerken kullanıcıyı giriş formunda bırakmak yerine şifre belirleme
  // ekranına yönlendiriyoruz; aksi halde açık bir oturumu varken tekrar giriş
  // yapmaya çalışır ve şifresini asla belirleyemez.
  if (passwordRecovery) {
    return <Redirect to="/sifre-belirle" />;
  }

  if (!identity) {
    return <EducationLoginScreen demoMode={demoMode} onLogin={signIn} />;
  }

  // Profil okunamadığında fail-closed davranışı: kullanıcı panele alınmaz,
  // ancak şifre değiştirmeye zorlanmak yerine bilgilendirme ve tekrar deneme
  // ekranına yönlendirilir.
  if (identity.passwordLock === "unresolved") {
    return (
      <ProfileUnavailableScreen
        onRetry={refreshIdentity}
        onSignOut={() => void handleLogout()}
      />
    );
  }

  // Kilit her şeyden ÖNCE gelir — panel yönlendirmesinden de önce.
  //
  // Sırayı bozup önce yönlendirseydik, hem operatör hem kilitli olan biri
  // panele düşer ve kilidi hiç görmezdi. Geçici şifreyle sınırsız dolaşmak
  // tam olarak kapatmaya çalıştığımız şey.
  //
  // Bu kontrol bir güvenlik sınırı DEĞİLDİR: istemci kodunu yok sayan biri
  // doğrudan API çağırabilir. Sunucu tarafındaki karşılığı
  // `current_user_must_change_password()` ve v1.2'de iş tablolarının RLS
  // politikalarına koşul olarak girecek.
  if (identity.passwordLock === "required") {
    return (
      <ForcePasswordChangeScreen
        displayName={identity.displayName}
        expiresAt={identity.passwordExpiresAt}
        onSubmit={completeRequiredPasswordChange}
        onSignOut={() => void handleLogout()}
      />
    );
  }

  // Platform operatörü panele aittir, dershane paneline değil.
  //
  // Önceden yalnızca "üyeliği yoksa" yönlendiriliyordu ve öncelik kuralı
  // bilinçli olarak konmamıştı; gerekçe, kurucu ekibin test kurumunda üyeliği
  // olmasıydı. Test kurumu kaldırıldığı ve operatörlerin kurum üyeliği
  // bulunmayacağı için o gerekçe ortadan kalktı. Bkz. `DECISION_LOG.md` —
  // "Platform operatörü girişte panele düşer".
  //
  // Kimliğin iki eksenli modeli korunuyor: hem üye hem operatör olan biri
  // dershane paneline menüdeki bağlantıyla ulaşır.
  if (identity.platformOperator || !identity.membership) {
    return <Redirect to="/platform" />;
  }

  return (
    <EducationPlatform
      key={identity.userId}
      initialRole={identity.membership.role}
      displayName={identity.displayName}
      organizationName={identity.membership.organizationName}
      branchName={identity.membership.branchName}
      canSwitchRole={demoMode}
      onRoleChange={switchDemoRole}
      canAccessPlatform={Boolean(identity.platformOperator)}
      onLogout={handleLogout}
    />
  );
}
