import { PlatformEmptyState, PlatformSection } from "./PlatformShell";
import type { ClientErrorReport } from "@/errorReporting/errorReportService";

const KIND_LABELS: Record<ClientErrorReport["kind"], string> = {
  error: "Yakalanmamış hata",
  unhandledrejection: "Yarım kalan işlem",
  render: "Ekran çizilemedi",
};

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("tr-TR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Kullanıcı ekranlarında yakalanan hatalar (2026-10-05, v1.5-06).
 *
 * Kişisel veri sunucuda ve istemcide ayıklanmış olarak gelir; kimin
 * yaşadığı gösterilmez, yalnız kurum adı. 30 gün saklanır.
 */
export function PlatformErrorReports({
  reports,
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadMore,
}: {
  reports: ClientErrorReport[];
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
}) {
  return (
    <PlatformSection
      title="Hata Kayıtları"
      description="Kullanıcıların ekranında yakalanan hatalar, son 30 gün. Kişisel veri ayıklanmıştır; kimin yaşadığı tutulmaz, yalnız kurumu."
    >
      {reports.length === 0 ? (
        <PlatformEmptyState
          title="Hata kaydı yok"
          description="Son 30 günde oturum açmış bir kullanıcının ekranında yakalanan hata olmadı."
        />
      ) : (
        <>
          <ol className="space-y-2">
            {reports.map(report => (
              <li
                key={report.id}
                className="rounded-2xl border border-white/10 bg-white/[.03] px-4 py-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[13px] font-bold break-words">
                    {report.message}
                  </p>
                  <time className="text-[11px] text-slate-500">
                    {formatDateTime(report.createdAt)}
                  </time>
                </div>
                <p className="mt-1 text-[11px] leading-5 text-slate-400">
                  {KIND_LABELS[report.kind] ?? report.kind}
                  {report.organizationName
                    ? ` · ${report.organizationName}`
                    : " · kurumsuz hesap"}
                  {report.path ? ` · ${report.path}` : ""}
                  {report.appVersion ? ` · sürüm ${report.appVersion}` : ""}
                </p>
                {report.stack || report.userAgent ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[11px] font-bold text-sky-300">
                      Teknik ayrıntı
                    </summary>
                    {report.userAgent ? (
                      <p className="mt-2 text-[11px] text-slate-500">
                        {report.userAgent}
                      </p>
                    ) : null}
                    {report.stack ? (
                      <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-black/30 p-3 text-[11px] text-slate-400">
                        {report.stack}
                      </pre>
                    ) : null}
                  </details>
                ) : null}
              </li>
            ))}
          </ol>
          {hasNextPage ? (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={onLoadMore}
                disabled={isFetchingNextPage}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-[12px] font-bold text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
              >
                {isFetchingNextPage ? "Yükleniyor…" : "Daha eski kayıtlar"}
              </button>
            </div>
          ) : null}
        </>
      )}
    </PlatformSection>
  );
}
