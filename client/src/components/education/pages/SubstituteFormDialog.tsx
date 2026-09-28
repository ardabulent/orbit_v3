import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSubstitute } from "@/education/substituteService";
import { getOrbitToday } from "@/education/trDate";
import type { OrganizationMember } from "@/organization/memberService";
import type { ScheduleItem } from "../types";
import { TeacherOptionGroups } from "./TeacherOptionGroups";
import { timeRange } from "./scheduleGrid";

const SELECT =
  "h-9 rounded-lg border border-slate-200 bg-white px-2 text-[12px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500";

/**
 * Yeni vekillik: kim izinli, yerine kim, hangi tarihler arası.
 *
 * Diyalog yalnız açıkken çizilir; her açılış temiz bir form demektir.
 * İzinli öğretmen seçilince programdaki dersleri gösterilir — yönetici
 * vekilin neyi devraldığını kaydetmeden görsün.
 */
export function SubstituteFormDialog({
  onOpenChange,
  organizationId,
  teachers,
  schedule,
  onCreated,
}: {
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  /** Seçilebilir üyeler: etkin öğretmen ve yöneticiler. */
  teachers: OrganizationMember[];
  schedule: ScheduleItem[];
  onCreated: () => Promise<void>;
}) {
  const today = getOrbitToday();
  const [absentId, setAbsentId] = useState("");
  const [substituteId, setSubstituteId] = useState("");
  const [startsOn, setStartsOn] = useState(today);
  const [endsOn, setEndsOn] = useState(today);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const absentLessons = absentId
    ? schedule
        .filter(item => item.membershipId === absentId)
        .sort(
          (a, b) =>
            (a.dayOfWeek ?? 8) - (b.dayOfWeek ?? 8) ||
            a.time.localeCompare(b.time)
        )
    : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!absentId || !substituteId) {
      setError("İzinli öğretmeni ve vekili seçin.");
      return;
    }
    if (absentId === substituteId) {
      setError("Öğretmen kendi yerine vekil olamaz.");
      return;
    }
    if (!startsOn || !endsOn || endsOn < startsOn) {
      setError("Bitiş tarihi başlangıçtan önce olamaz.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await createSubstitute({
        organizationId,
        absentMembershipId: absentId,
        substituteMembershipId: substituteId,
        startsOn,
        endsOn,
        note,
      });
      await onCreated();
      toast.success("Vekil atandı");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vekil atanamadı.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Vekil ata</DialogTitle>
            <DialogDescription>
              Seçilen tarihlerde vekil, izinli öğretmenin sınıflarını görür,
              yoklama alır ve not girer. Süre bitince erişimi kendiliğinden
              kapanır. Tek günlük vekillik için iki tarihi aynı seçin.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label htmlFor="substitute-absent" className="text-[11px]">
                  İzinli öğretmen
                </Label>
                <select
                  id="substitute-absent"
                  value={absentId}
                  onChange={e => {
                    setError(null);
                    setAbsentId(e.target.value);
                  }}
                  disabled={loading}
                  className={SELECT}
                >
                  <option value="">Seçin</option>
                  <TeacherOptionGroups members={teachers} />
                </select>
              </div>
              <div className="grid gap-1">
                <Label htmlFor="substitute-cover" className="text-[11px]">
                  Vekil
                </Label>
                <select
                  id="substitute-cover"
                  value={substituteId}
                  onChange={e => {
                    setError(null);
                    setSubstituteId(e.target.value);
                  }}
                  disabled={loading}
                  className={SELECT}
                >
                  <option value="">Seçin</option>
                  <TeacherOptionGroups
                    members={teachers.filter(t => t.membershipId !== absentId)}
                  />
                </select>
              </div>
            </div>

            {absentId ? (
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <p className="text-[11px] font-bold text-slate-700">
                  {absentLessons.length > 0
                    ? `Programdaki dersleri (haftada ${absentLessons.length})`
                    : "Programda dersi yok"}
                </p>
                {absentLessons.length > 0 ? (
                  <ul className="mt-1.5 space-y-0.5">
                    {absentLessons.slice(0, 8).map(item => (
                      <li
                        key={item.id ?? `${item.day}-${item.time}`}
                        className="text-[11px] text-slate-600"
                      >
                        {item.day} {timeRange(item)} · {item.title}
                        {item.group ? ` · ${item.group}` : ""}
                      </li>
                    ))}
                    {absentLessons.length > 8 ? (
                      <li className="text-[11px] text-slate-400">
                        +{absentLessons.length - 8} ders daha
                      </li>
                    ) : null}
                  </ul>
                ) : (
                  <p className="mt-1 text-[11px] text-slate-500">
                    Vekil yine de öğretmenin atandığı ve rehberi olduğu
                    sınıfları görür.
                  </p>
                )}
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label htmlFor="substitute-start" className="text-[11px]">
                  Başlangıç
                </Label>
                <Input
                  id="substitute-start"
                  type="date"
                  value={startsOn}
                  onChange={e => {
                    setError(null);
                    setStartsOn(e.target.value);
                    if (endsOn < e.target.value) setEndsOn(e.target.value);
                  }}
                  disabled={loading}
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="substitute-end" className="text-[11px]">
                  Bitiş (dahil)
                </Label>
                <Input
                  id="substitute-end"
                  type="date"
                  value={endsOn}
                  min={startsOn}
                  onChange={e => {
                    setError(null);
                    setEndsOn(e.target.value);
                  }}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="grid gap-1">
              <Label htmlFor="substitute-note" className="text-[11px]">
                Not (isteğe bağlı)
              </Label>
              <Input
                id="substitute-note"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Örn: yıllık izin, rapor"
                maxLength={500}
                disabled={loading}
              />
            </div>

            {error ? (
              <div
                role="alert"
                className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-[12px] text-rose-700"
              >
                {error}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="h-9 rounded-lg border border-slate-200 px-4 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-9 items-center justify-center rounded-lg bg-blue-600 px-4 text-[12px] font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Kaydediliyor…" : "Vekil ata"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
