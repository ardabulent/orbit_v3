import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { OrganizationMember } from "@/organization/memberService";
import type { Student } from "../types";

/**
 * Öğrenci KAYDINA (ad, sınıf, veli) öğrencinin ORBIT'e girdiği HESABI atar.
 * Liste yalnız hiçbir kayda bağlı olmayan öğrenci hesaplarıdır (2026-09-30);
 * "hesap bağlama" sözcüğü aynı kişinin iki hesabını birleştirmek için
 * Ayarlar'da ayrıca kullanıldığından burada "giriş hesabı ata" denir.
 */
export function LinkAccountPopover({
  student,
  members,
  onLink,
}: {
  student: Student;
  members: OrganizationMember[];
  onLink: (studentId: string, membershipId: string) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [selectedMembershipId, setSelectedMembershipId] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const handleLinkSubmit = async () => {
    if (!selectedMembershipId || linking) return;
    setLinking(true);
    setLinkError(null);
    try {
      await onLink(student.id, selectedMembershipId);
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
              {student.name} bu hesapla ORBIT'e girecek. Listede yalnız henüz
              hiçbir öğrenciye atanmamış hesaplar var.
            </p>
          </div>
          {members.length === 0 ? (
            <p className="py-1 text-[11px] text-slate-500">
              Boşta öğrenci hesabı yok. Yeni öğrenci eklerken hesap da
              açılabilir; ya da Ayarlar → Üyeler'den açın.
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
