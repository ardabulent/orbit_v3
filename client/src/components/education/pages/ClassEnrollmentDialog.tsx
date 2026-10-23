import { useState } from "react";
import { QueryLoadAlert } from "./QueryLoadAlert";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, UserMinus, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge, TableSkeleton } from "../shared";
import {
  useClassEnrollments,
  useStudents,
  educationKeys,
} from "@/education/educationQueries";
import { enrollStudent, unenrollStudent } from "@/education/classService";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import type { ClassGroup } from "../types";

export type ClassEnrollmentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  classData: ClassGroup;
};

export function ClassEnrollmentDialog({
  open,
  onOpenChange,
  organizationId,
  classData,
}: ClassEnrollmentDialogProps) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebouncedValue(searchTerm, 300);

  const [enrollingStudentId, setEnrollingStudentId] = useState<string | null>(
    null
  );
  const [unenrollingId, setUnenrollingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sınıfın mevcut kayıtları
  const enrollmentsQuery = useClassEnrollments(classData.id, {
    organizationId,
    enabled: open,
  });
  const enrollments = enrollmentsQuery.data ?? [];
  const enrolledStudentIds = new Set(enrollments.map(e => e.studentId));

  // Yeni eklenecek öğrenci arama sorgusu (v1.4-01 sunucu araması)
  const isSearchActive = debouncedSearch.trim().length > 0;
  const searchStudentsQuery = useStudents({
    organizationId,
    search: debouncedSearch,
    enabled: open && isSearchActive,
  });

  const searchResults = (searchStudentsQuery.data?.rows ?? []).filter(
    s => !enrolledStudentIds.has(s.id)
  );

  const isFull =
    classData.capacity !== null &&
    classData.capacity !== undefined &&
    enrollments.length >= classData.capacity;

  const handleEnroll = async (studentId: string, studentName: string) => {
    if (enrollingStudentId) return;
    setEnrollingStudentId(studentId);
    setErrorMessage(null);
    try {
      await enrollStudent({
        organizationId,
        classId: classData.id,
        studentId,
      });
      toast.success("Öğrenci sınıfa eklendi", {
        description: `${studentName} başarıyla ${classData.name} sınıfına kaydedildi.`,
      });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: educationKeys.classEnrollments(
            organizationId,
            classData.id
          ),
        }),
        queryClient.invalidateQueries({
          queryKey: educationKeys.classes(organizationId),
        }),
      ]);
      setSearchTerm("");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Öğrenci sınıfa eklenemedi."
      );
    } finally {
      setEnrollingStudentId(null);
    }
  };

  const handleUnenroll = async (
    enrollmentId: string,
    studentName: string | null
  ) => {
    if (unenrollingId) return;
    setUnenrollingId(enrollmentId);
    setErrorMessage(null);
    try {
      await unenrollStudent(enrollmentId);
      toast.success("Kayıt sonlandırıldı", {
        description: studentName
          ? `${studentName} öğrencisinin ${classData.name} sınıfındaki kaydı arşivlendi.`
          : `Kayıt ${classData.name} sınıfından arşivlendi.`,
      });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: educationKeys.classEnrollments(
            organizationId,
            classData.id
          ),
        }),
        queryClient.invalidateQueries({
          queryKey: educationKeys.classes(organizationId),
        }),
      ]);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Öğrenci sınıftan çıkarılamadı."
      );
    } finally {
      setUnenrollingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <DialogTitle>{classData.name} — Öğrenci Kayıtları</DialogTitle>
            {classData.capacity !== null && classData.capacity !== undefined ? (
              <Badge tone={isFull ? "amber" : "slate"}>
                {enrollments.length} / {classData.capacity}{" "}
                {isFull ? "(Kontenjan dolu)" : "öğrenci"}
              </Badge>
            ) : (
              <Badge tone="slate">{enrollments.length} öğrenci</Badge>
            )}
          </div>
          <DialogDescription>
            Sınıfa kayıtlı öğrencileri yönetin veya arama kutusundan yeni
            öğrenci ekleyin.
          </DialogDescription>
        </DialogHeader>

        {errorMessage ? (
          <div
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[12px] font-medium text-rose-800"
          >
            {errorMessage}
          </div>
        ) : null}

        <div className="space-y-4 py-2">
          {/* Yeni Öğrenci Arama ve Ekleme */}
          <div className="space-y-2">
            <label
              htmlFor="search-student-to-enroll"
              className="block text-[11px] font-bold uppercase tracking-wider text-slate-600"
            >
              Yeni Öğrenci Ekle
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="search-student-to-enroll"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Öğrenci adı veya numarası ara..."
                className="pl-9"
                autoComplete="off"
              />
            </div>

            {/* Kontenjan yalnız bilgiydi ve dolu sınıfa uyarısız eklenebiliyordu
                (test turu B4). Engel değil — kurum bilerek aşabilir — ama
                eklemeden önce söylenir ve düğme "Yine de ekle" olur. */}
            {isFull && isSearchActive ? (
              <p
                role="status"
                className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-900"
              >
                Kontenjan dolu ({enrollments.length} / {classData.capacity}).
                Eklerseniz sınıf kontenjanı aşar.
              </p>
            ) : null}

            {/* Arama Sonuçları */}
            {isSearchActive ? (
              <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/50 p-2 space-y-1">
                {searchStudentsQuery.isLoading ? (
                  <p className="p-2 text-center text-xs text-slate-500">
                    Öğrenciler aranıyor…
                  </p>
                ) : searchStudentsQuery.isError ? (
                  <QueryLoadAlert
                    what="Öğrenci listesi"
                    onRetry={() => void searchStudentsQuery.refetch()}
                  />
                ) : searchResults.length === 0 ? (
                  <p className="p-2 text-center text-xs text-slate-500">
                    Kayıt edilebilir öğrenci bulunamadı.
                  </p>
                ) : (
                  searchResults.map(student => (
                    <div
                      key={student.id}
                      className="flex items-center justify-between rounded-md bg-white p-2 text-xs shadow-sm"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-semibold text-slate-800 truncate">
                          {student.name}
                        </p>
                        {student.code ? (
                          <p className="text-[10px] text-slate-400">
                            No: {student.code}
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          void handleEnroll(student.id, student.name)
                        }
                        disabled={enrollingStudentId === student.id}
                        className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        <UserPlus className="h-3 w-3" />
                        <span>
                          {enrollingStudentId === student.id
                            ? "Ekleniyor…"
                            : isFull
                              ? "Yine de ekle"
                              : "Ekle"}
                        </span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </div>

          {/* Mevcut Kayıtlı Öğrenciler Listesi */}
          <div className="space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Kayıtlı Öğrenciler ({enrollments.length})
            </h3>
            {enrollmentsQuery.isLoading ? (
              <TableSkeleton rows={3} columns={2} />
            ) : enrollmentsQuery.isError ? (
              <QueryLoadAlert
                what="Sınıfın kayıt listesi"
                onRetry={() => void enrollmentsQuery.refetch()}
              />
            ) : enrollments.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-6 text-center text-xs text-slate-500">
                Bu sınıfta henüz kayıtlı öğrenci bulunmuyor.
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                {enrollments.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      {/* Ad okunamıyorsa satır çizilmez, etiket uydurulmaz. */}
                      {item.studentName ? (
                        <p className="font-semibold text-slate-800 truncate">
                          {item.studentName}
                        </p>
                      ) : null}
                      {item.studentNumber ? (
                        <p className="text-[10px] text-slate-400">
                          No: {item.studentNumber}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        void handleUnenroll(item.id, item.studentName)
                      }
                      disabled={unenrollingId === item.id}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                    >
                      <UserMinus className="h-3 w-3" />
                      <span>
                        {unenrollingId === item.id
                          ? "Çıkarılıyor…"
                          : "Kayıttan çıkar"}
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
