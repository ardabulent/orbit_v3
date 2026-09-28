import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Edit2, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/auth/useAuth";
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
  archiveSubject,
  createSubject,
  DEFAULT_SUBJECT_LIMIT,
  restoreSubject,
  updateSubject,
  type Subject,
} from "@/education/subjectService";
import { educationKeys, useSubjects } from "@/education/educationQueries";
import { Badge } from "../shared";
import {
  describeSubjectUsage,
  usageFor,
  type SubjectUsage,
} from "./subjectUsage";

/**
 * Sınıflar · Dersler alt sekmesi (karar 2026-09-28; eskiden Ayarlar'ın
 * altındaki "Ders Yönetimi" bölümüydü, #287).
 *
 * "Yeni ders" düğmesi sayfa başlığındadır (Öğrenciler · Veliler ile aynı
 * düzen: sekme başına tek ekleme düğmesi). Diyalog burada yaşar; açık olup
 * olmadığını sayfa tutar.
 *
 * Her dersin altında ders programındaki yeri yazılır; programda hiç yer
 * almayan ders böylece görünür olur.
 */
export function SubjectsTab({
  addOpen,
  onAddOpenChange,
  usage = new Map(),
}: {
  addOpen: boolean;
  onAddOpenChange: (open: boolean) => void;
  usage?: Map<string, SubjectUsage>;
}) {
  const { identity } = useAuth();
  const queryClient = useQueryClient();
  const organizationId = identity?.membership?.organizationId;
  const isAdmin = identity?.membership?.role === "admin";

  const [showArchived, setShowArchived] = useState(false);

  const {
    data: subjectsResult,
    isLoading: subjectsLoading,
    error: subjectsQueryError,
  } = useSubjects({
    organizationId,
    includeArchived: showArchived,
  });

  const subjects = subjectsResult?.rows ?? [];
  const truncated = Boolean(subjectsResult?.truncated);

  // Ekleme diyalogu durumu — açıklık sayfada (başlıktaki düğme açar)
  const [newName, setNewName] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Düzenleme diyalogu durumu
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [editName, setEditName] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Kapatma (arşivleme) diyalogu durumu — window.confirm kullanılmaz (#287)
  const [subjectToArchive, setSubjectToArchive] = useState<Subject | null>(
    null
  );
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  // Geri yükleme durumu
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const invalidateSubjectQueries = async () => {
    if (!organizationId) return;
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: educationKeys.subjects(organizationId),
      }),
      queryClient.invalidateQueries({
        queryKey: educationKeys.schedule(organizationId),
      }),
      queryClient.invalidateQueries({
        queryKey: educationKeys.homework(organizationId),
      }),
      queryClient.invalidateQueries({
        queryKey: educationKeys.exam(organizationId),
      }),
      queryClient.invalidateQueries({
        queryKey: educationKeys.exams(organizationId),
      }),
    ]);
  };

  // Form kapanırken sıfırlanır; açan düğme sayfa başlığında olduğu için
  // açılış anını bu bileşen görmez.
  const setAddOpen = (open: boolean) => {
    if (!open) {
      setNewName("");
      setAddError(null);
    }
    onAddOpenChange(open);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) return;

    const trimmed = newName.trim();
    if (trimmed.length < 1 || trimmed.length > 80) {
      setAddError("Ders adı 1 ile 80 karakter arasında olmalıdır.");
      return;
    }

    setAddLoading(true);
    setAddError(null);

    try {
      const created = await createSubject({
        organizationId,
        name: trimmed,
      });

      await invalidateSubjectQueries();
      setAddOpen(false);
      toast.success("Ders oluşturuldu", {
        description: `"${created.name}" dersi başarıyla eklendi.`,
      });
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Ders oluşturulamadı.");
    } finally {
      setAddLoading(false);
    }
  };

  const handleOpenEdit = (sub: Subject) => {
    setEditingSubject(sub);
    setEditName(sub.name);
    setEditError(null);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId || !editingSubject) return;

    const trimmed = editName.trim();
    if (trimmed.length < 1 || trimmed.length > 80) {
      setEditError("Ders adı 1 ile 80 karakter arasında olmalıdır.");
      return;
    }

    setEditLoading(true);
    setEditError(null);

    try {
      const updated = await updateSubject(organizationId, editingSubject.id, {
        name: trimmed,
      });

      await invalidateSubjectQueries();
      setEditingSubject(null);
      toast.success("Ders güncellendi", {
        description: `Ders adı "${updated.name}" olarak güncellendi.`,
      });
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Ders güncellenemedi.");
    } finally {
      setEditLoading(false);
    }
  };

  const handleOpenArchive = (sub: Subject) => {
    setSubjectToArchive(sub);
    setArchiveError(null);
  };

  const handleArchiveConfirm = async () => {
    if (!organizationId || !subjectToArchive) return;

    setArchiveLoading(true);
    setArchiveError(null);

    try {
      await archiveSubject(organizationId, subjectToArchive.id);
      await invalidateSubjectQueries();
      setSubjectToArchive(null);
      toast.success("Ders kapatıldı", {
        description: `"${subjectToArchive.name}" dersi arşive alındı.`,
      });
    } catch (err) {
      setArchiveError(
        err instanceof Error ? err.message : "Ders kapatılamadı."
      );
    } finally {
      setArchiveLoading(false);
    }
  };

  const handleRestore = async (sub: Subject) => {
    if (!organizationId || restoringId) return;

    setRestoringId(sub.id);
    try {
      await restoreSubject(organizationId, sub.id);
      await invalidateSubjectQueries();
      toast.success("Ders yeniden açıldı", {
        description: `"${sub.name}" dersi tekrar aktif listeye alındı.`,
      });
    } catch (err) {
      toast.error("Ders yeniden açılamadı", {
        description:
          err instanceof Error ? err.message : "İşlem başarısız oldu.",
      });
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="mt-6">
      <div className="flex justify-end">
        <label className="flex cursor-pointer items-center gap-2 text-[12px] font-medium text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={e => setShowArchived(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          Kapatılanları göster
        </label>
      </div>

      {truncated ? (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-[12px] text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <strong className="font-bold">
              Ders listesi üst sınıra ulaştı:
            </strong>{" "}
            En fazla {DEFAULT_SUBJECT_LIMIT} ders listeleniyor. Kullanılmayan
            dersleri arşivleyin.
          </div>
        </div>
      ) : null}

      {/* Ders Listesi */}
      <div className="mt-4 rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {subjectsLoading ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : subjectsQueryError ? (
          <div className="p-6 text-center text-[13px] text-rose-600">
            {subjectsQueryError.message}
          </div>
        ) : subjects.length === 0 ? (
          <div className="p-8 text-center text-[13px] text-slate-500 dark:text-slate-400">
            {showArchived
              ? "Kapatılmış bir ders bulunmuyor."
              : "Henüz kayıtlı bir ders bulunmuyor."}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {subjects.map(sub => {
              const isArchived = Boolean(sub.archivedAt);

              return (
                <div
                  key={sub.id}
                  className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="text-[13px] font-medium text-slate-900 dark:text-slate-100">
                        {sub.name}
                      </div>
                      {isArchived ? (
                        <Badge tone="slate">Kapatıldı</Badge>
                      ) : null}
                    </div>
                    {!isArchived ? (
                      <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                        {describeSubjectUsage(usageFor(usage, sub.id))}
                      </div>
                    ) : null}
                  </div>

                  {isAdmin ? (
                    <div className="flex items-center gap-2">
                      {!isArchived ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(sub)}
                            className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 px-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            <Edit2 className="h-3 w-3" />
                            <span>Düzenle</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenArchive(sub)}
                            className="inline-flex h-7 items-center gap-1 rounded-md border border-rose-200 px-2 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Kapat</span>
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRestore(sub)}
                          disabled={restoringId === sub.id}
                          className="inline-flex h-7 items-center gap-1 rounded-md border border-emerald-200 px-2 text-[11px] font-semibold text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50 dark:border-emerald-900/50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                        >
                          <RotateCcw className="h-3 w-3" />
                          <span>Yeniden Aç</span>
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Yeni Ders Ekle Diyalogu */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>Yeni Ders Ekle</DialogTitle>
              <DialogDescription>
                Kurumunuza yeni bir ders ekleyin. Ders adı aktif dersler
                arasında benzersiz olmalıdır.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="new-subject-name">Ders Adı</Label>
                <Input
                  id="new-subject-name"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Örn: Matematik, Fizik, Türkçe"
                  disabled={addLoading}
                  maxLength={80}
                  autoFocus
                />
              </div>

              {addError ? (
                <div
                  role="alert"
                  className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-[12px] text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300"
                >
                  {addError}
                </div>
              ) : null}
            </div>

            <DialogFooter>
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                disabled={addLoading}
                className="h-9 rounded-lg border border-slate-200 px-4 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                disabled={addLoading}
                className="inline-flex h-9 items-center justify-center rounded-lg bg-blue-600 px-4 text-[12px] font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {addLoading ? "Ekleniyor…" : "Ders Ekle"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Ders Düzenle Diyalogu */}
      <Dialog
        open={Boolean(editingSubject)}
        onOpenChange={open => !open && setEditingSubject(null)}
      >
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleUpdate}>
            <DialogHeader>
              <DialogTitle>Ders Adını Düzenle</DialogTitle>
              <DialogDescription>Dersin adını güncelleyin.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-subject-name">Ders Adı</Label>
                <Input
                  id="edit-subject-name"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  disabled={editLoading}
                  maxLength={80}
                  autoFocus
                />
              </div>

              {editError ? (
                <div
                  role="alert"
                  className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-[12px] text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300"
                >
                  {editError}
                </div>
              ) : null}
            </div>

            <DialogFooter>
              <button
                type="button"
                onClick={() => setEditingSubject(null)}
                disabled={editLoading}
                className="h-9 rounded-lg border border-slate-200 px-4 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                disabled={editLoading}
                className="inline-flex h-9 items-center justify-center rounded-lg bg-blue-600 px-4 text-[12px] font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {editLoading ? "Kaydediliyor…" : "Kaydet"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dersi Kapat (Arşivle) Diyalogu — window.confirm KULLANILMAZ (#287) */}
      <Dialog
        open={Boolean(subjectToArchive)}
        onOpenChange={open => !open && setSubjectToArchive(null)}
      >
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Dersi Kapat</DialogTitle>
            <DialogDescription>
              &quot;{subjectToArchive?.name}&quot; dersini kapatmak istediğinize
              emin misiniz?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-[12px] text-slate-600 dark:text-slate-400">
            <p>
              Kapatılan ders yeni program ve ödev kayıtlarında seçilemez. Dersi
              kapatabilmek için canlı öğretmen ataması ve ders programı satırı
              bulunmamalıdır.
            </p>

            {archiveError ? (
              <div
                role="alert"
                className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-[12px] text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300 font-medium"
              >
                {archiveError}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setSubjectToArchive(null)}
              disabled={archiveLoading}
              className="h-9 rounded-lg border border-slate-200 px-4 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
            >
              Vazgeç
            </button>
            <button
              type="button"
              onClick={handleArchiveConfirm}
              disabled={archiveLoading}
              className="inline-flex h-9 items-center justify-center rounded-lg bg-rose-600 px-4 text-[12px] font-bold text-white transition hover:bg-rose-700 disabled:opacity-50"
            >
              {archiveLoading ? "Kapatılıyor…" : "Dersi Kapat"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
