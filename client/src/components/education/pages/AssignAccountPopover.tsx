import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { OrganizationMember } from "@/organization/memberService";
import type { AccountRecordKind } from "@/education/accountForRecord";
import { requestOpenAccount } from "./openAccountRequest";

/**
 * Öğrenci ya da veli KAYDINA giriş HESABI atar — iki yol (ana plan 1.7):
 *
 *   1. "Yeni hesap aç ve bağla": hesabı açar, kayda bağlar, giriş fişini
 *      gösterir. Pencere satırda değil sayfada durur (`OpenAccountHost`):
 *      hesap bağlanınca canlı güncelleme satırı tazeler ve bu bileşen kalkar;
 *      fiş onunla kaybolmamalı. Yalnız `canOpenAccount` verildiğinde
 *      çizilir; sunucu tarafında yetki yine `create-member` ve `link_*`'tedir.
 *   2. Boşta duran bir hesabı seçip atamak (2026-09-30'dan beri). Liste yalnız
 *      hiçbir kayda bağlı olmayan hesaplardır.
 *
 * Önceden öğrenci ve veli için iki ayrı kopya pencere vardı; ikisi de boş
 * listede "Ayarlar → Üyeler'den açın" diyordu ve oradaki "Üye ekle" yalnız
 * öğretmen açar (0.10 doğrulaması).
 */
const KIND_TEXT: Record<
  AccountRecordKind,
  { listNoun: string; emptyHint: string }
> = {
  student: {
    listNoun: "öğrenciye",
    emptyHint: "Boşta öğrenci hesabı yok.",
  },
  guardian: {
    listNoun: "veliye",
    emptyHint: "Boşta veli hesabı yok.",
  },
};

export type AssignAccountPopoverProps = {
  kind: AccountRecordKind;
  recordId: string;
  recordName: string;
  /** Öğrencinin şubesi; velide yoktur (kurum geneli hesap). */
  branchId?: string | null;
  members: OrganizationMember[];
  onLink: (recordId: string, membershipId: string) => Promise<void> | void;
  canOpenAccount?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function AssignAccountPopover({
  kind,
  recordId,
  recordName,
  branchId = null,
  members,
  onLink,
  canOpenAccount = false,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: AssignAccountPopoverProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = isControlled
    ? (controlledOnOpenChange ?? (() => {}))
    : setUncontrolledOpen;
  const [selectedMembershipId, setSelectedMembershipId] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const text = KIND_TEXT[kind];

  const handleLinkSubmit = async () => {
    if (!selectedMembershipId || linking) return;
    setLinking(true);
    setLinkError(null);
    try {
      await onLink(recordId, selectedMembershipId);
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
          Giriş hesabı ata
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="end">
        <div className="space-y-3">
          <div>
            <h4 className="text-xs font-bold text-slate-800">
              Giriş hesabı ata
            </h4>
            <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
              {recordName} bu hesapla ORBIT'e girecek.
            </p>
          </div>

          {canOpenAccount ? (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                requestOpenAccount({ kind, recordId, recordName, branchId });
              }}
              className="w-full rounded-md bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"
            >
              + Yeni hesap aç ve bağla
            </button>
          ) : null}

          {members.length === 0 ? (
            <p className="py-1 text-[11px] text-slate-500">
              {text.emptyHint}{" "}
              {canOpenAccount
                ? "Yukarıdan yeni bir hesap açabilirsiniz."
                : "Hesabı kurum yöneticisi açar."}
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-slate-600">
                {canOpenAccount ? "ya da " : ""}henüz hiçbir {text.listNoun}{" "}
                atanmamış bir hesabı seçin:
              </p>
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
                  {linking ? "Atanıyor…" : "Ata"}
                </button>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
