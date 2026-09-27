import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadAdminOverviewCounts,
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
