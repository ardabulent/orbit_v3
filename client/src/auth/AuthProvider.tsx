import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import type { EducationRole } from "@/components/educationAccess";
import { demoRoleNames } from "@/components/education/roleMeta";
import {
  arrivedWithRecoveryLink,
  supabase,
  supabaseConfigured,
} from "@/lib/supabaseClient";
import { toast } from "sonner";
import { AuthContext } from "./AuthContext";
import { clearLastActivity, resolveIdleTracking } from "./idleTimeout";
import { useIdleTimeout } from "./useIdleTimeout";
import { loadAuthenticatedIdentity } from "./authService";
import { resolveSessionEvent } from "./sessionEvents";
import { isDemoMode } from "./runtime";
import { revokeParkedSession } from "./accountLinkService";
import type { AuthIdentity, AuthProviderProps, LoginInput } from "./types";
import { recordOwnPasswordChange } from "./passwordChange";

function createDemoIdentity(role: EducationRole): AuthIdentity {
  return {
    userId: `demo-${role}`,
    displayName: demoRoleNames[role],
    demo: true,
    // Demo modunda kilit yok; satış sunumunda şifre değiştirme ekranı çıkmaz.
    passwordLock: "clear",
    passwordExpiresAt: null,
    // Demo hesabının gerçek bir kurtarma adresi yok ve olamaz. "missing"
    // bugün canlıdaki her hesap için de doğru; sunumda görülen uyarı gerçek
    // üründe görülenle aynı.
    recoveryChannel: "missing",
    recoveryEmail: null,
    membership: {
      membershipId: `demo-membership-${role}`,
      role,
      organizationId: "demo-organization",
      organizationName: "Trakya pilotu",
      organizationCode: null,
      branchId: "demo-branch",
      branchName: "Çorlu Şube",
    },
    // Demo kimliği hiçbir zaman platform operatörü değildir; demo modu satış
    // sunumu içindir ve kurum kurma yetkisi taşımaz.
    platformOperator: null,
  };
}

