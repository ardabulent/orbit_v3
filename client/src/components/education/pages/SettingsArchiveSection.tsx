import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArchiveRestore, Search } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/auth/useAuth";
import { isDemoMode } from "@/auth/runtime";
import { useArchive } from "@/education/educationQueries";
import {
  ARCHIVE_PAGE_CAP,
  restoreArchived,
  type ArchiveKind,
  type ArchivedItem,
} from "@/education/archiveService";
import { orbitLocalDate, formatTrDate } from "@/education/trDate";
import { CardSkeleton, EmptyState, ErrorState } from "../shared";

const KINDS: { kind: ArchiveKind; label: string; restoredNote: string }[] = [
  {
    kind: "student",
    label: "Öğrenciler",
    restoredNote:
      "Arşivlenirken kapanan sınıf kayıtları da yeniden açıldı (aynı sınıfa yeniden kaydedilmediyse).",
  },
  { kind: "class", label: "Sınıflar", restoredNote: "" },
  { kind: "guardian", label: "Veliler", restoredNote: "" },
  { kind: "exam", label: "Sınavlar", restoredNote: "" },
];

/**
 * Ayarlar → Arşiv (2026-10-12, B20). Arşivlenen öğrenci, sınıf, veli ve
 * sınavlar türüne göre listelenir ve geri alınır. Önceden geri almanın tek
 * yolu birkaç saniyelik bir tosttu; sınavda hiç yoktu.
 */
export function SettingsArchiveSection() {
  const { identity } = useAuth();
  const organizationId = identity?.membership?.organizationId ?? "";
  const queryClient = useQueryClient();
  const archive = useArchive({ enabled: !isDemoMode });
  const [kind, setKind] = useState<ArchiveKind>("student");
  const [search, setSearch] = useState("");
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const all = archive.data?.[kind] ?? [];
    const needle = search.trim().toLocaleLowerCase("tr");
    if (!needle) return all;
    return all.filter(item =>
      `${item.title} ${item.detail ?? ""}`
        .toLocaleLowerCase("tr")
        .includes(needle)
    );
  }, [archive.data, kind, search]);

  const handleRestore = async (item: ArchivedItem) => {
    setRestoringId(item.id);
    try {
      await restoreArchived(organizationId, item.kind, item.id);
      const note = KINDS.find(k => k.kind === item.kind)?.restoredNote;
      toast.success(`"${item.title}" geri alındı`, {
        description: note || "Kayıt yeniden listelerde görünüyor.",
      });
      // Geri alınan kayıt birçok listeye döner; eğitim sorgularının hepsi
      // tazelenir (canlı kanal da aynısını yapar, bu sekme beklemesin).
      await queryClient.invalidateQueries({ queryKey: ["education"] });
    } catch (err: unknown) {
      toast.error("Geri alınamadı", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <>
      <h2 className="font-display text-[18px] font-extrabold text-slate-900">
        Arşiv
      </h2>
      <p className="mt-1 max-w-2xl text-[11px] text-slate-500">
        Arşivlenen kayıtlar silinmez; listelerden kalkar ve burada bekler. Geri
        aldığınız kayıt eski bilgileriyle döner. Her türde en son arşivlenen{" "}
        {ARCHIVE_PAGE_CAP} kayıt gösterilir.
      </p>

      {isDemoMode ? (
        <div className="mt-5">
          <EmptyState
            title="Demo modunda arşiv yok"
            description="Arşiv gerçek kurum verisiyle çalışır."
          />
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
            <div
              role="tablist"
              aria-label="Arşiv türü"
              className="flex flex-wrap gap-1"
            >
              {KINDS.map(option => {
                const count = archive.data?.[option.kind].length;
                const selected = option.kind === kind;
                return (
                  <button
                    key={option.kind}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setKind(option.kind)}
                    className={`rounded-lg px-3 py-1.5 text-[12px] font-bold transition ${
                      selected
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {option.label}
                    {count !== undefined ? (
                      <span
                        className={`ml-1.5 ${selected ? "text-slate-300" : "text-slate-400"}`}
                      >
                        {count >= ARCHIVE_PAGE_CAP ? `${count}+` : count}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <label className="relative ml-auto w-full sm:w-56">
              <span className="sr-only">Arşivde ara</span>
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Ada göre ara"
                className="h-9 w-full rounded-lg border border-slate-200 pl-8 pr-3 text-[13px] outline-none focus:border-slate-400"
              />
            </label>
          </div>

          {archive.isLoading ? (
            <div className="p-4">
              <CardSkeleton />
            </div>
          ) : archive.error ? (
            <div className="p-4">
              <ErrorState
                title="Arşiv yüklenemedi"
                message={archive.error.message}
                onRetry={() => void archive.refetch()}
              />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title={
                  search.trim()
                    ? "Aramayla eşleşen kayıt yok"
                    : "Bu türde arşivlenmiş kayıt yok"
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {rows.map(item => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-extrabold text-slate-800">
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {item.detail ? `${item.detail} · ` : ""}
                      Arşivlendi:{" "}
                      {formatTrDate(orbitLocalDate(item.archivedAt))}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleRestore(item)}
                    disabled={restoringId !== null}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[12px] font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    <ArchiveRestore className="h-3.5 w-3.5" aria-hidden />
                    {restoringId === item.id ? "Geri alınıyor…" : "Geri al"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
