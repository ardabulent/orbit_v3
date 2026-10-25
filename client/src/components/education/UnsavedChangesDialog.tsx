import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Yoklama ya da sınav ekranında kaydedilmemiş değişiklik varken başka yere
 * gidilmek istenince sorulan pencere (v1.4-03, v1.4-04). `EducationPlatform`'dan
 * bölündü (2026-10-25, ana plan 5.3).
 */
export function UnsavedChangesDialog({
  open,
  onOpenChange,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Kaydedilmemiş Değişiklikler</AlertDialogTitle>
          <AlertDialogDescription>
            Kaydedilmemiş değişiklikleriniz var. Sayfadan ayrılırsanız bu
            değişiklikler kaybolacak. Devam etmek istediğinize emin misiniz?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Vazgeç</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Devam Et</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
