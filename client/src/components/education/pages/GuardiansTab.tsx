import { useState } from "react";
import { Search } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge, EmptyState, ErrorState, TableSkeleton } from "../shared";
import type { Guardian } from "@/education/guardianService";
import type { OrganizationMember } from "@/organization/memberService";

export type GuardiansTabProps = {
  guardians: Guardian[];
  query: string;
  onQuery: (value: string) => void;
  onEdit: (guardian: Guardian) => void;
  onArchive: (guardian: Guardian) => void | Promise<void>;
  onLinkAccount?: (
    guardianId: string,
    membershipId: string
  ) => void | Promise<void>;
  onUnlinkAccount?: (guardianId: string) => void | Promise<void>;
  linkableMembers?: OrganizationMember[];
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  truncated?: boolean;
  limit?: number;
};

export type LinkGuardianAccountPopoverProps = {
  guardian: Guardian;
  members: OrganizationMember[];
  onLink: (guardianId: string, membershipId: string) => Promise<void> | void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function LinkGuardianAccountPopover({
  guardian,
  members,
  onLink,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: LinkGuardianAccountPopoverProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = isControlled
    ? (controlledOnOpenChange ?? (() => {}))
    : setUncontrolledOpen;
  const [selectedMembershipId, setSelectedMembershipId] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const handleLinkSubmit = async () => {
    if (!selectedMembershipId || linking) return;
    setLinking(true);
    setLinkError(null);
    try {
      await onLink(guardian.id, selectedMembershipId);
      setOpen(false);
      setSelectedMembershipId("");
    } catch (err) {
      setLinkError(
        err instanceof Error ? err.message : "Bağlama işlemi başarısız oldu."
      );
    } finally {
      setLinking(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded-lg px-2 py-1 text-[11px] font-semibold text-blue-600 transition hover:bg-blue-50"
        >
          Hesap bağla
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="end">
        <div className="space-y-3">
          <div>
            <h4 className="text-xs font-bold text-slate-800">Hesap Bağla</h4>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {guardian.fullName} kaydına bağlanacak veli hesabını seçin.
            </p>
          </div>
          {members.length === 0 ? (
            <p className="py-1 text-[11px] text-slate-500">
              Kurumda bağlanabilir veli hesabı bulunmuyor.
            </p>
          ) : (
            <div className="space-y-2">
              <select
                value={selectedMembershipId}
                onChange={e => setSelectedMembershipId(e.target.value)}
                disabled={linking}
                className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs outline-none"
              >
                <option value="">Hesap seçin…</option>
                {members.map(m => (
                  <option key={m.membershipId} value={m.membershipId}>
                    {m.displayName || "adı okunamadı"}{" "}
                    {m.loginNumber ? `(${m.loginNumber})` : ""}
                  </option>
                ))}
              </select>
              {linkError ? (
                <p className="text-[11px] font-semibold text-rose-600">
                  {linkError}
                </p>
              ) : null}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={linking}
                  className="rounded-md px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  onClick={() => void handleLinkSubmit()}
                  disabled={!selectedMembershipId || linking}
                  className="rounded-md bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {linking ? "Bağlanıyor…" : "Bağla"}
                </button>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function GuardiansTab({
  guardians,
  query,
  onQuery,
  onEdit,
  onArchive,
  onLinkAccount,
  onUnlinkAccount,
  linkableMembers = [],
  isLoading = false,
  error = null,
  onRetry,
  truncated = false,
  limit,
}: GuardiansTabProps) {
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  const handleArchive = async (guardian: Guardian) => {
    if (!onArchive || archivingId) return;
    setArchivingId(guardian.id);
    try {
      await onArchive(guardian);
    } finally {
      setArchivingId(null);
    }
  };

  const handleUnlink = async (guardian: Guardian) => {
    if (!onUnlinkAccount || unlinkingId) return;
    setUnlinkingId(guardian.id);
    try {
      await onUnlinkAccount(guardian.id);
    } finally {
      setUnlinkingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* "Yeni veli" düğmesi yalnız sayfa başlığında — Öğrenciler sekmesiyle
          aynı düzen. Burada ikinci bir kopyası vardı (2026-09-28). */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-[0_4px_16px_rgba(15,23,42,.025)]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={event => onQuery(event.target.value)}
            placeholder="Veli adı veya telefon ara..."
            className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3 text-[12px] outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
          />
        </div>
      </div>

      {truncated ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-[11px] font-semibold text-amber-800">
          Liste üst sınıra ({limit} kayıt) ulaştı. Kalan kayıtları görmek için
          yukarıdaki arama kutusunu kullanın.
        </div>
      ) : null}

      {isLoading ? (
        <TableSkeleton rows={5} columns={5} className="mt-5" />
      ) : error ? (
        <ErrorState
          className="mt-5"
          title="Veliler görüntülenemedi"
          message={error.message}
          onRetry={onRetry}
        />
      ) : (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_16px_rgba(15,23,42,.025)]">
          {guardians.length === 0 ? (
            <EmptyState
              title="Gösterilecek veli yok"
              description={
                query
                  ? "Arama kriterlerine uygun veli bulunamadı."
                  : "Henüz kayıtlı veli bulunmuyor."
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-400">
                    <th className="px-5 py-3.5">Veli</th>
                    <th className="px-5 py-3.5">Telefon</th>
                    <th className="px-5 py-3.5">Bağlı Öğrenciler</th>
                    <th className="px-5 py-3.5 text-right">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {guardians.map(guardian => (
                    <tr
                      key={guardian.id}
                      className="border-b border-slate-100 text-[12px] last:border-0 hover:bg-slate-50/70"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="grid h-9 w-9 place-items-center rounded-full bg-violet-50 text-[11px] font-extrabold text-violet-700">
                            {guardian.fullName
                              .split(" ")
                              .map(part => part[0])
                              .join("")}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-extrabold text-slate-800">
                                {guardian.fullName}
                              </p>
                              {/* K-22: Hesabı olmayan veli slate rozet taşır */}
                              {!guardian.hasAccount ? (
                                <Badge tone="slate">Hesap bağlı değil</Badge>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {/* K-22: Telefonu olmayan velide "Telefon yok" yazılmaz, "—" çizilir */}
                        {guardian.phone ? (
                          <span>{guardian.phone}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {guardian.studentCount > 0 ? (
                          <span>
                            {guardian.studentNames &&
                            guardian.studentNames.length > 0
                              ? guardian.studentNames.join(", ")
                              : `${guardian.studentCount} öğrenci`}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {guardian.hasAccount ? (
                            onUnlinkAccount ? (
                              <button
                                type="button"
                                onClick={() => void handleUnlink(guardian)}
                                disabled={unlinkingId === guardian.id}
                                className="rounded-lg px-2 py-1 text-[11px] font-semibold text-amber-600 transition hover:bg-amber-50 disabled:opacity-50"
                              >
                                {unlinkingId === guardian.id
                                  ? "Çözülüyor…"
                                  : "Bağı çöz"}
                              </button>
                            ) : null
                          ) : onLinkAccount ? (
                            <LinkGuardianAccountPopover
                              guardian={guardian}
                              members={linkableMembers}
                              onLink={onLinkAccount}
                            />
                          ) : null}
                          <button
                            type="button"
                            onClick={() => onEdit(guardian)}
                            className="rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-100"
                          >
                            Düzenle
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleArchive(guardian)}
                            disabled={archivingId === guardian.id}
                            className="rounded-lg px-2 py-1 text-[11px] font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                          >
                            {archivingId === guardian.id
                              ? "Arşivleniyor…"
                              : "Arşivle"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
