import { describe, expect, it } from "vitest";
import type { ScheduleItem } from "../types";
import {
  ALL,
  buildWeekGrid,
  filterSchedule,
  NO_TEACHER,
  teacherOptions,
  timeRange,
} from "./scheduleGrid";

const item = (over: Partial<ScheduleItem>): ScheduleItem => ({
  day: "Pazartesi",
  time: "09:00",
  title: "Matematik",
  ...over,
});

describe("buildWeekGrid", () => {
  it("hafta içi hep görünür, hafta sonu yalnız ders varsa", () => {
    expect(buildWeekGrid([]).days).toEqual([
      "Pazartesi",
      "Salı",
      "Çarşamba",
      "Perşembe",
      "Cuma",
    ]);
    expect(buildWeekGrid([item({ day: "Pazar" })]).days).toContain("Pazar");
    expect(buildWeekGrid([item({ day: "Pazar" })]).days).not.toContain(
      "Cumartesi"
    );
  });

  it("saatleri sıralar ve aynı hücredeki dersleri birlikte döner", () => {
    const grid = buildWeekGrid([
      item({ time: "11:00", title: "Fizik" }),
      item({ time: "09:00", group: "12-B" }),
      item({ time: "09:00", group: "12-A" }),
    ]);
    expect(grid.times).toEqual(["09:00", "11:00"]);
    expect(grid.cell("Pazartesi", "09:00").map(i => i.group)).toEqual([
      "12-A",
      "12-B",
    ]);
    expect(grid.cell("Salı", "09:00")).toEqual([]);
  });
});

describe("filterSchedule / teacherOptions", () => {
  const rows = [
    item({ classId: "a", membershipId: "m1", teacher: "Murat Kaya" }),
    item({ classId: "b", membershipId: "m2", teacher: "Ayşe Demir" }),
    item({ classId: "a", membershipId: null, teacher: null }),
  ];

  it("sınıf ve öğretmen süzgeci birlikte uygulanır", () => {
    expect(filterSchedule(rows, { classId: "a", teacher: ALL })).toHaveLength(
      2
    );
    expect(
      filterSchedule(rows, { classId: "a", teacher: NO_TEACHER })
    ).toHaveLength(1);
    expect(filterSchedule(rows, { classId: ALL, teacher: ALL })).toHaveLength(
      3
    );
  });

  it("öğretmenler ada göre sıralı, öğretmensiz seçeneği sonda", () => {
    expect(teacherOptions(rows)).toEqual([
      { key: "m2", label: "Ayşe Demir" },
      { key: "m1", label: "Murat Kaya" },
      { key: NO_TEACHER, label: "Öğretmensiz" },
    ]);
  });
});

describe("timeRange", () => {
  it("bitiş yoksa yalnız başlangıç yazılır", () => {
    expect(timeRange(item({ endsAt: "09:40:00" }))).toBe("09:00–09:40");
    expect(timeRange(item({ endsAt: null }))).toBe("09:00");
  });
});
