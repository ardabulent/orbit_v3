import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  educationKeys,
  useGuardians,
  useStudents,
} from "@/education/educationQueries";
import { linkStudentAccount } from "@/education/studentService";
import { linkGuardianAccount } from "@/education/guardianService";
import { settingsKeys } from "@/settings/settingsQueries";
import type { OrganizationMember } from "@/organization/memberService";

/**
 * Üyeler ekranından giriş hesabını bir öğrenci ya da veli KAYDINA atar
 * (2026-10-15, analiz turu). Aynı işlem Öğrenciler ekranındaki "Giriş hesabı
 * ata" düğmesinde de var; ama hesabı açan yönetici Üyeler'de duruyor ve atama
 * orada gözden kaçıyordu (Ogrenci1/Veli1 kayda atanmadan kaldı). Liste yalnız
 * henüz hesabı olmayan kayıtlardır; yetki SQL'de (`link_*_account`).
 */
export function AssignRecordPopover({
  member,
  organizationId,
}: {
  member: OrganizationMember;
  organizationId: string;
}) {
  const queryClient = useQueryClient();
  const isStudent = member.role === "student";
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const studentsQuery = useStudents({ enabled: open && isStudent });
  const guardiansQuery = useGuardians({ enabled: open && !isStudent });

  const candidates = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("tr-TR");
    const rows = isStudent
      ? (studentsQuery.data?.rows ?? [])
          .filter(s => !s.hasAccount)
          .map(s => ({ id: s.id, name: s.name, detail: s.group ?? "" }))
      : (guardiansQuery.data?.rows ?? [])
          .filter(g => !g.hasAccount)
          .map(g => ({
            id: g.id,
            name: g.fullName,
            detail: g.studentNames?.join(", ") ?? "",
          }));
    return term
      ? rows.filter(r => r.name.toLocaleLowerCase("tr-TR").includes(term))
      : rows;
  }, [isStudent, search, studentsQuery.data, guardiansQuery.data]);

  const loading = isStudent
    ? studentsQuery.isLoading
    : guardiansQuery.isLoading;

  const assign = async () => {
    if (!selectedId || saving) return;
    setSaving(true);
    setError(null);
    try {
      if (isStudent) {
        await linkStudentAccount(selectedId, member.membershipId);
      } else {
        await linkGuardianAccount(selectedId, member.membershipId);
      }
      toast.success("Hesap kayda atandı", {
        description: isStudent
          ? "Öğrenci artık kendi derslerini ve sonuçlarını görür."
          : "Veli artık çocuğunun derslerini ve sonuçlarını görür.",
      });
      setOpen(false);
      setSelectedId("");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: settingsKeys.members(organizationId),
        }),
        queryClient.invalidateQueries({
          queryKey: isStudent
            ? educationKeys.students(organizationId)
            : educationKeys.guardians(organizationId),
        }),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Atama yapılamadı.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="-ml-1 rounded-lg px-1 py-0.5 text-[11px] font-bold text-blue-600 transition hover:bg-blue-50"
        >
          Kayda ata
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" collisionPadding={16} className="w-80 p-3">
        <p className="text-[12px] font-bold text-slate-900">
          {isStudent ? "Öğrenci kaydı seçin" : "Veli kaydı seçin"}
        </p>
        <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
          Yalnız henüz giriş hesabı olmayan kayıtlar listelenir.
        </p>
        <input
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Ada göre ara"
          aria-label="Kayıt ara"
          className="mt-2 h-8 w-full rounded-lg border border-slate-200 px-2.5 text-[12px] outline-none focus:border-blue-400"
        />
        <div
          role="listbox"
          aria-label="Kayıtlar"
          className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-slate-100"
        >
          {loading ? (
            <p className="px-3 py-4 text-center text-[11px] text-slate-400">
              Yükleniyor…
            </p>
          ) : candidates.length === 0 ? (
            <p className="px-3 py-4 text-center text-[11px] leading-4 text-slate-400">
              {isStudent
                ? "Hesabı olmayan öğrenci kaydı yok. Önce Öğrenciler ekranından kayıt ekleyin."
                : "Hesabı olmayan veli kaydı yok. Önce Öğrenciler → Veliler'den kayıt ekleyin."}
            </p>
          ) : (
            candidates.map(row => (
              <button
                key={row.id}
                type="button"
                role="option"
                aria-selected={selectedId === row.id}
                onClick={() => setSelectedId(row.id)}
                className={`block w-full px-3 py-2 text-left transition ${
                  selectedId === row.id ? "bg-blue-50" : "hover:bg-slate-50"
                }`}
              >
                <span className="block text-[12px] font-semibold text-slate-800">
                  {row.name}
                </span>
                {row.detail ? (
                  <span className="block text-[10px] text-slate-500">
                    {row.detail}
                  </span>
                ) : null}
              </button>
            ))
          )}
        </div>
        {error ? (
          <p className="mt-2 rounded-lg bg-rose-50 px-2.5 py-2 text-[11px] text-rose-700">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => void assign()}
          disabled={!selectedId || saving}
          className="mt-2 h-8 w-full rounded-lg bg-slate-900 text-[12px] font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Atanıyor" : "Hesabı bu kayda ata"}
        </button>
      </PopoverContent>
    </Popover>
  );
}
