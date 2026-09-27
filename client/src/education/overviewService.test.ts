import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadAdminOverviewCounts,
  loadMyLessonsToday,
  loadStudentOverdueInstallments,
  loadStudentOverview,
  loadStudentUpcomingHomework,
  loadTeacherOverviewCounts,
  loadTodayLessons,
  mapTodayLessonRow,
} from "./overviewService";

const rpcMock = vi.fn();

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

beforeEach(() => {
  rpcMock.mockReset();
});

describe("loadAdminOverviewCounts", () => {
  it("passes the organization explicitly and maps bigint strings to numbers", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          active_students: "42",
          students_without_class: 3,
          students_without_guardian: "5",
          active_classes: 4,
          lessons_today: "6",
          classes_missing_attendance_today: 1,
        },
      ],
      error: null,
    });

    const counts = await loadAdminOverviewCounts("org-1");

    expect(rpcMock).toHaveBeenCalledWith("admin_overview_counts", {
      target_organization_id: "org-1",
    });
    expect(counts).toEqual({
      activeStudents: 42,
      studentsWithoutClass: 3,
      studentsWithoutGuardian: 5,
      activeClasses: 4,
      lessonsToday: 6,
      classesMissingAttendanceToday: 1,
    });
  });

  it("returns null when no row comes back — zeros would claim an empty organization", async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });
    await expect(loadAdminOverviewCounts("org-1")).resolves.toBeNull();
  });

  it("throws on error instead of inventing zeros", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(loadAdminOverviewCounts("org-1")).rejects.toThrow(
      "Genel bakış sayıları yüklenemedi."
    );
  });
});

describe("loadTodayLessons", () => {
  it("maps rows and keeps the database order", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          entry_id: "e1",
          starts_at: "09:00:00",
          ends_at: "09:40:00",
          class_id: "c1",
          class_name: "12-A",
          subject_name: "Matematik",
          title: null,
          room: " B-12 ",
          teacher_name: "Ayşe Yalçın",
          attendance_taken: true,
        },
        {
          entry_id: "e2",
          starts_at: "10:00:00",
          ends_at: null,
          class_id: "c2",
          class_name: "12-B",
          subject_name: null,
          title: "Etüt",
          room: null,
          teacher_name: null,
          attendance_taken: false,
        },
      ],
      error: null,
    });

    const lessons = await loadTodayLessons("org-1");

    expect(rpcMock).toHaveBeenCalledWith("today_lessons", {
      target_organization_id: "org-1",
    });
    expect(lessons.map(lesson => lesson.id)).toEqual(["e1", "e2"]);
    expect(lessons[0]).toMatchObject({
      time: "09:00",
      endTime: "09:40",
      title: "Matematik",
      room: "B-12",
      attendanceTaken: true,
    });
    expect(lessons[1]).toMatchObject({
      endTime: null,
      title: "Etüt",
      teacher: null,
      attendanceTaken: false,
    });
  });

  it("throws on error", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(loadTodayLessons("org-1")).rejects.toThrow(
      "Bugünün dersleri yüklenemedi."
    );
  });
});

describe("mapTodayLessonRow", () => {
  it("prefers the subject name over the free title", () => {
    const lesson = mapTodayLessonRow({
      entry_id: "e",
      starts_at: "08:30:00",
      ends_at: null,
      class_id: "c",
      class_name: "11-A",
      subject_name: "Fizik",
      title: "Deneme",
      room: null,
      teacher_name: null,
      attendance_taken: false,
    });
    expect(lesson.title).toBe("Fizik");
  });
});

describe("loadTeacherOverviewCounts", () => {
  it("calls the teacher function with the organization and maps counts", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          my_classes: 2,
          my_students: "31",
          my_lessons_today: 3,
          classes_missing_attendance_today: "1",
          homework_awaiting_marking: 4,
        },
      ],
      error: null,
    });

    await expect(loadTeacherOverviewCounts("org-1")).resolves.toEqual({
      myClasses: 2,
      myStudents: 31,
      myLessonsToday: 3,
      classesMissingAttendanceToday: 1,
      homeworkAwaitingMarking: 4,
    });
    expect(rpcMock).toHaveBeenCalledWith("teacher_overview_counts", {
      target_organization_id: "org-1",
    });
  });

  it("returns null without a row and throws on error", async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null });
    await expect(loadTeacherOverviewCounts("org-1")).resolves.toBeNull();

    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "x" } });
    await expect(loadTeacherOverviewCounts("org-1")).rejects.toThrow(
      "Genel bakış sayıları yüklenemedi."
    );
  });
});

