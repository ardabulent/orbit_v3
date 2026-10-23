import { PlatformEmptyState, PlatformSection } from "./PlatformShell";
import {
  PLATFORM_ACTION_LABELS as ACTION_LABELS,
  platformActionDetail,
} from "./platformAuditLabels";
import type { PlatformAuditEvent } from "./platformService";

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PlatformAuditLog({
  events,
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadMore,
}: {
  events: PlatformAuditEvent[];
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
}) {
  return (
    <PlatformSection
      title="Denetim Kaydı"
      description="Platform ekseninde yapılan işlemler. Kurum içi işlemler buraya değil, kurumun kendi denetim kaydına yazılır."
    >
      {events.length === 0 ? (
        <PlatformEmptyState
          title="Henüz kayıt yok"
          description="İlk kurum oluşturulduğunda burada görünecek."
        />
      ) : (
        <>
          <ol className="space-y-2">
            {events.map(event => (
              <li
                key={event.id}
                className="rounded-2xl border border-white/10 bg-white/[.03] px-4 py-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[13px] font-bold">
                    {ACTION_LABELS[event.action] ?? (
                      <span className="font-mono">{event.action}</span>
                    )}
                  </p>
                  <time className="text-[11px] text-slate-500">
                    {formatDateTime(event.createdAt)}
                  </time>
                </div>

                <p className="mt-1 text-[11px] leading-5 text-slate-400">
                  {/* v1.4 ara denetimi: "Bilinmeyen kullanıcı" kişiyi TANIMSIZ
                      ilan ediyordu; oysa bilinmeyen şey kullanıcı değil, adın
                      okunup okunamadığı. Depo deseni (SettingsMembersSection)
                      sistemin durumunu söylüyor. Aynı kusur v1.4-10'da
                      "İsimsiz Veli" olarak bulunup düzeltilmişti (K-22). */}
                  {/* Gece temizliğini kişi değil zamanlayıcı yazar. Yalnız bu
                      olayda: silinmiş operatörün satırı da kişisiz kalır. */}
                  {event.actorName ??
                    (event.action === "platform.retention_purged" ? (
                      "Sistem (gece işi)"
                    ) : (
                      <span className="italic">adı okunamadı</span>
                    ))}
                  {event.organizationName ? ` · ${event.organizationName}` : ""}
                  {` · ${event.entityType}`}
                </p>
                {platformActionDetail(event.action, event.metadata) ? (
                  <p className="mt-1 text-[11px] text-slate-300">
                    {platformActionDetail(event.action, event.metadata)}
                  </p>
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
                {isFetchingNextPage ? "Yükleniyor…" : "Daha fazla yükle"}
              </button>
            </div>
          ) : null}
        </>
      )}

      <p className="mt-4 text-[11px] leading-5 text-slate-500">
        Kayıtlar salt okunurdur ve istemciden yazılamaz; sahte kayıt
        üretilmesini engellemek için yazma yalnızca sunucu tarafındadır.
      </p>
    </PlatformSection>
  );
}
