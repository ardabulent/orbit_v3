import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  GraduationCap,
  UserMinus,
  UserPlus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge, TableSkeleton } from "../shared";
import {
  educationKeys,
  useClassTeachers,
  useSubjects,
} from "@/education/educationQueries";
import { useSettingsMembers } from "@/settings/settingsQueries";
import {
  assignTeacher,
  DEFAULT_CLASS_TEACHER_LIMIT,
  unassignTeacher,
  type ClassTeacherItem,
} from "@/education/classTeacherService";
import type { ClassGroup } from "../types";
import { eligibleTeachers } from "./teacherEligibility";
import { TeacherOptionGroups } from "./TeacherOptionGroups";

export type ClassTeachersDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  classData: ClassGroup;
};

export function ClassTeachersDialog({
  open,
  onOpenChange,
  organizationId,
  classData,
}: ClassTeachersDialogProps) {
  const queryClient = useQueryClient();

  const [selectedMembershipId, setSelectedMembershipId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Kaldırma diyalogu durumu (window.confirm KULLANILMAZ)
  const [teacherToUnassign, setTeacherToUnassign] =
    useState<ClassTeacherItem | null>(null);
  const [unassigning, setUnassigning] = useState(false);
  const [unassignError, setUnassignError] = useState<string | null>(null);

  // Sınıfın mevcut öğretmen atamaları
  const teachersQuery = useClassTeachers(classData.id, {
    organizationId,
    enabled: open,
  });
  const teachers = teachersQuery.data?.rows ?? [];
  const truncated = Boolean(teachersQuery.data?.truncated);

  // Kurum üyeleri (Yalnızca admin ve teacher rolü kabul edilir — enforce_class_teacher_is_eligible)
  const membersQuery = useSettingsMembers({
    organizationId,
    enabled: open,
  });
  const eligibleMembers = eligibleTeachers(membersQuery.data ?? []);

  // Kurumun aktif dersleri
  const subjectsQuery = useSubjects({
    organizationId,
    enabled: open,
  });
  const subjects = subjectsQuery.data?.rows ?? [];

  const invalidateQueries = async () => {
    if (!organizationId) return;
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: educationKeys.classTeachers(organizationId),
      }),
      queryClient.invalidateQueries({
        queryKey: educationKeys.classes(organizationId),
      }),
      queryClient.invalidateQueries({
        queryKey: educationKeys.schedule(organizationId),
      }),
    ]);
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId || !classData.id) return;

    if (!selectedMembershipId) {
      setAssignError("Lütfen bir öğretmen seçin.");
      return;
    }
    if (!selectedSubjectId) {
      setAssignError("Lütfen bir ders seçin.");
      return;
    }

    setAssigning(true);
    setAssignError(null);

    try {
      await assignTeacher({
        organizationId,
        classId: classData.id,
        membershipId: selectedMembershipId,
        subjectId: selectedSubjectId,
      });

      await invalidateQueries();
      setSelectedMembershipId("");
      setSelectedSubjectId("");
      toast.success("Öğretmen atandı", {
        description: `Öğretmen ataması başarıyla kaydedildi.`,
      });
    } catch (err) {
      setAssignError(
        err instanceof Error ? err.message : "Öğretmen atanamadı."
      );
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassignConfirm = async () => {
    if (!organizationId || !teacherToUnassign) return;

    setUnassigning(true);
    setUnassignError(null);

    try {
      await unassignTeacher(organizationId, teacherToUnassign.id);
      await invalidateQueries();
      setTeacherToUnassign(null);
      toast.success("Öğretmen ataması kaldırıldı", {
        description: `Atama başarıyla arşive alındı.`,
      });
    } catch (err) {
      setUnassignError(
        err instanceof Error ? err.message : "Atama kaldırılamadı."
      );
    } finally {
      setUnassigning(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-2">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-blue-600">
                <GraduationCap className="h-4 w-4" />
              </span>
              <DialogTitle className="font-display text-[18px]">
                {classData.name} — Öğretmen Atamaları
              </DialogTitle>
            </div>
            <DialogDescription className="text-[12px] text-slate-500">
              Bu sınıfta okutulan derslere öğretmen atayın veya mevcut atamaları
              yönetin.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            {truncated ? (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-[12px] text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <strong className="font-bold">
                    Atama listesi üst sınıra ulaştı:
                  </strong>{" "}
                  En fazla {DEFAULT_CLASS_TEACHER_LIMIT} atama listeleniyor.
                </div>
              </div>
            ) : null}

            {/* Yeni Atama Formu */}
            <form
              onSubmit={handleAssign}
              className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 space-y-4"
            >
              <h4 className="font-display text-[13px] font-bold text-slate-900 flex items-center gap-1.5">
                <UserPlus className="h-4 w-4 text-blue-600" />
                Yeni Öğretmen Ata
              </h4>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label
                    htmlFor="assign-teacher"
                    className="text-[11px] font-semibold text-slate-600"
                  >
                    Öğretmen
                  </label>
                  <select
                    id="assign-teacher"
                    value={selectedMembershipId}
                    onChange={e => setSelectedMembershipId(e.target.value)}
                    disabled={assigning || membersQuery.isLoading}
                    className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-[12px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Öğretmen seçin…</option>
                    <TeacherOptionGroups members={eligibleMembers} />
                  </select>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="assign-subject"
                    className="text-[11px] font-semibold text-slate-600"
                  >
                    Ders
                  </label>
                  <select
                    id="assign-subject"
                    value={selectedSubjectId}
                    onChange={e => setSelectedSubjectId(e.target.value)}
                    disabled={assigning || subjectsQuery.isLoading}
                    className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-[12px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Ders seçin…</option>
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {assignError ? (
                <div
                  role="alert"
                  className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-[12px] text-rose-700"
                >
                  {assignError}
                </div>
              ) : null}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={
                    assigning || !selectedMembershipId || !selectedSubjectId
                  }
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[11px] font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {assigning ? "Atanıyor…" : "Öğretmeni Ata"}
                </button>
              </div>
            </form>

            {/* Mevcut Atamalar */}
            <div>
              <h4 className="font-display text-[13px] font-bold text-slate-900 mb-3">
                Mevcut Atamalar ({teachers.length})
              </h4>

              {teachersQuery.isLoading ? (
                <TableSkeleton rows={3} columns={3} />
              ) : teachersQuery.error ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-center text-[12px] text-rose-700">
                  {teachersQuery.error.message}
                </div>
              ) : teachers.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-[12px] text-slate-500">
                  Bu sınıfa henüz öğretmen atanmamış.
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white">
                  {teachers.map(t => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between p-3 sm:px-4"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-[13px] text-slate-800">
                          {t.teacherName || "İsimsiz Öğretmen"}
                        </span>
                        <Badge tone="blue">{t.subjectName || "Ders"}</Badge>
                      </div>

                      {/* ⚠️ Öğretmen ataması DÜZENLENEMEZ — "Düzenle" düğmesi ÇİZİLMEZ (#287) */}
                      <button
                        type="button"
                        onClick={() => {
                          setTeacherToUnassign(t);
                          setUnassignError(null);
                        }}
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-rose-200 px-2 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                      >
                        <UserMinus className="h-3 w-3" />
                        <span>Kaldır</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="border-t border-slate-100 p-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-9 rounded-lg border border-slate-200 px-4 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Kapat
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Atama Kaldırma Onay Diyalogu (window.confirm KULLANILMAZ) */}
      <Dialog
        open={Boolean(teacherToUnassign)}
        onOpenChange={open => !open && setTeacherToUnassign(null)}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Öğretmen Atamasını Kaldır</DialogTitle>
            <DialogDescription>
              &quot;{teacherToUnassign?.teacherName || "Öğretmen"}&quot; isimli
              öğretmenin &quot;
              {teacherToUnassign?.subjectName || "Ders"}&quot; dersi atamasını
              kaldırmak istediğinize emin misiniz?
            </DialogDescription>
          </DialogHeader>

          {unassignError ? (
            <div
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-[12px] text-rose-700 font-medium"
            >
              {unassignError}
            </div>
          ) : null}

          <DialogFooter>
            <button
              type="button"
              onClick={() => setTeacherToUnassign(null)}
              disabled={unassigning}
              className="h-9 rounded-lg border border-slate-200 px-4 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Vazgeç
            </button>
            <button
              type="button"
              onClick={handleUnassignConfirm}
              disabled={unassigning}
              className="inline-flex h-9 items-center justify-center rounded-lg bg-rose-600 px-4 text-[12px] font-bold text-white transition hover:bg-rose-700 disabled:opacity-50"
            >
              {unassigning ? "Kaldırılıyor…" : "Atamayı Kaldır"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
