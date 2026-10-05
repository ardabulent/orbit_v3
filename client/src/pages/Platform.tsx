import { useMemo, useState } from "react";
import { Link, Redirect } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { OrbitMark } from "@/components/OrbitMark";
import { useAuth } from "@/auth/useAuth";
import {
  PlatformNotice,
  PlatformShell,
  PlatformTabs,
} from "@/platform/PlatformShell";
import type { PlatformTab } from "@/platform/tabs";
import { PlatformAuditLog } from "@/platform/PlatformAuditLog";
import { PlatformErrorReports } from "@/platform/PlatformErrorReports";
import { PlatformOperators } from "@/platform/PlatformOperators";
import { PlatformOrganizations } from "@/platform/PlatformOrganizations";
import {
  platformKeys,
  usePlatformAuditEvents,
  usePlatformErrorReports,
  usePlatformOperators,
  usePlatformOrganizations,
} from "@/platform/platformQueries";
import {
  DEFAULT_OPERATOR_LIMIT,
  DEFAULT_ORGANIZATION_LIMIT,
} from "@/platform/platformService";

export default function Platform() {
  const { identity, loading, signOut } = useAuth();

  // ⚠️ `signOut` HATA FIRLATIR ve bu düğme onu yakalamıyordu: `void signOut()`
  // reddi yutulmuş bir söze çeviriyor, kullanıcıya hiçbir şey söylenmiyordu.
  // `Home.tsx` aynı kuralı baştan beri doğru uyguluyor (toast ile). Kural bir
  // yerde uygulanıp diğerinde uygulanmamıştı; v1.4-17 park edilmiş oturumun
  // iptalini de bu yola bağlayınca ikinci bir tetikleyici kazandı.
  const handleSignOut = async () => {
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
  const [tab, setTab] = useState<PlatformTab>("organizations");
  const queryClient = useQueryClient();

  const organizationsQuery = usePlatformOrganizations();
  const operatorsQuery = usePlatformOperators();
  const auditEventsQuery = usePlatformAuditEvents();
  const errorReportsQuery = usePlatformErrorReports({
    enabled: tab === "errors",
  });
  const errorReports = useMemo(
    () => errorReportsQuery.data?.pages.flatMap(page => page.rows) ?? [],
    [errorReportsQuery.data]
  );

  const auditEvents = useMemo(
    () => auditEventsQuery.data?.pages.flatMap(page => page.rows) ?? [],
    [auditEventsQuery.data]
  );

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: platformKeys.all });
  };

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950">
        <div className="flex items-center gap-3 text-slate-200">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 p-2">
            <OrbitMark inverted className="h-full w-full object-contain" />
          </span>
          <p className="text-sm font-bold">Yetki doğrulanıyor…</p>
        </div>
      </main>
    );
  }

  if (!identity) {
    return <Redirect to="/" />;
  }

  // Kilitli veya profili okunamayan kullanıcı burada da duraklatılır.
  // İlgili ekranlar `/` altında yaşadığı için oraya yönlendiriliyor; iki yerde
  // kopya ekranlar tutmak birinin sessizce eskimesi demek olurdu.
  //
  // Operatörler bugün elle açıldığı için kilitli olmuyorlar. Yine de kontrol
  // var: bu rota kilidi veya okunamayan durumu es geçerse, kilitli bir operatör
  // adres çubuğuna `/platform` yazarak durumu tamamen atlar.
  if (identity.passwordLock !== "clear") {
    return <Redirect to="/" />;
  }

  // Yetki kontrolü sunucudadır: `platform_operators` üzerindeki RLS, operatör
  // olmayan kullanıcıya hiçbir satır göstermez ve kurum oluşturma Edge
  // Function'ı operatörlüğü yeniden doğrular. Buradaki kontrol yalnızca
  // kullanıcı deneyimi içindir, güvenlik sınırı değildir.
  if (!identity.platformOperator) {
    return (
      <PlatformShell>
        <PlatformNotice
          title="Bu alana erişiminiz yok"
          description="Platform yönetimi yalnızca geliştirme ekibi içindir."
          footer={
            <Link href="/" className="font-bold text-sky-300">
              Kurum paneline dön
            </Link>
          }
        />
      </PlatformShell>
    );
  }

  return (
    <PlatformShell
      header={
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[12px] font-bold">{identity.displayName}</p>
            <p className="text-[10px] text-slate-400">
              {identity.platformOperator.role === "owner"
                ? "Sahip"
                : "Operatör"}
              {identity.membership
                ? ` · ${identity.membership.organizationName}`
                : ""}
            </p>
          </div>
          {identity.membership ? (
            <Link
              href="/"
              className="rounded-xl bg-white/10 px-3 py-2 text-[11px] font-bold transition hover:bg-white/20"
            >
              Kurum paneli
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="rounded-xl bg-white/10 px-3 py-2 text-[11px] font-bold transition hover:bg-white/20"
          >
            Çıkış
          </button>
        </div>
      }
    >
      <PlatformTabs active={tab} onChange={setTab} />

      {tab === "organizations" ? (
        organizationsQuery.isLoading ? (
          <PlatformNotice
            title="Yükleniyor…"
            description="Kurum kayıtları getiriliyor."
          />
        ) : organizationsQuery.error ? (
          <PlatformNotice
            title="Veriler yüklenemedi"
            description={organizationsQuery.error.message}
            footer={
              <button
                type="button"
                onClick={() => void organizationsQuery.refetch()}
                className="font-bold text-sky-300"
              >
                Tekrar dene
              </button>
            }
          />
        ) : (
          <PlatformOrganizations
            organizations={organizationsQuery.data?.rows ?? []}
            truncated={organizationsQuery.data?.truncated}
            limit={DEFAULT_ORGANIZATION_LIMIT}
            onCreated={refresh}
          />
        )
      ) : tab === "operators" ? (
        operatorsQuery.isLoading ? (
          <PlatformNotice
            title="Yükleniyor…"
            description="Operatör kayıtları getiriliyor."
          />
        ) : operatorsQuery.error ? (
          <PlatformNotice
            title="Veriler yüklenemedi"
            description={operatorsQuery.error.message}
            footer={
              <button
                type="button"
                onClick={() => void operatorsQuery.refetch()}
                className="font-bold text-sky-300"
              >
                Tekrar dene
              </button>
            }
          />
        ) : (
          <PlatformOperators
            operators={operatorsQuery.data?.rows ?? []}
            truncated={operatorsQuery.data?.truncated}
            limit={DEFAULT_OPERATOR_LIMIT}
          />
        )
      ) : tab === "errors" ? (
        errorReportsQuery.isLoading ? (
          <PlatformNotice
            title="Yükleniyor…"
            description="Hata kayıtları getiriliyor."
          />
        ) : errorReportsQuery.error ? (
          <PlatformNotice
            title="Veriler yüklenemedi"
            description={errorReportsQuery.error.message}
            footer={
              <button
                type="button"
                onClick={() => void errorReportsQuery.refetch()}
                className="font-bold text-sky-300"
              >
                Tekrar dene
              </button>
            }
          />
        ) : (
          <PlatformErrorReports
            reports={errorReports}
            hasNextPage={errorReportsQuery.hasNextPage}
            isFetchingNextPage={errorReportsQuery.isFetchingNextPage}
            onLoadMore={() => void errorReportsQuery.fetchNextPage()}
          />
        )
      ) : auditEventsQuery.isLoading ? (
        <PlatformNotice
          title="Yükleniyor…"
          description="Platform denetim kayıtları getiriliyor."
        />
      ) : auditEventsQuery.error ? (
        <PlatformNotice
          title="Veriler yüklenemedi"
          description={auditEventsQuery.error.message}
          footer={
            <button
              type="button"
              onClick={() => void auditEventsQuery.refetch()}
              className="font-bold text-sky-300"
            >
              Tekrar dene
            </button>
          }
        />
      ) : (
        <PlatformAuditLog
          events={auditEvents}
          hasNextPage={auditEventsQuery.hasNextPage}
          isFetchingNextPage={auditEventsQuery.isFetchingNextPage}
          onLoadMore={() => void auditEventsQuery.fetchNextPage()}
        />
      )}
    </PlatformShell>
  );
}
