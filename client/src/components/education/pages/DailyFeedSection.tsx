import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Edit2, Megaphone, Plus, RotateCcw, Trash2 } from "lucide-react";
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
import { educationKeys, useFeedPosts } from "@/education/educationQueries";
import {
  archiveFeedPost,
  restoreFeedPost,
  DEFAULT_FEED_LIMIT,
  type FeedPost,
} from "@/education/feedService";
import { FEED_AUDIENCE_LABELS } from "@/education/feedService";
import { Badge, EmptyState, ErrorState, TableSkeleton } from "../shared";
import type { Role } from "../types";
import { FeedPostFormDialog } from "./FeedPostFormDialog";

export type DailyFeedSectionProps = {
  role: Role;
  organizationId?: string;
  classes?: { id: string; name: string }[];
};

export function DailyFeedSection({
  role,
  organizationId = "",
  classes = [],
}: DailyFeedSectionProps) {
  const { identity } = useAuth();
  const currentMembershipId = identity?.membership?.membershipId ?? "";

  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<FeedPost | null>(null);
  const [postToArchive, setPostToArchive] = useState<FeedPost | null>(null);

  const feedQuery = useFeedPosts({
    organizationId,
    classId:
      selectedClassId === "all"
        ? undefined
        : selectedClassId === "org"
          ? null
          : selectedClassId,
    includeArchived: showArchived,
    enabled: Boolean(organizationId),
  });

  // Önemli duyurular üstte (2026-09-29); kendi aralarında ve diğerleri
  // sunucunun sırasıyla (en yeni önce). Sıralama kararlı.
  const posts = [...(feedQuery.data?.rows ?? [])].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned)
  );
  const truncated = feedQuery.data?.truncated ?? false;
  const isLoading = feedQuery.isLoading;
  const error = feedQuery.error;

  const canCreate = role === "admin" || role === "teacher";

  const handleOpenAdd = () => {
    setEditingPost(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (post: FeedPost) => {
    setEditingPost(post);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Üst Bar: Başlık, Filtreler ve Eylem */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-50 text-blue-600">
              <Megaphone className="h-4 w-4" />
            </span>
            <h3 className="text-[15px] font-bold text-slate-900">
              Günlük Akış Duyuru Panosu
            </h3>
          </div>
          <p className="mt-1 text-[12px] text-slate-500">
            Kurum geneli ve sınıflara yönelik paylaşılan tüm duyuru ve
            bilgilendirmeler.
          </p>
        </div>

        {canCreate ? (
          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-slate-900 px-4 text-[12px] font-bold text-white shadow-sm transition hover:bg-slate-800"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Duyuru Paylaş</span>
          </button>
        ) : null}
      </div>

      {/* Tavan Uyarısı (K-06) */}
      {truncated ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-[11px] font-semibold text-amber-800">
          Liste üst sınıra ({DEFAULT_FEED_LIMIT} kayıt) ulaştı. Kalan kayıtları
          görmek için filtreleri kullanın.
        </div>
      ) : null}

      {/* Filtreleme Çubuğu */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_4px_16px_rgba(15,23,42,.025)]">
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor="class-filter"
            className="text-[11px] font-bold text-slate-500"
          >
            Kapsam:
          </label>
          <select
            id="class-filter"
            value={selectedClassId}
            onChange={e => setSelectedClassId(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[11px] font-medium text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white"
          >
            <option value="all">Tüm Duyurular</option>
            <option value="org">Yalnızca Kurum Geneli</option>
            {classes.map(cls => (
              <option key={cls.id} value={cls.id}>
                {cls.name} Sınıfı
              </option>
            ))}
          </select>
        </div>

        {/* Yalnızca Admin için Arşiv Filtresi */}
        {role === "admin" ? (
          <label className="flex cursor-pointer items-center gap-2 text-[11px] font-medium text-slate-600">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={e => setShowArchived(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Arşivlenenleri göster</span>
          </label>
        ) : null}
      </div>

      {/* Duyuru Listesi veya Durumlar */}
      {isLoading ? (
        <TableSkeleton rows={4} columns={3} />
      ) : error ? (
        <ErrorState
          title="Duyurular yüklenemedi"
          message={error.message}
          onRetry={() => void feedQuery.refetch()}
        />
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-[0_4px_16px_rgba(15,23,42,.025)]">
          <EmptyState
            title="Henüz duyuru bulunmuyor"
            description="Bu filtreye uygun aktif bir duyuru kaydı bulunmamaktadır."
          />
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map(post => {
            // Kim düzenleyebilir/kaldırabilir:
            // Yönetici: hepsini.
            // Öğretmen: yalnız KENDİ yazdığını ve sınıf duyurusuysa (#288)
            // Öğrenci/veli: hiçbirini.
            const canManagePost =
              role === "admin" ||
              (role === "teacher" &&
                post.authorMembershipId === currentMembershipId &&
                post.classId !== null);

            return (
              <article
                key={post.id}
                className={`relative rounded-2xl border bg-white p-5 shadow-[0_4px_16px_rgba(15,23,42,.025)] transition hover:border-slate-300 ${
                  post.archivedAt
                    ? "border-amber-200 bg-amber-50/30"
                    : "border-slate-200"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    {/* Kurum geneli ile sınıf duyurusu ekranda ayırt ediliyor (K-23) */}
                    {post.classId === null ? (
                      <Badge tone="violet">Kurum Geneli</Badge>
                    ) : (
                      <Badge tone="slate">
                        {post.className || "Sınıf Duyurusu"}
                      </Badge>
                    )}
                    {post.pinned ? <Badge tone="rose">Önemli</Badge> : null}
                    {post.audience !== "all" ? (
                      <Badge tone="blue">
                        {FEED_AUDIENCE_LABELS[post.audience]}
                      </Badge>
                    ) : null}
                    {post.archivedAt ? (
                      <Badge tone="amber">Arşivde</Badge>
                    ) : null}
                  </div>

                  {/* İşlem Butonları (Yalnızca yetkiliye çizilir — K-23) */}
                  {canManagePost ? (
                    <div className="flex items-center gap-1">
                      {!post.archivedAt ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(post)}
                            className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <Edit2 className="h-3 w-3" />
                            <span>Düzenle</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setPostToArchive(post)}
                            className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-rose-200 px-2.5 text-[11px] font-semibold text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Kaldır</span>
                          </button>
                        </>
                      ) : (
                        <FeedRestoreButton
                          organizationId={organizationId}
                          postId={post.id}
                        />
                      )}
                    </div>
                  ) : null}
                </div>

                <div className="mt-3">
                  <h4 className="text-[14px] font-bold text-slate-900">
                    {post.title}
                  </h4>

                  {/* ⚠️ body boşken boş bir gövde bloğu ÇİZİLMEZ (K-23) */}
                  {post.body && post.body.trim().length > 0 ? (
                    <p
                      data-slot="feed-body"
                      className="mt-2 whitespace-pre-line text-[12px] leading-relaxed text-slate-600"
                    >
                      {post.body}
                    </p>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-50 pt-3 text-[11px] text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <span>Yazan:</span>
                    {/* ⚠️ Yazar adı çözülemezse asla ham kimlik basılmaz, 'adı okunamadı' denir (K-22 / K-23) */}
                    <span className="font-semibold text-slate-700">
                      {post.authorName || "adı okunamadı"}
                    </span>
                  </div>

                  {post.createdAt ? (
                    <time dateTime={post.createdAt} className="font-medium">
                      {new Date(post.createdAt).toLocaleDateString("tr-TR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Duyuru Ekle/Düzenle Diyalogu */}
      {formOpen && organizationId ? (
        <FeedPostFormDialog
          key={editingPost?.id ?? "new"}
          open={formOpen}
          onOpenChange={setFormOpen}
          organizationId={organizationId}
          role={role}
          classes={classes}
          post={editingPost}
          onDone={() => setEditingPost(null)}
        />
      ) : null}

      {/* Duyuru Kaldırma (Arşivleme) Onay Diyalogu — Modal Dialog kullanılır */}
      {postToArchive && organizationId ? (
        <FeedPostArchiveDialog
          organizationId={organizationId}
          post={postToArchive}
          onClose={() => setPostToArchive(null)}
        />
      ) : null}
    </div>
  );
}

function FeedRestoreButton({
  organizationId,
  postId,
}: {
  organizationId: string;
  postId: string;
}) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const handleRestore = async () => {
    setLoading(true);
    try {
      await restoreFeedPost(organizationId, postId);
      await queryClient.invalidateQueries({
        queryKey: educationKeys.feed(organizationId),
      });
      toast.success("Duyuru arşivden çıkarıldı", {
        description: "Duyuru tekrar panoda görünür hale getirildi.",
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Duyuru geri getirilemedi."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleRestore}
      disabled={loading}
      className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
    >
      <RotateCcw className="h-3 w-3" />
      <span>{loading ? "Geri Getiriliyor…" : "Geri Yükle"}</span>
    </button>
  );
}

function FeedPostArchiveDialog({
  organizationId,
  post,
  onClose,
}: {
  organizationId: string;
  post: FeedPost;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const handleArchiveConfirm = async () => {
    if (!organizationId || !post.id) return;

    setArchiveLoading(true);
    setArchiveError(null);

    try {
      await archiveFeedPost(organizationId, post.id);
      await queryClient.invalidateQueries({
        queryKey: educationKeys.feed(organizationId),
      });
      onClose();
      toast.success("Duyuru kaldırıldı", {
        description: `"${post.title}" duyurusu başarıyla arşive alındı.`,
      });
    } catch (err) {
      // 🔴 Hatayı servis çevirir, ekran yalnız taşır (K-23)
      setArchiveError(
        err instanceof Error ? err.message : "Duyuru kaldırılamadı."
      );
    } finally {
      setArchiveLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Duyuruyu Kaldır</DialogTitle>
          <DialogDescription>
            &quot;{post.title}&quot; duyurusunu panodan kaldırmak ve arşive
            almak istediğinize emin misiniz?
          </DialogDescription>
        </DialogHeader>

        {archiveError ? (
          <div
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-[12px] text-rose-700 font-medium"
          >
            {archiveError}
          </div>
        ) : null}

        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            disabled={archiveLoading}
            className="h-9 rounded-lg border border-slate-200 px-4 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={handleArchiveConfirm}
            disabled={archiveLoading}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-rose-600 px-4 text-[12px] font-bold text-white transition hover:bg-rose-700 disabled:opacity-50"
          >
            {archiveLoading ? "Kaldırılıyor…" : "Duyuruyu Kaldır"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
