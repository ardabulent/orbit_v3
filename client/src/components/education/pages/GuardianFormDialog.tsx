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
import {
  createGuardian,
  updateGuardian,
  translateGuardianError,
  type Guardian,
} from "@/education/guardianService";
import { educationKeys } from "@/education/educationQueries";

export type GuardianFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
  organizationId: string;
  guardian?: Guardian | null;
};

export function GuardianFormDialog({
  open,
  onOpenChange,
  onDone,
  organizationId,
  guardian = null,
}: GuardianFormDialogProps) {
  const queryClient = useQueryClient();
  const isEditMode = Boolean(guardian);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (guardian) {
      setFullName(guardian.fullName);
      setPhone(guardian.phone ?? "");
      setError(null);
    } else {
      setFullName("");
      setPhone("");
      setError(null);
    }
  }, [open, guardian]);

  const reset = () => {
    setFullName("");
    setPhone("");
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

  const trimmedFullName = fullName.trim();
  const trimmedPhone = phone.trim();

  // Telefon zorunlu DEĞİLDİR (K-03).
  // Biçim doğrulaması bilerek YOKTUR; sabit hat, ülke kodu (+49...), yurt dışı vb. meşrudur.
  // Yalnızca veritabanı kısıtının (7-30 karakter) dışına çıkıldığında kullanıcı uyarılır.
  const nameValidationError =
    trimmedFullName.length < 2 ? "Ad-soyad en az iki karakter olmalı." : null;

  const phoneValidationError =
    trimmedPhone.length > 0 &&
    (trimmedPhone.length < 7 || trimmedPhone.length > 30)
      ? "Telefon numarası 7 ile 30 karakter arasında olmalıdır."
      : null;

  const formValidationError = nameValidationError ?? phoneValidationError;

  const handleSubmit = async () => {
    if (formValidationError || submitting || !organizationId) {
      return;
    }

    setSubmitting(true);
    setError(null);

    // Boş dize null'a dönüştürülür, böylece DB kısıtına takılmaz
    const phonePayload = trimmedPhone.length > 0 ? trimmedPhone : null;

    try {
      if (guardian) {
        await updateGuardian(organizationId, guardian.id, {
          fullName: trimmedFullName,
          phone: phonePayload,
        });

        toast.success("Veli güncellendi", {
          description: `${trimmedFullName} velisinin bilgileri kaydedildi.`,
        });
      } else {
        await createGuardian({
          organizationId,
          fullName: trimmedFullName,
          phone: phonePayload,
        });

        toast.success("Veli eklendi", {
          description: `${trimmedFullName} için veli kaydı oluşturuldu.`,
        });
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: educationKeys.guardians(organizationId),
        }),
        queryClient.invalidateQueries({
          queryKey: educationKeys.students(organizationId),
        }),
        queryClient.invalidateQueries({
          queryKey: ["settings", "members", { organizationId }],
        }),
        queryClient.invalidateQueries({
          // Öğrenci detayındaki velinin hesap rozeti bu sorgudan gelir (C-03).
          queryKey: educationKeys.studentGuardians(organizationId),
        }),
      ]);

      handleOpenChange(false);
      onDone?.();
    } catch (err) {
      const msg = translateGuardianError(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-slate-900">
            {isEditMode ? "Veliyi Düzenle" : "Yeni Veli"}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {isEditMode
              ? "Veli bilgilerini güncelleyin."
              : "Kuruma yeni bir veli kaydı ekleyin."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={e => {
            e.preventDefault();
            void handleSubmit();
          }}
          className="space-y-4 py-2"
        >
          <div className="space-y-1.5">
            <Label
              htmlFor="guardian-fullname"
              className="text-xs font-semibold"
            >
              Ad Soyad <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="guardian-fullname"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Örn. Ayşe Yılmaz"
              autoFocus
              className="text-xs"
            />
            {nameValidationError && fullName.length > 0 ? (
              <p className="text-[11px] font-semibold text-rose-600">
                {nameValidationError}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="guardian-phone" className="text-xs font-semibold">
                Telefon
              </Label>
              <span className="text-[10px] text-slate-400">İsteğe bağlı</span>
            </div>
            <Input
              id="guardian-phone"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="Örn. +90 555 123 4567 veya sabit hat"
              className="text-xs"
            />
            {phoneValidationError ? (
              <p className="text-[11px] font-semibold text-rose-600">
                {phoneValidationError}
              </p>
            ) : (
              <p className="text-[10px] text-slate-400">
                Ülke kodu, sabit hat veya yurt dışı numaraları yazılabilir.
              </p>
            )}
          </div>

          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50/80 p-2.5 text-xs font-semibold text-rose-800">
              {error}
            </div>
          ) : null}

          <DialogFooter className="gap-2 pt-2">
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={Boolean(formValidationError) || submitting}
              className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {submitting
                ? "Kaydediliyor…"
                : isEditMode
                  ? "Güncelle"
                  : "Kaydet"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
