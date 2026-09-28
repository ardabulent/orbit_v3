import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  useSettingsBranches,
  useSettingsMembers,
} from "@/settings/settingsQueries";
import { createClass, updateClass } from "@/education/classService";
import { educationKeys } from "@/education/educationQueries";
import type { ClassGroup } from "../types";
import { eligibleTeachers } from "./teacherEligibility";
import { TeacherOptionGroups } from "./TeacherOptionGroups";

export type ClassFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
  organizationId: string;
  classData?: ClassGroup | null;
};

export function ClassFormDialog({
  open,
  onOpenChange,
  onDone,
  organizationId,
  classData = null,
}: ClassFormDialogProps) {
  const queryClient = useQueryClient();
  const isEditMode = Boolean(classData);

  const [name, setName] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [program, setProgram] = useState("");
  const [mentorMembershipId, setMentorMembershipId] = useState("");
  const [capacity, setCapacity] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    data: branchList = [],
    isLoading: branchLoading,
    error: branchQueryError,
  } = useSettingsBranches(organizationId, { enabled: open });

  const { data: memberList = [], isLoading: membersLoading } =
    useSettingsMembers({ organizationId, enabled: open });

  // Rehber öğretmen listesi: Kural gereği yalnız admin ve teacher rolleri seçilebilir
  // Öğrenci veya veli üyeliği listelenmez (ORB03 hatasını baştan engellemek için)
  const eligibleMentors = useMemo(() => {
    return eligibleTeachers(memberList);
  }, [memberList]);

  const branchError =
    open && branchQueryError ? branchQueryError.message : null;

  // Diyalog açıldığında veya düzenlenen sınıf değiştiğinde formu doldur / sıfırla.
  // R1 tuzağı: Yalnızca [open, classData]'ya bağlıdır. branchList veya memberList burada yer almaz;
  // aksi halde sorgular çözülürken kullanıcının yazdığı isim silinir.
  useEffect(() => {
    if (!open) {
      return;
    }
    if (classData) {
      setName(classData.name);
      setSelectedBranchId(classData.branchId ?? "");
      setProgram(classData.program ?? "");
      setMentorMembershipId(classData.mentorMembershipId ?? "");
      setCapacity(
        classData.capacity !== null && classData.capacity !== undefined
          ? String(classData.capacity)
          : ""
      );
      setError(null);
    } else {
      setName("");
      setSelectedBranchId("");
      setProgram("");
      setMentorMembershipId("");
      setCapacity("");
      setError(null);
    }
  }, [open, classData]);

  // Şube çözme ayrı bir effect'e alınır.
  // Bu effect kullanıcının yazdığı alanlara asla dokunmaz;
  // yalnızca selectedBranchId henüz boşken şube eşleştirmesini tamamlar.
  useEffect(() => {
    if (!open || selectedBranchId || branchList.length === 0) {
      return;
    }
    if (classData?.branch) {
      const found = branchList.find(b => b.name === classData.branch);
      if (found) {
        setSelectedBranchId(found.id);
        return;
      }
    }
    if (!classData && branchList.length === 1) {
      setSelectedBranchId(branchList[0].id);
    }
  }, [open, selectedBranchId, branchList, classData]);

  const reset = () => {
    setName("");
    setSelectedBranchId("");
    setProgram("");
    setMentorMembershipId("");
    setCapacity("");
    setError(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (submitting) {
      return;
    }
    if (!next) {
      reset();
    }
    onOpenChange(next);
  };

  const nameValidationError =
    name.trim().length === 0
      ? "Sınıf adı zorunludur."
      : name.trim().length > 120
        ? "Sınıf adı en fazla 120 karakter olabilir."
        : null;

  const branchValidationError = !selectedBranchId
    ? "Lütfen bir şube seçin."
    : null;

  const capacityValidationError = (() => {
    const trimmed = capacity.trim();
    if (!trimmed) return null;
    const num = Number(trimmed);
    if (!Number.isInteger(num) || num < 1 || num > 1000) {
      return "Kontenjan 1 ile 1000 arasında bir tam sayı olmalıdır.";
    }
    return null;
  })();

  const formValidationError =
    nameValidationError ?? branchValidationError ?? capacityValidationError;

  const handleSubmit = async () => {
    if (
      formValidationError ||
      submitting ||
      branchLoading ||
      Boolean(branchError) ||
      !selectedBranchId
    ) {
      return;
    }

    setSubmitting(true);
    setError(null);

    const trimmedName = name.trim();
    const trimmedProgram = program.trim();
    const trimmedCapacity = capacity.trim();
    const parsedCapacity = trimmedCapacity
      ? parseInt(trimmedCapacity, 10)
      : null;

    try {
      if (classData) {
        await updateClass(classData.id, {
          name: trimmedName,
          program: trimmedProgram.length > 0 ? trimmedProgram : null,
          branchId: selectedBranchId,
          mentorMembershipId:
            mentorMembershipId.length > 0 ? mentorMembershipId : null,
          capacity: parsedCapacity,
        });

        toast.success("Sınıf güncellendi", {
          description: `${trimmedName} sınıfının bilgileri kaydedildi.`,
        });
      } else {
        await createClass({
          organizationId,
          branchId: selectedBranchId,
          name: trimmedName,
          program: trimmedProgram.length > 0 ? trimmedProgram : null,
          mentorMembershipId:
            mentorMembershipId.length > 0 ? mentorMembershipId : null,
          capacity: parsedCapacity,
        });

        toast.success("Sınıf eklendi", {
          description: `${trimmedName} sınıfı başarıyla oluşturuldu.`,
        });
      }

      await queryClient.invalidateQueries({
        queryKey: educationKeys.classes(organizationId),
      });

      handleOpenChange(false);
      onDone();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "İşlem gerçekleştirilemedi. Lütfen tekrar deneyin."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Sınıfı düzenle" : "Yeni sınıf ekle"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Sınıf adı, program, rehber öğretmen ve kontenjan bilgilerini güncelleyin."
              : "Kuruma yeni sınıf ekleyin. Kontenjan isteğe bağlıdır."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Sınıf Adı */}
          <div className="grid gap-2">
            <Label htmlFor="class-name">
              Sınıf adı <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="class-name"
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="Örn. 12-A Sayısal"
              autoComplete="off"
              disabled={submitting}
            />
          </div>

          {/* Şube */}
          <div className="grid gap-2">
            <Label htmlFor="class-branch">
              Şube <span className="text-rose-500">*</span>
            </Label>
            <select
              id="class-branch"
              value={selectedBranchId}
              onChange={event => setSelectedBranchId(event.target.value)}
              disabled={submitting || branchLoading || Boolean(branchError)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="" disabled>
                Şube seçin…
              </option>
              {branchList.map(branch => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
            {branchLoading ? (
              <div
                role="status"
                aria-busy="true"
                className="flex items-center gap-2 pt-1"
              >
                <Skeleton className="h-3.5 w-28 bg-slate-100" />
                <span className="sr-only">Şubeler yükleniyor…</span>
              </div>
            ) : null}
            {branchError ? (
              <p className="text-[11px] font-bold text-rose-600">
                {branchError}
              </p>
            ) : null}
          </div>

          {/* Program */}
          <div className="grid gap-2">
            <Label htmlFor="class-program">
              Program{" "}
              <span className="text-[11px] font-normal text-muted-foreground">
                (isteğe bağlı)
              </span>
            </Label>
            <Input
              id="class-program"
              value={program}
              onChange={event => setProgram(event.target.value)}
              placeholder="Örn. YKS, LGS, 11. Sınıf"
              autoComplete="off"
              disabled={submitting}
            />
          </div>

          {/* Rehber Öğretmen */}
          <div className="grid gap-2">
            <Label htmlFor="class-mentor">
              Rehber öğretmen{" "}
              <span className="text-[11px] font-normal text-muted-foreground">
                (isteğe bağlı)
              </span>
            </Label>
            <select
              id="class-mentor"
              value={mentorMembershipId}
              onChange={event => setMentorMembershipId(event.target.value)}
              disabled={submitting || membersLoading}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Seçilmedi</option>
              <TeacherOptionGroups members={eligibleMentors} />
            </select>
            <p className="text-[11px] text-muted-foreground">
              Yalnızca öğretmen veya yönetici rolündeki üyeler seçilebilir.
            </p>
          </div>

          {/* Kontenjan */}
          <div className="grid gap-2">
            <Label htmlFor="class-capacity">
              Kontenjan{" "}
              <span className="text-[11px] font-normal text-muted-foreground">
                (isteğe bağlı, 1–1000)
              </span>
            </Label>
            <Input
              id="class-capacity"
              type="number"
              min={1}
              max={1000}
              value={capacity}
              onChange={event => setCapacity(event.target.value)}
              placeholder="Örn. 24"
              autoComplete="off"
              disabled={submitting}
            />
            <p className="text-[11px] text-muted-foreground">
              Boş bırakılabilir. Derslik seçimi ders programı modülündedir.
            </p>
          </div>

          {/* Hata bildirimi */}
          {error ? (
            <div
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
            >
              {error}
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
            className="rounded-lg border border-slate-200 px-4 py-2 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={
              submitting ||
              branchLoading ||
              Boolean(branchError) ||
              Boolean(formValidationError)
            }
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-[12px] font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? (
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent"
                  aria-hidden="true"
                />
                <span>{isEditMode ? "Kaydediliyor…" : "Ekleniyor…"}</span>
              </div>
            ) : (
              <span>
                {isEditMode ? "Değişiklikleri kaydet" : "Sınıfı ekle"}
              </span>
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