describe("loadMyLessonsToday", () => {
  it("keeps an unknown attendance state as null, not false", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          entry_id: "e1",
          starts_at: "12:00:00",
          ends_at: null,
          class_id: "c3",
          class_name: "12-C",
          subject_name: "Matematik",
          title: null,
          room: null,
          teacher_name: null,
          attendance_taken: null,
        },
      ],
      error: null,
    });

    const lessons = await loadMyLessonsToday("org-1");

    expect(rpcMock).toHaveBeenCalledWith("my_lessons_today", {
      target_organization_id: "org-1",
    });
    expect(lessons[0].attendanceTaken).toBeNull();
  });
});

describe("loadStudentOverview", () => {
  const baseRow = {
    lessons_today: 2,
    homework_due_this_week: "3",
    homework_due_soon: 2,
    homework_missed: "1",
    absent_count: 1,
    late_count: "1",
    latest_exam_name: "TYT Deneme 3",
    latest_exam_date: "2026-09-22",
    latest_exam_score: "72",
    latest_exam_max_score: "100",
  };

  it("passes the student id, not the organization", async () => {
    rpcMock.mockResolvedValue({ data: [baseRow], error: null });

    const overview = await loadStudentOverview("student-1");

    expect(rpcMock).toHaveBeenCalledWith("student_overview_counts", {
      target_student_id: "student-1",
    });
    expect(overview).toEqual({
      lessonsToday: 2,
      homeworkDueThisWeek: 3,
      homeworkDueSoon: 2,
      homeworkMissed: 1,
      absentCount: 1,
      lateCount: 1,
      latestExam: {
        name: "TYT Deneme 3",
        date: "2026-09-22",
        score: 72,
        maxScore: 100,
      },
    });
  });

  it("does not invent a zero score when the student has no exam", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          ...baseRow,
          latest_exam_name: null,
          latest_exam_date: null,
          latest_exam_score: null,
          latest_exam_max_score: null,
        },
      ],
      error: null,
    });

    const overview = await loadStudentOverview("student-1");
    expect(overview?.latestExam).toBeNull();
  });

  it("returns null when the student is not visible, throws on error", async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null });
    await expect(loadStudentOverview("student-1")).resolves.toBeNull();

    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "x" } });
    await expect(loadStudentOverview("student-1")).rejects.toThrow(
      "Genel bakış sayıları yüklenemedi."
    );
  });
});

describe("loadStudentUpcomingHomework", () => {
  it("maps rows and keeps an empty subject as null", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          homework_id: "h1",
          title: "Türev test 3",
          subject_name: " ",
          class_name: "12-A",
          due_date: "2026-09-28",
        },
      ],
      error: null,
    });

    const homework = await loadStudentUpcomingHomework("student-1");

    expect(rpcMock).toHaveBeenCalledWith("student_upcoming_homework", {
      target_student_id: "student-1",
    });
    expect(homework).toEqual([
      {
        id: "h1",
        title: "Türev test 3",
        subject: null,
        className: "12-A",
        dueDate: "2026-09-28",
      },
    ]);
  });
});

describe("loadStudentOverdueInstallments", () => {
  it("returns the overdue count for one student", async () => {
    rpcMock.mockResolvedValue({
      data: [{ student_id: "student-1", overdue_count: "2" }],
      error: null,
    });

    await expect(loadStudentOverdueInstallments("student-1")).resolves.toBe(2);
    expect(rpcMock).toHaveBeenCalledWith("student_payment_summaries", {
      target_student_ids: ["student-1"],
    });
  });

  it("returns null without a row — no plan is not the same as zero overdue", async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });
    await expect(
      loadStudentOverdueInstallments("student-1")
    ).resolves.toBeNull();
  });

  it("throws on error instead of hiding it", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "x" } });
    await expect(loadStudentOverdueInstallments("student-1")).rejects.toThrow(
      "Ödeme durumu yüklenemedi."
    );
  });
});
