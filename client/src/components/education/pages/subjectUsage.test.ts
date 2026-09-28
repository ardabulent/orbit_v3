import { describe, expect, it } from "vitest";
import type { ScheduleItem } from "../types";
import {
  buildSubjectUsage,
  describeSubjectUsage,
  usageFor,
} from "./subjectUsage";

const lesson = (over: Partial<ScheduleItem>): ScheduleItem => ({
  day: "Pazartesi",
  time: "09:00",
  title: "Matematik",
  ...over,
});

describe("buildSubjectUsage", () => {
  it("dersi sınıf ve öğretmenleriyle sayar; aynı sınıf bir kez yazılır", () => {
    const usage = buildSubjectUsage([
      lesson({ subjectId: "mat", group: "12-A", teacher: "Murat Kaya" }),
      lesson({ subjectId: "mat", group: "12-A", teacher: "Murat Kaya" }),
      lesson({ subjectId: "mat", group: "11-B", teacher: "Ayşe Demir" }),
    ]);

    expect(usageFor(usage, "mat")).toEqual({
      weeklyLessons: 3,
      classes: ["11-B", "12-A"],
      teachers: ["Ayşe Demir", "Murat Kaya"],
    });
  });

  it("ders kimliği olmayan satırı hiçbir derse yazmaz", () => {
    const usage = buildSubjectUsage([lesson({ subjectId: null })]);
    expect(usage.size).toBe(0);
  });

  it("programda olmayan ders boş özet döner ve bunu açıkça söyler", () => {
    const usage = buildSubjectUsage([]);
    expect(describeSubjectUsage(usageFor(usage, "fiz"))).toBe(
      "Ders programında yok"
    );
  });

  it("öğretmensiz ders 'Öğretmensiz' yazılır, boş bırakılmaz", () => {
    const usage = buildSubjectUsage([
      lesson({ subjectId: "fiz", group: "12-A", teacher: null }),
    ]);
    expect(describeSubjectUsage(usageFor(usage, "fiz"))).toBe(
      "Haftada 1 ders · 12-A · Öğretmensiz"
    );
  });
});
