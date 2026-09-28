import { useState } from "react";
import { toast } from "sonner";
import { isDemoMode } from "@/auth/runtime";
import {
  archiveHomework,
  restoreHomework,
  translateHomeworkError,
} from "@/education/homeworkService";
import { filterHomeworkForRole } from "../scopeFilters";
import { CardSkeleton, ErrorState, PageHeader } from "../shared";
import { getOrbitToday } from "@/education/trDate";
import type { Homework, Role, ClassGroup, Student } from "../types";
import { HomeworkCard } from "./HomeworkCard";
import { HomeworkCreateDialog } from "./HomeworkCreateDialog";
import { HomeworkSubmissionsDialog } from "./HomeworkSubmissionsDialog";
import { StaffHomeworkList } from "./StaffHomeworkList";
import { StudentHomeworkView } from "./StudentHomeworkView";

export type HomeworkPageProps = {
  role: Role;
  homework?: Homework[];
  setHomework?: React.Dispatch<React.SetStateAction<Homework[]>>;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  truncated?: boolean;
  limit?: number;
  isDemo?: boolean;
  organizationId?: string;
  classes?: ClassGroup[];
  onSaved?: () => Promise<void> | void;
  onEdit?: (item: Homework) => void;
  onArchive?: (item: Homework) => void | Promise<void>;
  /** Öğrenci/veli: öğrencinin kendisi ya da velinin çocukları. */
  students?: Student[];
};

export function HomeworkPage({
  role,
  homework = [],
  setHomework,
  isLoading = false,
  error = null,
  onRetry,
  truncated = false,
  limit = 100,
  isDemo = isDemoMode,
  organizationId = "",
  classes = [],
  onSaved,
  onEdit,
  onArchive,
  students = [],
}: HomeworkPageProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHomework, setEditingHomework] = useState<Homework | null>(null);
  const [submissionsHomework, setSubmissionsHomework] =
    useState<Homework | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const activeDemo = isDemoMode && isDemo;

  const visible = filterHomeworkForRole(homework, role, activeDemo);
  const canManage = role === "teacher" || role === "admin";

  const handleEdit = (item: Homework) => {
    if (onEdit) {
      onEdit(item);
      return;
    }
    setEditingHomework(item);
    setDialogOpen(true);
  };

  const handleRestore = async (item: Homework) => {
    try {
      await restoreHomework(organizationId, item.id);
      toast.success("Ödev geri yüklendi", {
        description: `"${item.title}" tekrar aktif listeye alındı.`,
      });
      if (onSaved) {
        await onSaved();
      }
    } catch (err: unknown) {
      const msg = translateHomeworkError(err);
      toast.error("Ödev geri yüklenemedi", { description: msg });
    }
  };

  const handleArchive = async (item: Homework) => {
    if (archivingId) return;

    if (onArchive) {
      setArchivingId(item.id);
      try {
        await onArchive(item);
      } finally {
        setArchivingId(null);
      }
      return;
    }

    if (activeDemo) {
      setHomework?.(current => current.filter(h => h.id !== item.id));
      toast.success("Ödev arşivlendi", {
        description: `"${item.title}" arşive kaldırıldı.`,
      });
      return;
    }

    if (!organizationId) return;

    setArchivingId(item.id);
    try {
      await archiveHomework(organizationId, item.id);
      toast.success("Ödev arşivlendi", {
        description: `"${item.title}" arşive kaldırıldı.`,
        action: {
          label: "Geri al",
          onClick: () => void handleRestore(item),
        },
      });
      if (onSaved) {
        await onSaved();
      }
    } catch (err: unknown) {
      const msg = translateHomeworkError(err);
      toast.error("Ödev arşivlenemedi", { description: msg });
    } finally {
      setArchivingId(null);
    }
  };

  const pageDescription =
    role === "teacher"
      ? "Sınıflarınıza atanan ödevleri ve teslim tarihlerini takip edin."
      : role === "student"
        ? "Dersleriniz için verilen ödevleri ve teslim tarihlerini takip edin."
        : role === "parent"
          ? "Öğrencinizin ödevlerini ve teslim tarihlerini takip edin."
          : "Kurum genelinde atanan ödevleri ve teslim tarihlerini takip edin.";

  return (
    <>
      <PageHeader
        eyebrow="Akademik takip"
        title={role === "teacher" ? "Sınıflarınızın ödevleri" : "Ödevler"}
        description={pageDescription}
        action={canManage ? "Yeni ödev" : undefined}
        onAction={
          canManage
            ? () => {
                setEditingHomework(null);
                setDialogOpen(true);
              }
            : undefined
        }
      />

      {truncated ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-[11px] font-semibold text-amber-800">
          Liste üst sınıra ({limit} kayıt) ulaştı. Kalan kayıtları görmek için
          teslim tarihi geçmiş ödevleri arşivleyin.
        </div>
      ) : null}

      {isLoading ? (
        <CardSkeleton className="mt-6" />
      ) : error ? (
        <ErrorState
          className="mt-6"
          title="Ödevler yüklenemedi"
          message={error.message || "Ödevler yüklenirken bir hata oluştu."}
          onRetry={onRetry}
        />
      ) : !activeDemo && canManage ? (
        // 2026-09-29: kontrol bekleyen · aktif · kontrolü biten listesi.
        <StaffHomeworkList
          items={visible}
          today={getOrbitToday()}
          classes={classes}
          archivingId={archivingId}
          onManageSubmissions={setSubmissionsHomework}
          onEdit={handleEdit}
          onArchive={item => void handleArchive(item)}
        />
      ) : !activeDemo ? (
        // Öğrenci/veli: her ödevde kendi durumu.
        <StudentHomeworkView
          role={role}
          homework={visible}
          students={students}
        />
      ) : visible.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-slate-200 p-8 text-center text-[12px] text-slate-400">
          Görüntülenecek ödev bulunmuyor.
        </p>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map(item => (
            <HomeworkCard
              key={item.id}
              homework={item}
              onEdit={canManage ? () => handleEdit(item) : undefined}
              onArchive={canManage ? () => void handleArchive(item) : undefined}
              onManageSubmissions={
                canManage ? () => setSubmissionsHomework(item) : undefined
              }
              canSeeClassRatio={canManage}
              isArchiving={archivingId === item.id}
            />
          ))}
        </div>
      )}

      {canManage && submissionsHomework ? (
        <HomeworkSubmissionsDialog
          open={Boolean(submissionsHomework)}
          onOpenChange={open => {
            if (!open) setSubmissionsHomework(null);
          }}
          organizationId={organizationId}
          homework={submissionsHomework}
          role={role}
          onSaved={onSaved}
          isDemo={activeDemo}
        />
      ) : null}

      {canManage ? (
        <HomeworkCreateDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onCreate={item => setHomework?.(current => [item, ...current])}
          onUpdate={item =>
            setHomework?.(current =>
              current.map(h => (h.id === item.id ? item : h))
            )
          }
          onSaved={onSaved}
          organizationId={organizationId}
          classes={classes}
          homework={editingHomework}
        />
      ) : null}
    </>
  );
}
