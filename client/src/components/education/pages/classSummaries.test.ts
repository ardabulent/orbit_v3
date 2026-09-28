import { describe, expect, it } from "vitest";
import type { TodayLesson } from "@/education/overviewService";
import type { ScheduleItem } from "../types";
import { buildClassSummaries, summaryFor } from "./classSummaries";

const lesson = (overrides: Partial<ScheduleItem>): ScheduleItem =>
  ({
    day: "Pazartesi",
    time: "09:00",
    title: "Matematik",
    teacher: "Murat Kaya",
    classId: "12-A",
    ...overrides,
  }) as ScheduleItem;

const today = (
  classId: string,
  attendanceTaken: boolean | null
): TodayLesson => ({
  id: `${classId}-${String(attendanceTaken)}`,
  time: "09:00",
  endTime: null,
  classId,
  className: classId,
  title: "Matematik",
  room: null,
  teacher: null,
  attendanceTaken,
});

describe("buildClassSummaries", () => {
  it("haftalık dersi sayar, ders–öğretmen ikilisini bir kez listeler", () => {
    const summaries = buildClassSummaries(
      [
        lesson({ day: "Pazartesi" }),
        lesson({ day: "Çarşamba" }),
        lesson({ title: "Fizik", teacher: null }),
        lesson({ classId: "12-B" }),
      ],
      []
    );

    expect(summaryFor(summaries, "12-A")).toEqual({
      weeklyLessons: 3,
      subjects: [
        { title: "Matematik", teacher: "Murat Kaya" },
        { title: "Fizik", teacher: null },
      ],
      today: "none",
    });
    expect(summaryFor(summaries, "12-B").weeklyLessons).toBe(1);
  });

  it("programı olmayan sınıf için boş özet döner", () => {
    expect(summaryFor(new Map(), "yok")).toEqual({
      weeklyLessons: 0,
      subjects: [],
      today: "none",
    });
  });

  it("bugünkü yoklama: alındı · bekliyor · bilinmiyor · ders yok", () => {
    const summaries = buildClassSummaries(
      [],
      [
        today("A", true),
        today("B", false),
        today("C", null),
        // Aynı sınıfın bir satırı alındı diyorsa sınıf alındı sayılır.
        today("D", false),
        today("D", true),
      ]
    );

    expect(summaryFor(summaries, "A").today).toBe("taken");
    expect(summaryFor(summaries, "B").today).toBe("pending");
    expect(summaryFor(summaries, "C").today).toBe("unknown");
    expect(summaryFor(summaries, "D").today).toBe("taken");
    expect(summaryFor(summaries, "E").today).toBe("none");
  });

  it("bilinmeyen bir satır bilinen durumu ezmez", () => {
    const summaries = buildClassSummaries(
      [],
      [today("A", false), today("A", null)]
    );
    expect(summaryFor(summaries, "A").today).toBe("pending");
  });
});
