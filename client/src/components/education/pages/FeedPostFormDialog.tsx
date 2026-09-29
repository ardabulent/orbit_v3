import { useState } from "react";
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
import { educationKeys } from "@/education/educationQueries";
import {
  createFeedPost,
  updateFeedPost,
  type FeedPost,
  FEED_AUDIENCE_LABELS,
  type FeedAudience,
} from "@/education/feedService";
import type { Role } from "../types";

export type FeedPostFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  role: Role;
  classes: { id: string; name: string }[];
  post?: FeedPost | null;
  onDone?: () => void;
};

export function FeedPostFormDialog({
  open,
  onOpenChange,
  organizationId,
  role,
  classes,
  post,
  onDone,
}: FeedPostFormDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = Boolean(post?.id);

  const [classId, setClassId] = useState<string>(() =>
    post
      ? (post.classId ?? "")
      : role === "teacher"
        ? (classes[0]?.id ?? "")
        : ""
  );
  const [title, setTitle] = useState<string>(() => post?.title ?? "");
  const [body, setBody] = useState<string>(() => post?.body ?? "");
  // Hedef kitle ve önemli (karar 2026-09-29). Veritabanı uygular; burada
  // yalnız seçilir.
  const [audience, setAudience] = useState<FeedAudience>(
    () => post?.audience ?? "all"
  );
  const [pinned, setPinned] = useState<boolean>(() => post?.pinned ?? false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) return;

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Lütfen bir duyuru başlığı girin.");
      return;
    }

    // ⚠️ Öğretmen kurum geneli duyuru yazamaz (RLS 42501 engeller, UI seçenek vermez)
    if (role === "teacher" && !classId) {
      setError("Öğretmenler yalnızca okuttukları sınıflara duyuru yazabilir.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isEditing && post?.id) {
        await updateFeedPost(organizationId, post.id, {
          classId: classId ? classId : null,
          title: trimmedTitle,
          body: body.trim() || null,
          audience,
          pinned,
        });
        toast.success("Duyuru güncellendi", {
          description: `"${trimmedTitle}" başlıklı duyuru başarıyla güncellendi.`,
        });
      } else {
        await createFeedPost({
          organizationId,
          classId: classId ? classId : null,
          title: trimmedTitle,
          body: body.trim() || null,
          audience,
          pinned,
        });
        toast.success("Duyuru paylaşıldı", {
          description: `"${trimmedTitle}" başlıklı duyuru başarıyla yayınlandı.`,
        });
      }

      await queryClient.invalidateQueries({
        queryKey: educationKeys.feed(organizationId),
      });

      onOpenChange(false);
      onDone?.();
    } catch (err) {
      // 🔴 Hatayı servis çevirir, ekran yalnız taşır — ikinci kez çevirme (K-23)
      setError(
        err instanceof Error ? err.message : "Duyuru işlemi kaydedilemedi."
      );
    } finally {
      setLoading(false);
    }
  };

  const isTeacherWithoutClasses = role === "teacher" && classes.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Duyuruyu Düzenle" : "Yeni Duyuru Paylaş"}
            </DialogTitle>
            <DialogDescription>
              {role === "admin"
                ? "Kurum geneline veya belirli bir sınıfa yönelik duyuru yayınlayın."
                : "Okuttuğunuz sınıflara yönelik günlük duyuru veya bilgilendirme paylaşın."}
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <div
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-[12px] text-rose-700 font-medium"
            >
              {error}
            </div>
          ) : null}

          {isTeacherWithoutClasses ? (
            <div
              role="alert"
              className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-800 font-medium"
            >
              Duyuru paylaşabilmek için atanmış olduğunuz en az bir sınıf
              bulunmalıdır.
            </div>
          ) : null}

          {/* Duyuru Hedefi (Kapsam) */}
          <div className="space-y-1.5">
            <Label htmlFor="feed-target" className="text-[12px] font-semibold">
              Duyuru Hedefi
            </Label>
            <select
              id="feed-target"
              value={classId}
              onChange={e => setClassId(e.target.value)}
              disabled={loading || isTeacherWithoutClasses}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[12px] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              {role === "admin" ? (
                <option value="">Kurum Geneli (Tüm Sınıflar)</option>
              ) : null}
              {classes.map(cls => (
                <option key={cls.id} value={cls.id}>
                  {cls.name} Sınıfı
                </option>
              ))}
            </select>
          </div>

          {/* Hedef kitle ve önemli */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label
                htmlFor="feed-audience"
                className="text-[12px] font-semibold"
              >
                Kimler görsün
              </Label>
              <select
                id="feed-audience"
                value={audience}
                onChange={e => setAudience(e.target.value as FeedAudience)}
                disabled={loading || isTeacherWithoutClasses}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[12px] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                {(Object.keys(FEED_AUDIENCE_LABELS) as FeedAudience[]).map(
                  value => (
                    <option key={value} value={value}>
                      {FEED_AUDIENCE_LABELS[value]}
                    </option>
                  )
                )}
              </select>
            </div>
            <label className="flex items-end gap-2 pb-2">
              <input
                type="checkbox"
                checked={pinned}
                onChange={e => setPinned(e.target.checked)}
                disabled={loading || isTeacherWithoutClasses}
                className="h-4 w-4 rounded border-slate-300"
              />
              <span className="text-[12px] font-semibold text-slate-700">
                Önemli — listenin üstünde dursun
              </span>
            </label>
          </div>

          {/* Duyuru Başlığı */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="feed-title" className="text-[12px] font-semibold">
                Başlık <span className="text-rose-500">*</span>
              </Label>
              <span className="text-[11px] text-slate-400">
                {title.length} / 200
              </span>
            </div>
            <Input
              id="feed-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={200}
              placeholder="Örn: Yarın yapılacak deneme sınavı hakkında"
              disabled={loading || isTeacherWithoutClasses}
              className="h-9 text-[12px]"
            />
          </div>

          {/* Duyuru Metni (İsteğe bağlı) */}
          <div className="space-y-1.5">
            <Label htmlFor="feed-body" className="text-[12px] font-semibold">
              Duyuru Metni{" "}
              <span className="text-[11px] font-normal text-slate-400">
                (İsteğe bağlı)
              </span>
            </Label>
            <textarea
              id="feed-body"
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={4}
              placeholder="Duyuru detaylarını buraya yazabilirsiniz..."
              disabled={loading || isTeacherWithoutClasses}
              className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-[12px] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
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
              disabled={loading || isTeacherWithoutClasses}
              className="inline-flex h-9 items-center justify-center rounded-lg bg-slate-900 px-4 text-[12px] font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              {loading
                ? "Kaydediliyor…"
                : isEditing
                  ? "Değişiklikleri Kaydet"
                  : "Duyuruyu Paylaş"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
