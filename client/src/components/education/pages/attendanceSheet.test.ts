import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  addDaysIso,
  isoWeekDayOf,
  lessonsOnDate,
  targetFromLesson,
  attendanceTargetLabel,
  countStatuses,
  describeCounts,
  markRemainingPresent,
} from "./attendanceSheet";

describe("markRemainingPresent", () => {
  it("yalnız işaretlenmemişleri 'Katıldı' yapar, seçilmiş durumu ezmez", () => {
    expect(
      markRemainingPresent(["a", "b", "c"], { a: "Gelmedi", b: null })
    ).toEqual({ a: "Gelmedi", b: "Katıldı", c: "Katıldı" });
  });
});

describe("countStatuses / describeCounts", () => {
  it("durumları ve seçilmeyenleri sayar", () => {
    const counts = countStatuses(["a", "b", "c", "d"], {
      a: "Katıldı",
      b: "Katıldı",
      c: "Gelmedi",
    });
    expect(counts.Katıldı).toBe(2);
    expect(counts.Gelmedi).toBe(1);
    expect(counts.unmarked).toBe(1);
    expect(describeCounts(counts)).toBe("2 katıldı · 1 gelmedi · 1 seçilmedi");
  });

  it("öğrencisi olmayan listede 'Öğrenci yok' der", () => {
    expect(describeCounts(countStatuses([], {}))).toBe("Öğrenci yok");
  });
});

describe("attendanceTargetLabel", () => {
  it("ders, sınıf, tarih ve saat yazılır; saatsiz oturumda saat yok", () => {
    const base = {
      classId: "c",
      className: "12-A",
      sessionDate: "2026-09-28",
      subjectId: "s",
      title: "Matematik",
    };
    expect(attendanceTargetLabel({ ...base, startsAt: "09:00:00" })).toBe(
      "Matematik · 12-A · 28 Eylül 2026 · 09:00"
    );
    expect(attendanceTargetLabel({ ...base, startsAt: null })).toBe(
      "Matematik · 12-A · 28 Eylül 2026"
    );
  });
});

describe("tarih yardımcıları", () => {
  it("gün ekler/çıkarır, ay ve yıl sınırını doğru geçer", () => {
    expect(addDaysIso("2026-09-28", -30)).toBe("2026-08-29");
    expect(addDaysIso("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("ISO hafta günü: Pazartesi 1, Pazar 7", () => {
    expect(isoWeekDayOf("2026-09-28")).toBe(1);
    expect(isoWeekDayOf("2026-10-04")).toBe(7);
  });
});

describe("hedef oluşturma", () => {
  const entry = {
    id: "e1",
    day: "Pazartesi" as const,
    time: "09:00",
    title: "Matematik",
    classId: "c",
    subjectId: "s",
    startsAt: "09:00:00",
    dayOfWeek: 1,
  };

  it("bugünkü dersin kimliği ve saati programdan okunur", () => {
    const lesson = {
      id: "e1",
      time: "09:00",
      endTime: null,
      classId: "c",
      className: "12-A",
      title: "Matematik",
      room: null,
      teacher: null,
      attendanceTaken: false,
    };
    expect(targetFromLesson(lesson, [entry], "2026-09-28")).toEqual({
      classId: "c",
      className: "12-A",
      sessionDate: "2026-09-28",
      subjectId: "s",
      startsAt: "09:00:00",
      title: "Matematik",
    });
    // Program satırı yoksa oturum açılmaz.
    expect(targetFromLesson(lesson, [], "2026-09-28")).toBeNull();
  });

  it("başka gün: yalnız o hafta gününün dersleri", () => {
    expect(lessonsOnDate([entry], "c", "2026-09-28")).toHaveLength(1);
    expect(lessonsOnDate([entry], "c", "2026-09-29")).toHaveLength(0);
  });
});

describe("K-03: yoklama listesi önceden işaretli gelmez", () => {
  it("liste açılınca durum yalnız kayıttan gelir, varsayılan 'Katıldı' yok", () => {
    const kod = readFileSync(
      path.join(import.meta.dirname, "AttendanceSheetView.tsx"),
      "utf8"
    );
    expect(kod).toContain("map[student.studentId] = student.status ?? null;");
    expect(kod).not.toMatch(/student\.status \?\? "Katıldı"/);
  });
});
