import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Circle, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge, TableSkeleton } from "../shared";
import { educationKeys } from "@/education/educationQueries";
import { loadClassEnrollments } from "@/education/classService";
import {
  DEFAULT_SUBMISSION_LIMIT,
  loadHomeworkSubmissions,
  markSubmission,
  setSubmissionsRecorded,
  unmarkSubmission,
  type HomeworkSubmissionItem,
} from "@/education/homeworkService";
import type { Homework, Role } from "../types";
import { matchesSearch } from "@/education/turkishSearch";

export type HomeworkSubmissionsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  homework: Homework;
  role: Role;
  onSaved?: () => Promise<void> | void;
  initialStudents?: ClassStudentRow[];
  initialSubmissions?: Map<string, HomeworkSubmissionItem>;
  initialTruncated?: boolean;
  initialError?: string | null;
  initialSubmissionsRecordedAt?: string | null;
  isDemo?: boolean;
};

type ClassStudentRow = {
  studentId: string;
  studentName: string | null;
  studentNumber: string | null;
  isArchived: boolean;
};

export function HomeworkSubmissionsDialog({
  open,
  onOpenChange,
  organizationId,
  homework,
  role,
  onSaved,
  initialStudents,
  initialSubmissions,
  initialTruncated,
  initialError,
  initialSubmissionsRecordedAt,
  isDemo = false,
}: HomeworkSubmissionsDialogProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<ClassStudentRow[]>(
    initialStudents ?? []
  );
  const [submissions, setSubmissions] = useState<
    Map<string, HomeworkSubmissionItem>
  >(initialSubmissions ?? new Map());
  const [truncated, setTruncated] = useState(initialTruncated ?? false);
  const [search, setSearch] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    initialError ?? null
  );
  const [recordedAt, setRecordedAt] = useState<string | null>(
    initialSubmissionsRecordedAt !== undefined
      ? initialSubmissionsRecordedAt
      : (homework.submissionsRecordedAt ?? null)
  );
  const [recordingLoading, setRecordingLoading] = useState(false);

  const canMark = role === "admin" || role === "teacher";

  useEffect(() => {
    if (!open || !organizationId || !homework.id || initialStudents) return;

    let isMounted = true;

    async function fetchData() {
      setLoading(true);
      setErrorMessage(null);
      try {
        const classId = homework.classId;
        const [enrollments, subResult] = await Promise.all([
          classId
            ? loadClassEnrollments(organizationId, classId, {
                includeArchived: true,
              })
            : Promise.resolve([]),
          loadHomeworkSubmissions(organizationId, homework.id),
        ]);

        if (!isMounted) return;

        // Öğrenci bazında tekilleştirme: en az bir aktif kaydı varsa aktif,
        // tüm kayıtları arşivlenmişse "Sınıftan ayrıldı" rozetiyle korunur
        const studentMap = new Map<
          string,
          { name: string | null; number: string | null; hasActive: boolean }
        >();

        for (const enr of enrollments) {
          const existing = studentMap.get(enr.studentId);
          const isActive =
            enr.archivedAt === null || enr.archivedAt === undefined;
          // R2-D: Ad okunamadığında etiket uydurulmaz (K-22)
          const name = enr.studentName ?? null;
          const number = enr.studentNumber ?? null;

          if (!existing) {
            studentMap.set(enr.studentId, {
              name,
              number,
              hasActive: isActive,
            });
          } else {
            if (isActive) existing.hasActive = true;
            if (!existing.name && name) existing.name = name;
            if (!existing.number && number) existing.number = number;
          }
        }

        const subMap = new Map<string, HomeworkSubmissionItem>();
        for (const sub of subResult.rows) {
          subMap.set(sub.studentId, sub);
        }

        // Ek madde 1: Aktif öğrencileri her zaman al.
        // Sınıftan ayrılmış olanları ise yalnızca bu ödeve ait teslimi varsa dahil et.
        // Böylece ödev verilmeden önce sınıftan ayrılmış öğrenciler listeyi ve paydayı şişirmez.
        const studentList: ClassStudentRow[] = [];
        for (const [studentId, info] of studentMap.entries()) {
          if (!info.hasActive && !subMap.has(studentId)) {
            continue;
          }
          studentList.push({
            studentId,
            studentName: info.name,
            studentNumber: info.number,
            isArchived: !info.hasActive,
          });
        }

        studentList.sort((a, b) =>
          (a.studentName ?? "").localeCompare(b.studentName ?? "", "tr")
        );

        setStudents(studentList);
        setSubmissions(subMap);
        setTruncated(subResult.truncated);
      } catch (err: unknown) {
        if (!isMounted) return;
        setErrorMessage(
          err instanceof Error ? err.message : "Teslim bilgileri yüklenemedi."
        );
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void fetchData();

    return () => {
      isMounted = false;
    };
  }, [open, organizationId, homework.id, homework.classId, initialStudents]);

  const handleToggleSubmission = async (student: ClassStudentRow) => {
    if (!canMark || actionId) return;

    if (isDemo) {
      const existing = submissions.get(student.studentId);
      if (existing) {
        setSubmissions(prev => {
          const next = new Map(prev);
          next.delete(student.studentId);
          return next;
        });
        toast.success("Ödev teslim işareti kaldırıldı (Demo)", {
          description: `${student.studentName || "adı okunamadı"} için teslim işareti kaldırıldı.`,
        });
      } else {
        const dummyItem: HomeworkSubmissionItem = {
          id: `demo-sub-${student.studentId}`,
          organizationId: organizationId || "demo-org",
          homeworkId: homework.id,
          studentId: student.studentId,
          recordedByMembershipId: "demo-teacher",
          archivedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setSubmissions(prev => {
          const next = new Map(prev);
          next.set(student.studentId, dummyItem);
          return next;
        });
        toast.success("Ödev teslim alındı olarak işaretlendi (Demo)", {
          description: `${student.studentName || "adı okunamadı"} için teslim kaydedildi.`,
        });
      }
      return;
    }

    setActionId(student.studentId);
    setErrorMessage(null);

    const existing = submissions.get(student.studentId);

    try {
      if (existing) {
        // İşareti kaldır (arşivle)
        await unmarkSubmission(organizationId, existing.id);
        setSubmissions(prev => {
          const next = new Map(prev);
          next.delete(student.studentId);
          return next;
        });
        toast.success("Ödev teslim işareti kaldırıldı", {
          description: `${student.studentName || "adı okunamadı"} için teslim işareti kaldırıldı.`,
        });
      } else {
        // İşaretle (satır ekle)
        const res = await markSubmission(
          organizationId,
          homework.id,
          student.studentId
        );
        const newItem: HomeworkSubmissionItem = {
          id: res.id,
          organizationId,
          homeworkId: homework.id,
          studentId: student.studentId,
          recordedByMembershipId: "",
          archivedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setSubmissions(prev => {
          const next = new Map(prev);
          next.set(student.studentId, newItem);
          return next;
        });
        toast.success("Ödev teslim alındı olarak işaretlendi", {
          description: `${student.studentName || "adı okunamadı"} için teslim kaydedildi.`,
        });
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: educationKeys.homework(organizationId),
        }),
        queryClient.invalidateQueries({
          queryKey: educationKeys.students(organizationId),
        }),
      ]);

      if (onSaved) {
        await onSaved();
      }
    } catch (err: unknown) {
      // Hatayı servis çevirir, ekran yalnız taşır (ikinci kez çevirme!)
      const message =
        err instanceof Error ? err.message : "İşlem gerçekleştirilemedi.";
      setErrorMessage(message);
      toast.error("İşlem başarısız", { description: message });
    } finally {
      setActionId(null);
    }
  };

  const handleToggleRecordStatus = async () => {
    if (!canMark || recordingLoading) return;

    if (isDemo) {
      const willRecord = !recordedAt;
      setRecordedAt(willRecord ? new Date().toISOString() : null);
      toast.success(
        willRecord
          ? "Teslim işaretlemesi tamamlandı (Demo)"
          : "Teslim işaretlemesi yeniden açıldı (Demo)",
        {
          description: willRecord
            ? "Ödev teslim süreci tamamlandı olarak kaydedildi."
            : "Ödev teslim işaretlemesi tekrar devam ediyor durumuna alındı.",
        }
      );
      return;
    }

    setRecordingLoading(true);
    setErrorMessage(null);
    const willRecord = !recordedAt;
    try {
      const res = await setSubmissionsRecorded(
        organizationId,
        homework.id,
        willRecord
      );
      setRecordedAt(res.submissionsRecordedAt);
      toast.success(
        willRecord
          ? "Teslim işaretlemesi tamamlandı"
          : "Teslim işaretlemesi yeniden açıldı",
        {
          description: willRecord
            ? "Ödev teslim süreci tamamlandı olarak kaydedildi."
            : "Ödev teslim işaretlemesi tekrar devam ediyor durumuna alındı.",
        }
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: educationKeys.homework(organizationId),
        }),
        queryClient.invalidateQueries({
          queryKey: educationKeys.students(organizationId),
        }),
      ]);
      if (onSaved) {
        await onSaved();
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "İşlem gerçekleştirilemedi.";
      setErrorMessage(message);
      toast.error("İşlem başarısız", { description: message });
    } finally {
      setRecordingLoading(false);
    }
  };

  const filteredStudents = students.filter(s => {
    if (!search.trim()) return true;
    return matchesSearch(
      `${s.studentName ?? ""} ${s.studentNumber ?? ""}`,
      search
    );
  });

  const submittedCount = submissions.size;
  const totalCount = students.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <DialogTitle>Ödev Teslimleri</DialogTitle>
              <DialogDescription>
                {homework.title} · {homework.classGroup}
                {canMark && recordedAt && totalCount > 0 ? (
                  <span className="ml-2 font-semibold text-emerald-600">
                    ({submittedCount} / {totalCount} teslim)
                  </span>
                ) : null}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              {recordedAt ? (
                <Badge tone="green">İşaretleme tamamlandı</Badge>
              ) : (
                <Badge tone="amber">İşaretleme henüz bitirilmedi</Badge>
              )}
              {canMark ? (
                <button
                  type="button"
                  onClick={() => void handleToggleRecordStatus()}
                  disabled={recordingLoading}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  {recordingLoading
                    ? "İşleniyor…"
                    : recordedAt
                      ? "İşaretlemeyi yeniden aç"
                      : "İşaretlemeyi bitir"}
                </button>
              ) : null}
            </div>
          </div>
        </DialogHeader>

        {truncated ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-[11px] font-semibold text-amber-800">
            Liste üst sınıra ({DEFAULT_SUBMISSION_LIMIT} kayıt) ulaştı. Kalan
            kayıtları görmek için filtreleyin.
          </div>
        ) : null}

        {errorMessage ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-[11px] font-semibold text-rose-800">
            {errorMessage}
          </div>
        ) : null}

        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Öğrenci adı veya numarası ara..."
            className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3 text-[12px] outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
          />
        </div>

        {loading ? (
          <TableSkeleton rows={4} columns={3} className="mt-4" />
        ) : students.length === 0 ? (
          <div className="py-8 text-center text-[12px] text-slate-500">
            Bu sınıfta kayıtlı öğrenci bulunmuyor.
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="py-8 text-center text-[12px] text-slate-500">
            Arama kriterine uygun öğrenci bulunamadı.
          </div>
        ) : (
          <div className="mt-3 max-h-[360px] overflow-y-auto rounded-xl border border-slate-100">
            <table className="w-full text-left text-[12px]">
              <thead className="sticky top-0 border-b border-slate-100 bg-slate-50/90 text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-400">
                <tr>
                  <th className="px-4 py-3">Öğrenci</th>
                  {canMark ? (
                    <th className="px-4 py-3 text-center">Durum</th>
                  ) : null}
                  {canMark ? (
                    <th className="px-4 py-3 text-right">İşlem</th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map(student => {
                  const hasSubmission = submissions.has(student.studentId);
                  const isProcessing = actionId === student.studentId;

                  return (
                    <tr
                      key={student.studentId}
                      className="hover:bg-slate-50/70 transition"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {student.studentName ? (
                            <span className="font-bold text-slate-800">
                              {student.studentName}
                            </span>
                          ) : (
                            <span className="font-medium italic text-slate-400">
                              adı okunamadı
                            </span>
                          )}
                          {student.isArchived ? (
                            <Badge tone="amber">Sınıftan ayrıldı</Badge>
                          ) : null}
                        </div>
                        {student.studentNumber ? (
                          <p className="mt-0.5 text-[10px] text-slate-400">
                            No: {student.studentNumber}
                          </p>
                        ) : null}
                      </td>
                      {canMark ? (
                        <td className="px-4 py-3 text-center">
                          {hasSubmission ? (
                            <Badge tone="green">Teslim Edildi</Badge>
                          ) : (
                            <Badge tone="slate">Teslim Edilmedi</Badge>
                          )}
                        </td>
                      ) : null}
                      {canMark ? (
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => void handleToggleSubmission(student)}
                            disabled={isProcessing}
                            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-50 ${
                              hasSubmission
                                ? "bg-rose-50 text-rose-700 hover:bg-rose-100"
                                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            }`}
                          >
                            {hasSubmission ? (
                              <>
                                <Circle className="h-3.5 w-3.5" />
                                {isProcessing
                                  ? "Kaldırılıyor…"
                                  : "İşareti kaldır"}
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                {isProcessing
                                  ? "Kaydediliyor…"
                                  : "Teslim alındı"}
                              </>
                            )}
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
