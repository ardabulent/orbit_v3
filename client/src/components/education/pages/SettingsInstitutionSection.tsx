import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building2,
  Edit2,
  Plus,
  RotateCcw,
  Star,
  Trash2,
} from "lucide-react";
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
  archiveBranch,
  createBranch,
  restoreBranch,
  setDefaultBranch,
  updateBranch,
  type Branch,
} from "@/organization/branchService";
import { settingsKeys, useBranches } from "@/settings/settingsQueries";
import { Badge } from "../shared";
import { SettingsFormField } from "./SettingsFormField";

export function SettingsInstitutionSection() {
  const { identity } = useAuth();
  const queryClient = useQueryClient();
  const organizationId = identity?.membership?.organizationId;
  const isAdmin = identity?.membership?.role === "admin";
  const name = identity?.membership?.organizationName ?? "";
  const branch = identity?.membership?.branchName ?? "Kurum geneli";

  // Arşivlenen şubeleri gösterme durumu
  const [showArchived, setShowArchived] = useState(false);

  // Şubeleri yükle
  const {
    data: branchesResult,
    isLoading: branchesLoading,
    error: branchesQueryError,
  } = useBranches(organizationId, {
    includeArchived: showArchived,
  });

  const branches = branchesResult?.rows ?? [];
  const truncated = Boolean(branchesResult?.truncated);

  // Ekleme diyalogu durumu
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIsDefault, setNewIsDefault] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Düzenleme diyalogu durumu
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [editName, setEditName] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Kapatma (arşivleme) diyalogu durumu — window.confirm kullanılmaz (#284)
  const [branchToArchive, setBranchToArchive] = useState<Branch | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  // Tekil işlem durumları
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);

  const savePreferences = () =>
    toast.info("Kurum tercihleri salt okunur", {
      description:
        "Kurum ve şube bilgileri organizasyon üyeliğinizden okunmaktadır; panelden düzenleme sonraki sürümdedir.",
    });

  const invalidateBranchQueries = async () => {
    if (!organizationId) return;
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: settingsKeys.branches(organizationId),
      }),
      queryClient.invalidateQueries({
        queryKey: settingsKeys.members(organizationId),
      }),
    ]);
  };

  const handleOpenAdd = () => {
    setNewName("");
    setNewIsDefault(false);
    setAddError(null);
    setAddOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) return;

    const trimmed = newName.trim();
    if (trimmed.length < 2) {
      setAddError("Şube adı en az 2 karakter olmalıdır.");
      return;
    }

    setAddLoading(true);
    setAddError(null);

    try {
      await createBranch({
        organizationId,
        name: trimmed,
        isDefault: newIsDefault,
      });
      await invalidateBranchQueries();
      toast.success("Şube başarıyla eklendi.");
      setAddOpen(false);
    } catch (err) {
      setAddError(hataCumlesi(err, "Şube eklenemedi."));
    } finally {
      setAddLoading(false);
    }
  };

  const handleOpenEdit = (target: Branch) => {
    setEditingBranch(target);
    setEditName(target.name);
    setEditError(null);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId || !editingBranch) return;

    const trimmed = editName.trim();
    if (trimmed.length < 2) {
      setEditError("Şube adı en az 2 karakter olmalıdır.");
      return;
    }

    setEditLoading(true);
    setEditError(null);

    try {
      await updateBranch(organizationId, editingBranch.id, {
        name: trimmed,
      });
      await invalidateBranchQueries();
      toast.success("Şube bilgileri güncellendi.");
      setEditingBranch(null);
    } catch (err) {
      setEditError(hataCumlesi(err, "Şube güncellenemedi."));
    } finally {
      setEditLoading(false);
    }
  };

  /**
   * Servisten gelen hatanın cümlesi.
   *
   * ⚠️ `translateBranchError`'ı BURADA bir daha çağırma. `branchService`'in
   * bütün yazmaları hatayı zaten çevirip `new Error(çeviri)` fırlatıyor;
   * ikinci bir çeviri o cümleyi tanımaz ve çevirmenin genel yedeğine düşer —
   * ölçüldü: "içinde aktif 3 öğrenci, 2 sınıf, 1 üye kaydı bulunuyor" cümlesi
   * ekrana "Şube işlemi gerçekleştirilemedi" olarak çıkıyordu. K-14 mesajları
   * da aynı yerde kayboluyordu.
   *
   * Depodaki desen bu: öğrenci ve sınıf tarafı da `err.message` okuyor.
   */
  const hataCumlesi = (err: unknown, yedek: string) =>
    err instanceof Error && err.message ? err.message : yedek;

  const handleSetDefault = async (target: Branch) => {
    if (!organizationId || settingDefaultId) return;

    setSettingDefaultId(target.id);
    try {
      await setDefaultBranch(organizationId, target.id);
      await invalidateBranchQueries();
      toast.success(`"${target.name}" varsayılan şube yapıldı.`);
    } catch (err) {
      toast.error(hataCumlesi(err, "Varsayılan şube değiştirilemedi."));
    } finally {
      setSettingDefaultId(null);
    }
  };

  const handleOpenArchive = (target: Branch) => {
    setBranchToArchive(target);
    setArchiveError(null);
  };

  const handleArchiveConfirm = async () => {
    if (!organizationId || !branchToArchive) return;

    setArchiveLoading(true);
    setArchiveError(null);

    try {
      await archiveBranch(organizationId, branchToArchive.id);
      await invalidateBranchQueries();
      toast.success(`"${branchToArchive.name}" şubesi kapatıldı.`);
      setBranchToArchive(null);
    } catch (err) {
      setArchiveError(hataCumlesi(err, "Şube kapatılamadı."));
    } finally {
      setArchiveLoading(false);
    }
  };

  const handleRestore = async (target: Branch) => {
    if (!organizationId || restoringId) return;

    setRestoringId(target.id);
    try {
      await restoreBranch(organizationId, target.id);
      await invalidateBranchQueries();
      toast.success(`"${target.name}" şubesi yeniden açıldı.`);
    } catch (err) {
      toast.error(hataCumlesi(err, "Şube yeniden açılamadı."));
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-[18px] font-extrabold text-slate-900 dark:text-slate-100">
          Kurum Tercihleri
        </h2>
        <button
          onClick={savePreferences}
          className="inline-flex h-9 items-center justify-center rounded-xl bg-slate-900 px-4 text-[11px] font-bold text-white shadow-[0_8px_16px_rgba(15,23,42,.12)] transition hover:bg-slate-800 active:scale-[.98] dark:bg-slate-100 dark:text-slate-900"
        >
          Değişiklikleri Kaydet
        </button>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <SettingsFormField label="Kurum adı" value={name} disabled />
        <SettingsFormField label="Şube" value={branch} disabled />
      </div>

      {/* Şube Yönetimi Bölümü (v1.4-09 · #284) */}
      <div className="mt-10 border-t border-slate-200/80 pt-8 dark:border-slate-800">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-slate-600 dark:text-slate-300" />
              <h3 className="font-display text-[16px] font-extrabold text-slate-900 dark:text-slate-100">
                Şubeler
              </h3>
            </div>
            <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
              Kurumun şubelerini yönetin, yeni şube ekleyin veya varsayılan
              şubeyi belirleyin.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowArchived(!showArchived)}
              className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700/50"
            >
              {showArchived ? "Yalnız Aktif Şubeler" : "Kapatılan Şubeleri Gör"}
            </button>

            {isAdmin ? (
              <button
                type="button"
                onClick={handleOpenAdd}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[11px] font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-[.98]"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Yeni Şube Ekle</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* Truncated (kesilme) uyarısı */}
        {truncated ? (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-[12px] text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <strong className="font-bold">
                Şube listesi üst sınıra ulaştı:
              </strong>{" "}
              Tüm şubelerin görüntülenebilmesi için kullanılmayan şubeleri
              arşivleyin.
            </div>
          </div>
        ) : null}

        {/* Şube Listesi */}
        <div className="mt-4 rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {branchesLoading ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : branchesQueryError ? (
            <div className="p-6 text-center text-[13px] text-rose-600">
              {branchesQueryError.message}
            </div>
          ) : branches.length === 0 ? (
            <div className="p-8 text-center text-[13px] text-slate-500 dark:text-slate-400">
              {showArchived
                ? "Kapatılmış bir şube bulunmuyor."
                : "Henüz kayıtlı bir şube bulunmuyor."}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {branches.map(b => {
                const isDefault = Boolean(b.isDefault);
                const isArchived = Boolean(b.archivedAt);

                return (
                  <div
                    key={b.id}
                    className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="font-medium text-slate-900 dark:text-slate-100 text-[13px]">
                        {b.name}
                      </div>
                      {isDefault ? (
                        <Badge tone="green">Varsayılan</Badge>
                      ) : null}
                      {isArchived ? (
                        <Badge tone="slate">Kapatıldı</Badge>
                      ) : null}
                    </div>

                    {/* Yönetici eylemleri (Yönetici olmayan rolde çizilmez) */}
                    {isAdmin ? (
                      <div className="flex items-center gap-2">
                        {!isArchived ? (
                          <>
                            {!isDefault ? (
                              <button
                                type="button"
                                onClick={() => handleSetDefault(b)}
                                disabled={settingDefaultId === b.id}
                                className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 px-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                              >
                                <Star className="h-3 w-3" />
                                <span>Varsayılan Yap</span>
                              </button>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => handleOpenEdit(b)}
                              className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 px-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              <Edit2 className="h-3 w-3" />
                              <span>Düzenle</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenArchive(b)}
                              className="inline-flex h-7 items-center gap-1 rounded-md border border-rose-200 px-2 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Kapat</span>
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRestore(b)}
                            disabled={restoringId === b.id}
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
      </div>

      {/* Yeni Şube Ekle Diyalogu */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>Yeni Şube Ekle</DialogTitle>
              <DialogDescription>
                Kurumunuza yeni bir şube ekleyin. Şube adı aktif şubeler
                arasında benzersiz olmalıdır.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="new-branch-name">Şube Adı</Label>
                <Input
                  id="new-branch-name"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Örn: Beşiktaş Şubesi"
                  disabled={addLoading}
                  autoFocus
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="new-branch-default"
                  checked={newIsDefault}
                  onChange={e => setNewIsDefault(e.target.checked)}
                  disabled={addLoading}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <Label
                  htmlFor="new-branch-default"
                  className="text-[12px] font-normal cursor-pointer"
                >
                  Bu şubeyi kurumun varsayılan şubesi yap
                </Label>
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
                {addLoading ? "Ekleniyor…" : "Şube Ekle"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Şube Düzenle Diyalogu */}
      <Dialog
        open={Boolean(editingBranch)}
        onOpenChange={open => !open && setEditingBranch(null)}
      >
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleUpdate}>
            <DialogHeader>
              <DialogTitle>Şube Adını Düzenle</DialogTitle>
              <DialogDescription>Şubenin adını güncelleyin.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-branch-name">Şube Adı</Label>
                <Input
                  id="edit-branch-name"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  disabled={editLoading}
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
                onClick={() => setEditingBranch(null)}
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

      {/* Şubeyi Kapat (Arşivle) Diyalogu — window.confirm KULLANILMAZ (#284) */}
      <Dialog
        open={Boolean(branchToArchive)}
        onOpenChange={open => !open && setBranchToArchive(null)}
      >
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Şubeyi Kapat</DialogTitle>
            <DialogDescription>
              &quot;{branchToArchive?.name}&quot; şubesini kapatmak istediğinize
              emin misiniz?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-[12px] text-slate-600 dark:text-slate-400">
            <p>
              Kapatılan şube yeni kayıtlar için seçilemez. Şubenin
              kapatılabilmesi için içinde aktif öğrenci, sınıf veya personel
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
              onClick={() => setBranchToArchive(null)}
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
              {archiveLoading ? "Kapatılıyor…" : "Şubeyi Kapat"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
