import { useStudentHomeworkContext } from "@/education/educationQueries";
import { getOrbitToday } from "@/education/trDate";
import { useGuardianChild } from "../guardianChild/guardianChildState";
import { Badge, CardSkeleton, EmptyState, ErrorState } from "../shared";
import type { Homework, Role, Student } from "../types";
import { groupStudentHomework, studentHomeworkStatus } from "./homeworkGroups";
import { HomeworkGroup, HomeworkRow } from "./HomeworkRow";

/**
 * Öğrenci ve velinin Ödevler görünümü (karar 2026-09-29): öğrencinin
 * sınıflarının ödevleri, her birinde kendi durumu. Teslimi yalnız öğretmen
 * işaretler; işaretleme bitmeden "getirilmedi" denmez. Velide çocuk üst
 * çubuktan seçilir (2026-10-02).
 */
export function StudentHomeworkView({
  role,
  homework,
  students,
}: {
  role: Role;
  homework: Homework[];
  /** Öğrencinin kendisi ya da velinin çocukları (RLS ile daraltılmış). */
  students: Student[];
}) {
  const guardian = useGuardianChild();
  const student =
    (role === "parent"
      ? students.find(s => s.id === guardian.child?.id)
      : undefined) ??
    students[0] ??
    null;

  if (!student)
    return (
      <div className="mt-6">
        <EmptyState
          title="Hesabınıza bağlı bir öğrenci yok"
          description="Kurum yöneticisi hesabınızı öğrenci kaydına bağladığında ödevler burada görünür."
        />
      </div>
    );

  return (
    <StudentHomeworkBody
      key={student.id}
      studentId={student.id}
      homework={homework}
    />
  );
}

function StudentHomeworkBody({
  studentId,
  homework,
}: {
  studentId: string;
  homework: Homework[];
}) {
  const today = getOrbitToday();
  const query = useStudentHomeworkContext({ studentId });

  if (query.isPending) return <CardSkeleton className="mt-6" />;
  if (query.isError)
    return (
      <ErrorState
        className="mt-6"
        title="Ödev durumu alınamadı"
        message={query.error.message}
        onRetry={() => void query.refetch()}
      />
    );

  const { classIds, deliveredIds } = query.data;
  const mine = homework.filter(h => h.classId && classIds.has(h.classId));
  const groups = groupStudentHomework(mine, deliveredIds, today);
  const showClass = classIds.size > 1;

  const row = (item: Homework) => {
    const status = studentHomeworkStatus(
      item,
      deliveredIds.has(item.id),
      today
    );
    return (
      <HomeworkRow
        key={item.id}
        homework={item}
        showClass={showClass}
        aside={<Badge tone={status.tone}>{status.label}</Badge>}
      />
    );
  };

  if (mine.length === 0)
    return (
      <div className="mt-6">
        <EmptyState
          title="Görüntülenecek ödev bulunmuyor"
          description="Öğretmen ödev verdiğinde burada görünür."
        />
      </div>
    );

  return (
    <div className="mt-6 space-y-6">
      <HomeworkGroup
        title="Yaklaşan"
        count={groups.upcoming.length}
        empty="Teslimi yaklaşan ödev yok."
      >
        {groups.upcoming.map(row)}
      </HomeworkGroup>
      {groups.missed.length > 0 ? (
        <HomeworkGroup
          title="Getirilmedi"
          count={groups.missed.length}
          empty=""
        >
          {groups.missed.map(row)}
        </HomeworkGroup>
      ) : null}
      <HomeworkGroup
        title="Geçmiş"
        count={groups.past.length}
        empty="Geçmiş ödev yok."
      >
        {groups.past.map(row)}
      </HomeworkGroup>
    </div>
  );
}
