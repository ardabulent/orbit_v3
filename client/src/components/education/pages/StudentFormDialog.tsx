import { useEffect, useState } from "react";
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
import { useSettingsBranches } from "@/settings/settingsQueries";
import { createStudent, updateStudent } from "@/education/studentService";
import { educationKeys } from "@/education/educationQueries";
import type { Student } from "../types";

export type StudentFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
  organizationId: string;
  student?: Student | null;
};

export function StudentFormDialog({
  open,
  onOpenChange,
  onDone,
  organizationId,
  student = null,
}: StudentFormDialogProps) {
  const queryClient = useQueryClient();
  const isEditMode = Boolean(student);

  const [fullName, setFullName] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    data: branchList = [],
    isLoading: branchLoading,
    error: branchQueryError,
  } = useSettingsBranches(organizationId, { enabled: open });

  const branchError =
    open && branchQueryError ? branchQueryError.message : null;

  // Diyalog açıldığında veya düzenlenen öğrenci değiştiğinde formu doldur / sıfırla.
  // R1: Yalnızca [open, student]'a bağlıdır. branchList burada yer almaz;
  // aksi halde sorgu çözüldüğünde veya her render'da kullanıcının girdiği ad silinir.
  useEffect(() => {
    if (!open) {
      return;
    }
    if (student) {
      setFullName(student.name);
      setStudentNumber(student.code ?? "");
      setSelectedBranchId(student.branchId ?? "");
      setError(null);
    } else {
      setFullName("");
      setSelectedBranchId("");
      setStudentNumber("");
      setError(null);
    }
  }, [open, student]);

  // R1: Şube çözme ayrı bir effect'e alınır.
  // Bu effect kullanıcının yazdığı alanlara asla dokunmaz;
  // yalnızca selectedBranchId henüz boşken şube eşleştirmesini tamamlar.
  useEffect(() => {
    if (!open || selectedBranchId || branchList.length === 0) {
      return;
    }
    if (student?.branch) {
      const found = branchList.find(b => b.name === student.branch);
      if (found) {
        setSelectedBranchId(found.id);
        return;
      }
    }
    if (!student) {
      const defaultBranch =
        branchList.find(
          b => b.isDefault ?? (b as { is_default?: boolean }).is_default
        ) ?? (branchList.length === 1 ? branchList[0] : undefined);
      if (defaultBranch) {
        setSelectedBranchId(defaultBranch.id);
      }
    }
  }, [open, selectedBranchId, branchList, student]);

  const reset = () => {
    setFullName("");
    setSelectedBranchId("");
    setStudentNumber("");
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

  const defaultBranch =
    branchList.find(
      b => b.isDefault ?? (b as { is_default?: boolean }).is_default
    ) ?? (branchList.length === 1 ? branchList[0] : undefined);

  const effectiveBranchId =
    selectedBranchId || (!student ? (defaultBranch?.id ?? "") : "");

  const nameValidationError =
    fullName.trim().length < 2 ? "Ad-soyad en az iki karakter olmalı." : null;
  const branchValidationError = !effectiveBranchId
    ? "Lütfen bir şube seçin."
    : null;
  const formValidationError = nameValidationError ?? branchValidationError;

  const isNumberError =
    Boolean(error) &&
    (error?.includes("numara") || error?.includes("karakter"));

  const handleSubmit = async () => {
    if (
      formValidationError ||
      submitting ||
      branchLoading ||
      Boolean(branchError) ||
      !effectiveBranchId
    ) {
      return;
    }

    setSubmitting(true);
    setError(null);

    const trimmedFullName = fullName.trim();
    const trimmedNumber = studentNumber.trim();

    try {
      if (student) {
        // Düzenleme modu: numara boş bırakıldıysa null gönderilerek temizlenir
        await updateStudent(student.id, {
          fullName: trimmedFullName,
          branchId: effectiveBranchId,
          studentNumber: trimmedNumber.length > 0 ? trimmedNumber : null,
        });

        toast.success("Öğrenci güncellendi", {
          description: `${trimmedFullName} öğrencisinin bilgileri kaydedildi.`,
        });
      } else {
        // Oluşturma modu: numara isteğe bağlıdır
        await createStudent({
          organizationId,
          branchId: effectiveBranchId,
          fullName: trimmedFullName,
          studentNumber: trimmedNumber.length > 0 ? trimmedNumber : undefined,
        });

        toast.success("Öğrenci eklendi", {
          description: `${trimmedFullName} için öğrenci kaydı oluşturuldu.`,
        });
      }

      await queryClient.invalidateQueries({
        queryKey: educationKeys.students(organizationId),
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
            {isEditMode ? "Öğrenciyi düzenle" : "Yeni öğrenci ekle"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Öğrencinin ad-soyad, şube ve kurum defterindeki numara bilgilerini güncelleyin."
              : "Öğrenci kaydını oluşturun. Öğrenci numarası isteğe bağlıdır; boş bırakılabilir."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Ad-soyad */}
          <div className="grid gap-2">
            <Label htmlFor="student-full-name">
              Ad-soyad <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="student-full-name"
              value={fullName}
              onChange={event => setFullName(event.target.value)}
              placeholder="Örn. Zeynep Kaya"
              autoComplete="off"
              disabled={submitting}
            />
          </div>

          {/* Şube (#119 zorunlu) */}
          <div className="grid gap-2">
            <Label htmlFor="student-branch">
              Şube <span className="text-rose-500">*</span>
            </Label>
            <select
              id="student-branch"
              value={effectiveBranchId}
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

          {/* Öğrenci numarası (isteğe bağlı) */}
          <div className="grid gap-2">
            <Label htmlFor="student-number">
              Öğrenci numarası{" "}
              <span className="text-[11px] font-normal text-muted-foreground">
                (isteğe bağlı)
              </span>
            </Label>
            <Input
              id="student-number"
              value={studentNumber}
              onChange={event => setStudentNumber(event.target.value)}
              placeholder="Örn. 101, YKS-24018"
              autoComplete="off"
              disabled={submitting}
              className={
                isNumberError
                  ? "border-rose-400 focus-visible:ring-rose-200"
                  : undefined
              }
            />
            <p className="text-[11px] text-muted-foreground">
              Kurumun kendi defterindeki numaradır. En fazla 32 karakter
              olabilir ve kurum içinde tekildir.
            </p>
          </div>

          {/* Hata gösterimi */}
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-[12px] leading-5 text-rose-800">
              <p className="font-bold">
                {isEditMode
                  ? "Öğrenci güncellenemedi"
                  : "Öğrenci oluşturulamadı"}
              </p>
              <p className="mt-0.5 text-[11px] text-rose-700">{error}</p>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
            className="rounded-xl px-4 py-2.5 text-[12px] font-bold text-muted-foreground transition hover:bg-muted disabled:opacity-50"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={
              Boolean(formValidationError) ||
              submitting ||
              branchLoading ||
              Boolean(branchError)
            }
            title={formValidationError ?? undefined}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-[12px] font-extrabold text-white transition hover:bg-slate-800 disabled:opacity-40"
          >
            {submitting
              ? isEditMode
                ? "Kaydediliyor…"
                : "Ekleniyor…"
              : isEditMode
                ? "Değişiklikleri kaydet"
                : "Öğrenciyi ekle"}
          </button>
        </DialogFooter>

        {formValidationError ? (
          <p className="-mt-1 text-right text-[11px] font-bold text-amber-600">
            {formValidationError}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