/** Şifre sıfırlama bağlantısının kullanıcıyı döndüreceği adres. */
function passwordRecoveryRedirectUrl(): string {
  return `${window.location.origin}/sifre-belirle`;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [identity, setIdentity] = useState<AuthIdentity | null>(null);
  // Başlangıç değeri burada TÜRETİLİYOR, efekt içinde düzeltilmiyor.
  // Supabase yapılandırılmamışsa beklenecek bir şey yok; bunu efektte
  // `setLoading(false)` ile söylemek bir render turu daha üretiyordu.
  const [loading, setLoading] = useState(!isDemoMode && supabaseConfigured);
  // Sayfaya bir kurtarma bağlantısıyla gelindiyse bayrak baştan açılır;
  // PASSWORD_RECOVERY olayı beklenirken ekranın "bağlantı geçersiz" gösterip
  // sonra forma dönmesini engeller.
  const [passwordRecovery, setPasswordRecovery] = useState(
    !isDemoMode && arrivedWithRecoveryLink
  );

  // onAuthStateChange geri çağrımı bir kez kurulur; içeriden güncel değeri
  // okuyabilmek için state yerine ref kullanılıyor. Aksi halde abonelik her
  // değişimde yeniden kurulur ve olaylar kaçabilirdi.
  const recoveringRef = useRef(!isDemoMode && arrivedWithRecoveryLink);

  const setRecovering = useCallback((value: boolean) => {
    recoveringRef.current = value;
    setPasswordRecovery(value);
  }, []);

  // En son BAŞARIYLA çözülmüş erişim jetonu. Aynı jeton için kimliği ikinci
  // kez okumamak içindir (#145). Kararı `resolveSessionEvent` veriyor; burada
  // yalnızca ölçüt tutuluyor.
  //
  // Yalnızca başarılı okumadan SONRA yazılıyor: başarısız bir deneme jetonu
  // işaretleseydi, tek bir ağ hatası kimliği o oturum boyunca kalıcı olarak
  // eksik bırakırdı ve hiçbir olay onu tazeleyemezdi.
  const resolvedTokenRef = useRef<string | null>(null);

  // Okuması ŞU AN süren jeton. `resolvedTokenRef` tek başına yetmiyordu ve
  // bu ölçüldü (#221): o değer `await`'ten sonra yazılıyor, oysa `signIn`
  // sırasında `SIGNED_IN` olayı okuma bitmeden geliyor ve kimlik ikinci kez
  // okunuyordu. Bu ref okumanın BAŞINDA yazılır, sonunda — başarılı da olsa
  // başarısız da olsa — temizlenir.
  const pendingTokenRef = useRef<string | null>(null);

  // Çözüm isteklerinin sayacı. Kimlik çözümü asenkron sürerken araya yeni bir
  // oturum veya çıkış girdiğinde bayat sonucun yazılmasını engeller (#213).
  const identityRequestIdRef = useRef(0);

  const queryClient = useQueryClient();
  const currentUserIdRef = useRef<string | null>(null);

  const applyIdentity = useCallback(
    async (session: Session, forcedRequestId?: number) => {
      const requestId = forcedRequestId ?? ++identityRequestIdRef.current;
      pendingTokenRef.current = session.access_token;

      try {
        const nextIdentity = await loadAuthenticatedIdentity(session.user);

        // Çözüm sürerken kullanıcı çıkış yapmış veya yeni bir oturum başlamışsa
        // sonuç bayattır. İkisi birden atlanmalı: `resolvedTokenRef` yazılırsa
        // sonraki gerçek olay `skip-resolved` olarak yutulurdu (#213).
        if (requestId !== identityRequestIdRef.current) {
          return;
        }

        // Çözülen kimliğin kullanıcı kimliği değiştiğinde (ör. hesap değiştirildiğinde
        // veya aynı kurumdaki öğretmen -> veli geçişinde) önceki hesaba ait önbelleğin
        // sonraki hesaba sızmaması için React Query önbelleği YENİ KİMLİK
        // YERLEŞMEDEN ÖNCE tamamen temizlenir (#302, v1.4-17 Rev 1).
        if (
          currentUserIdRef.current &&
          currentUserIdRef.current !== nextIdentity.userId
        ) {
          queryClient.clear();
        }
        currentUserIdRef.current = nextIdentity.userId;

        setIdentity(nextIdentity);
        resolvedTokenRef.current = session.access_token;
      } finally {
        // Hata halinde de temizleniyor ve bu bilinçli: başarısız bir okuma
        // jetonu "çözülmüş" saymaz, dolayısıyla sonraki olay yeniden dener.
        // Temizlemeseydik tek bir ağ hatası o jetonu kalıcı olarak sessize
        // alırdı. Karşılaştırma, araya yeni bir oturum girmişse yeni sahibin
        // işaretini silmemek için.
        if (pendingTokenRef.current === session.access_token) {
          pendingTokenRef.current = null;
        }
      }
    },
    [queryClient]
  );

  const clearIdentity = useCallback(() => {
    // Çıkış yapıldığında sayacı ilerletiyoruz; aksi halde uçuştaki sorgu
    // döndüğünde kendisini hâlâ en güncel istek sanıp çıkmış kullanıcının
    // kimliğini geri yazardı (#213).
    identityRequestIdRef.current++;
    resolvedTokenRef.current = null;
    pendingTokenRef.current = null;
    currentUserIdRef.current = null;
    setIdentity(null);

    // Oturum kapandığında veya kimlik sıfırlandığında paylaşılan dershane
    // bilgisayarında bir sonraki kullanıcının önceki kullanıcının verilerini
    // görmemesi için React Query önbelleği tamamen temizlenir (#132, v1.3-00).
    // useQueryClient() sağlayıcı yoksa fırlatır; sessiz bozulma önlenir (K-04).
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    if (isDemoMode) {
      return;
    }

    let active = true;

    if (!supabaseConfigured) {
      // `loading` zaten `false` başlıyor (yukarıdaki türetme); burada
      // yapılacak bir şey yok, yalnızca aboneliği kurmadan çıkılıyor.
      return;
    }

    // `getSession()` ile açılış yapılMIYOR ve bu #145'in düzeltmesidir.
    // Öncesinde kimlik iki ayrı yoldan çözülüyordu — burada bir kez,
    // abonelik kurulurken gelen `INITIAL_SESSION` olayıyla bir kez daha — ve
    // her sayfa yenilemesi beş sorgu yerine on istek üretiyordu.
    //
    // Tek yola inmek güvenli, çünkü auth-js (2.112.3) `onAuthStateChange`
    // abonelik kurar kurmaz `_emitInitialSession` çağırıyor ve o fonksiyon
    // HER yolda geri çağrımı tetikliyor: başarıda oturumla, hatada `null`
    // ile. Olayın hiç gelmediği bir durum yok, dolayısıyla `loading` asılı
    // kalmaz.
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        window.setTimeout(() => {
          if (!active) return;

          const { action, releasesLoading } = resolveSessionEvent({
            event,
            accessToken: session?.access_token ?? null,
            resolvedToken: resolvedTokenRef.current,
            pendingToken: pendingTokenRef.current,
            recovering: recoveringRef.current,
          });

          // Kilit karardan BAĞIMSIZ düşüyor. "Kurtarma sürüyor" dalı olayı
          // yok sayar; kilit karara bağlansaydı kurtarma bağlantısıyla gelen
          // kullanıcı sonsuz spinner görürdü — bugüne kadar o kilidi kaldıran
          // şey, yukarıda kaldırılan `getSession()` yoluydu.
          if (releasesLoading) {
            setLoading(false);
          }

          if (action === "enter-recovery") {
            setRecovering(true);
            clearIdentity();
            return;
          }

          if (
            action === "ignore" ||
            action === "skip-resolved" ||
            action === "skip-pending"
          ) {
            return;
          }

          if (action === "clear") {
            clearIdentity();
            return;
          }

          if (session) {
            // Olay yolu: kimlik okuması hata verirse, YALNIZCA bu istek hâlâ
            // en güncel istekse kimliği sıfırla. Araya çıkış veya yeni bir
            // oturum girmişse bayat hata yeni oturumu sıfırlamamalı (#213 revizyon 1).
            const requestId = ++identityRequestIdRef.current;
            void applyIdentity(session, requestId).catch(() => {
              if (requestId === identityRequestIdRef.current) {
                clearIdentity();
              }
            });
          }
        }, 0);
      }
    );

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [applyIdentity, clearIdentity, setRecovering]);

  const signIn = useCallback(
    async ({ email, password, demoRole }: LoginInput) => {
      if (isDemoMode) {
        if (password !== "demo123") {
          throw new Error("Demo şifresi demo123 olarak ayarlanmıştır.");
        }

        setIdentity(createDemoIdentity(demoRole));
        return;
      }

      if (!supabaseConfigured) {
        throw new Error(
          "Giriş servisi yapılandırılmamış. Sistem yöneticisine başvurun."
        );
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error || !data.user || !data.session) {
        throw new Error("E-posta veya şifre doğrulanamadı.");
      }

      // Kimlik burada okunuyor, `SIGNED_IN` olayının gelmesi beklenmiyor:
      // okuma başarısız olursa kullanıcı dışarı alınmalı ve hata çağırana
      // ulaşmalı. Olay yolu bunu yapamaz — orada fırlatılan hata kimseye
      // ulaşmaz.
      //
      // Hemen ardından gelen `SIGNED_IN` aynı işi tekrar ETMEZ, çünkü
      // `applyIdentity` jetonu okumaya BAŞLARKEN işaretliyor. Bu yorum
      // 2026-09-09'a kadar aynı şeyi iddia ediyordu ama doğru değildi:
      // işaret `await`'ten sonra konuyordu ve olay okuma bitmeden geldiği
      // için her girişte kimlik iki kez okunuyordu (#221, ölçüldü).
      try {
        await applyIdentity(data.session);
      } catch (identityError) {
        await supabase.auth.signOut();
        throw identityError;
      }
    },
    [applyIdentity]
  );

  const signOut = useCallback(async () => {
    let revokeError: Error | null = null;
    try {
      await revokeParkedSession();
    } catch (err) {
      revokeError =
        err instanceof Error
          ? err
          : new Error("Park edilmiş oturum kapatılamadı.");
    }

    if (!isDemoMode && supabaseConfigured) {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw new Error("Oturum güvenli şekilde kapatılamadı.");
      }
    }

    clearLastActivity();
    clearIdentity();

    if (revokeError) {
      throw revokeError;
    }
  }, [clearIdentity]);

  const idleTracking = resolveIdleTracking({
    demoMode: isDemoMode,
    sessionLoading: loading,
    signedIn: identity !== null,
  });

  // Hareketsizlik zaman aşımı. Supabase'in sunucu tarafı karşılığı Pro plan
  // gerektirdiği için ücretsiz alternatif; bkz. `idleTimeout.ts`.
  //
  // Demo modunda kapalı; oturum çözülürken ("wait") depoya dokunulmaz (#128).
  useIdleTimeout({
    tracking: idleTracking,
    onExpire: () => {
      void (async () => {
        // Hareketsizlik sayacı ikisini birden kapatır (2026-08-25 kararı / v1.4-17):
        // şifresiz geçiş, iki oturumun aynı anda saklanması demek; sayaç yalnız
        // aktif olanı kapatırsa diğeri açık kalır. Park edilmiş oturum sunucu
        // tarafında da iptal edilir.
        try {
          await revokeParkedSession();
        } catch (err) {
          console.error(
            "[auth] Hareketsizlik zaman aşımında park edilmiş oturum sunucuda kapatılamadı:",
            err
          );
        }

        // `signOut()` hata FIRLATMAZ, hatayı döndürür. Eski kod `.catch` ile
        // yakalamaya çalışıyordu; o zincir hiç çalışmıyordu ve sunucu isteği
        // başarısız olduğunda jeton depoda kalıyordu. Ekran giriş sayfasına
        // dönüyor, sayfa yenilenince oturum geri geliyordu — yani sayacın
        // koruduğu iddia edilen şey korunmuyordu (#143).
        const { error } = await supabase.auth.signOut();

        if (error) {
          console.warn(
            "[auth] Oturum sunucuda kapatılamadı; yerel jeton yine de siliniyor.",
            error
          );
          // Ağ istemez, yalnızca yerel depoyu temizler. Sayacın var olma
          // sebebi bu satırdır: ekranı kilitlemek yetmez, jeton gitmelidir.
          await supabase.auth.signOut({ scope: "local" });
        }

        clearIdentity();
        toast.info("Oturumunuz kapatıldı", {
          description:
            "Uzun süre işlem yapılmadığı için güvenlik amacıyla çıkış yapıldı. Tekrar giriş yapabilirsiniz.",
        });
      })();
    },
  });

  /**
   * Zorunlu ilk şifre değişimini tamamlar.
   *
   * Şifre doğrudan Supabase'e gidiyor; araya bizim sunucu kodumuz girmiyor.
   * Bayrağı da biz temizlemiyoruz — veritabanı tetikleyicisi şifre gerçekten
   * değiştiğinde kendiliğinden düşürüyor. Burada yaptığımız tek şey, düşmüş
   * bayrağı görebilmek için kimliği yeniden okumak.
   *
   * `signOut` YAPILMIYOR. Kurtarma akışından farkı bu: orada kullanıcının
   * şifresini gerçekten bilip bilmediği belirsizdi ve yeniden giriş bir
   * doğrulamaydı. Burada kullanıcı zaten geçerli şifresiyle girmiş durumda;
   * onu dışarı atmak gereksiz bir sürtünme olurdu.
   */
  const completeRequiredPasswordChange = useCallback(
    async (newPassword: string) => {
      if (!supabaseConfigured) {
        throw new Error(
          "Giriş servisi yapılandırılmamış. Sistem yöneticisine başvurun."
        );
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw new Error(
          "Şifre güncellenemedi. Lütfen tekrar deneyin; sorun sürerse kurum yöneticinize başvurun."
        );
      }

      await recordOwnPasswordChange();

      const { data, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !data.session) {
        // Şifre değişti ama oturum okunamadı. Kullanıcıyı belirsiz bir
        // durumda bırakmak yerine dışarı alıyoruz; yeni şifresiyle girer.
        await supabase.auth.signOut();
        clearLastActivity();
        clearIdentity();
        return;
      }

      // Bu okuma atlanamaz ve jeton ölçütünün kullanıcı ölçütü OLMAMASININ
      // sebebi budur: bayrağı veritabanı tetikleyicisi düşürüyor, düşmüş
      // bayrağı görmenin tek yolu kimliği yeniden okumak. Şifre değişimi
      // oturumu döndürdüğü için jeton yenidir ve okuma gerçekten yapılır.
      await applyIdentity(data.session);
    },
    [applyIdentity, clearIdentity]
  );

  const switchDemoRole = useCallback((role: EducationRole) => {
    if (!isDemoMode) return;
    setIdentity(createDemoIdentity(role));
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    if (isDemoMode) {
      throw new Error(
        "Şifre sıfırlama yalnızca canlı ortamda kullanılabilir. Demo modunda şifre demo123'tür."
      );
    }

    if (!supabaseConfigured) {
      throw new Error(
        "Giriş servisi yapılandırılmamış. Sistem yöneticisine başvurun."
      );
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: passwordRecoveryRedirectUrl(),
    });

    // Hesabın var olup olmadığı sızdırılmaz; yalnızca gerçek servis hataları
    // yukarı taşınır. Çağıran taraf her durumda aynı mesajı gösterir.
    if (error && error.status && error.status >= 500) {
      throw new Error(
        "Şifre sıfırlama e-postası gönderilemedi. Lütfen daha sonra tekrar deneyin."
      );
    }
  }, []);

  const completePasswordReset = useCallback(
    async (newPassword: string) => {
      if (!supabaseConfigured) {
        throw new Error(
          "Giriş servisi yapılandırılmamış. Sistem yöneticisine başvurun."
        );
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw new Error(
          "Şifre güncellenemedi. Bağlantının süresi dolmuş olabilir; sıfırlama işlemini yeniden başlatın."
        );
      }

      // İz oturum kapanmadan önce yazılır: RPC oturum ister.
      await recordOwnPasswordChange();

      // Yeni şifreyle giriş yapılmasını bilinçli olarak zorunlu kılıyoruz.
      // Kullanıcıyı doğrudan panele almak daha hızlı olurdu, ancak o zaman
      // şifrenin gerçekten çalıştığı doğrulanmamış kalırdı; bu akışın var olma
      // sebebi tam olarak o belirsizliği ortadan kaldırmaktır.
      await supabase.auth.signOut();
      clearIdentity();
      setRecovering(false);
    },
    [clearIdentity, setRecovering]
  );

  const cancelPasswordRecovery = useCallback(async () => {
    if (supabaseConfigured) {
      await supabase.auth.signOut();
    }

    clearIdentity();
    setRecovering(false);
  }, [clearIdentity, setRecovering]);

  /**
   * Oturumu okur ve kimliği yeniden yükler. Profil okuma hatası veya geçici
   * ağ sorunları nedeniyle "unresolved" durumunda kalan ekranlarda kullanıcının
   * işlemi tekrar denemesini sağlar. Hata durumunda hatayı yukarı fırlatır;
   * çağıran bileşen yakalayıp kullanıcıya gösterir, mevcut kimlik bozulmaz.
   */
  const refreshIdentity = useCallback(async () => {
    if (isDemoMode) {
      return;
    }

    if (!supabaseConfigured) {
      throw new Error(
        "Giriş servisi yapılandırılmamış. Sistem yöneticisine başvurun."
      );
    }

    const { data, error } = await supabase.auth.getSession();

    if (error || !data.session) {
      throw new Error("Oturum doğrulanamadı. Lütfen tekrar giriş yapın.");
    }

    // Elle tazeleme koruma ölçütünden GEÇMEZ ve geçmemelidir: bu akışın var
    // olma sebebi, ağ hatası yüzünden "unresolved" kalmış bir ekranda
    // kullanıcının tekrar denemesidir. Jeton aynı olsa bile okuma yapılır.
    await applyIdentity(data.session);
  }, [applyIdentity]);

  const value = useMemo(
    () => ({
      identity,
      loading,
      demoMode: isDemoMode,
      passwordRecovery,
      signIn,
      signOut,
      switchDemoRole,
      requestPasswordReset,
      completePasswordReset,
      cancelPasswordRecovery,
      completeRequiredPasswordChange,
      refreshIdentity,
    }),
    [
      identity,
      loading,
      passwordRecovery,
      signIn,
      signOut,
      switchDemoRole,
      requestPasswordReset,
      completePasswordReset,
      cancelPasswordRecovery,
      completeRequiredPasswordChange,
      refreshIdentity,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
