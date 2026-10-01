import { describe, expect, it } from "vitest";
import {
  cellKey,
  defaultHours,
  editorToSlots,
  nextHour,
  templateSummary,
  templateToEditor,
} from "./scheduleTemplateGrid";
import { mapApplyResult } from "@/education/scheduleTemplateService";

const MAT = "mat";
const FIZ = "fiz";

describe("şablon tablosu", () => {
  it("boş şablon 09:00'dan başlayan altı ders saatiyle açılır", () => {
    const hours = defaultHours();
    expect(hours.map(h => `${h.startsAt}-${h.endsAt}`)).toEqual([
      "09:00-09:40",
      "09:50-10:30",
      "10:40-11:20",
      "11:30-12:10",
      "12:20-13:00",
      "13:10-13:50",
    ]);
  });

  it("yeni ders saati sonuncunun ardından teneffüs bırakır", () => {
    const hour = nextHour([{ key: "a", startsAt: "15:00", endsAt: "15:40" }]);
    expect([hour.startsAt, hour.endsAt]).toEqual(["15:50", "16:30"]);
  });

  it("kayıtlı şablon tabloya geri dönüşür ve aynı kutularla kaydedilir", () => {
    const slots = [
      {
        dayOfWeek: 1 as const,
        startsAt: "09:00",
        endsAt: "09:40",
        subjectId: MAT,
      },
      {
        dayOfWeek: 3 as const,
        startsAt: "10:00",
        endsAt: "10:40",
        subjectId: FIZ,
      },
      {
        dayOfWeek: 7 as const,
        startsAt: "09:00",
        endsAt: "09:40",
        subjectId: FIZ,
      },
    ];
    const state = templateToEditor({
      id: "t",
      name: "Sayısal",
      updatedAt: "",
      slots,
    });
    expect(state.sunday).toBe(true);
    expect(state.hours.map(h => h.startsAt)).toEqual(["09:00", "10:00"]);

    const result = editorToSlots(state);
    expect(result.ok && result.slots).toEqual([slots[0], slots[1], slots[2]]);
  });

  it("Pazar kapatılınca Pazar dersleri yazılmaz", () => {
    const hours = [{ key: "a", startsAt: "09:00", endsAt: "09:40" }];
    const result = editorToSlots({
      hours,
      sunday: false,
      cells: { [cellKey(1, "a")]: MAT, [cellKey(7, "a")]: FIZ },
    });
    expect(result.ok && result.slots.map(s => s.dayOfWeek)).toEqual([1]);
  });

  it("aynı başlangıç saati iki kez yazılamaz", () => {
    const result = editorToSlots({
      hours: [
        { key: "a", startsAt: "09:00", endsAt: "09:40" },
        { key: "b", startsAt: "09:00", endsAt: "09:40" },
      ],
      sunday: false,
      cells: { [cellKey(1, "a")]: MAT },
    });
    expect(result).toEqual({
      ok: false,
      error: "09:00 saati iki kez yazılmış; birini değiştirin.",
    });
  });

  it("bitişi başlangıçtan önce olan saat reddedilir", () => {
    const result = editorToSlots({
      hours: [{ key: "a", startsAt: "10:00", endsAt: "09:40" }],
      sunday: false,
      cells: { [cellKey(1, "a")]: MAT },
    });
    expect(result.ok).toBe(false);
  });

  it("boş tablo kaydedilmez", () => {
    expect(
      editorToSlots({ hours: defaultHours(), sunday: false, cells: {} }).ok
    ).toBe(false);
  });

  it("özet ders ve gün sayısını yazar", () => {
    expect(
      templateSummary({
        id: "t",
        name: "x",
        updatedAt: "",
        slots: [
          { dayOfWeek: 1, startsAt: "09:00", endsAt: null, subjectId: MAT },
          { dayOfWeek: 1, startsAt: "10:00", endsAt: null, subjectId: FIZ },
          { dayOfWeek: 2, startsAt: "09:00", endsAt: null, subjectId: MAT },
        ],
      })
    ).toBe("3 ders · 2 gün");
  });
});

describe("atama sonucu", () => {
  it("veritabanının yanıtını ekranın biçimine çevirir", () => {
    expect(
      mapApplyResult({
        saved: false,
        classes: [
          {
            class_id: "a",
            class_name: "12-A",
            added: 2,
            archived: 1,
            skipped: 0,
          },
        ],
        unassigned: [
          {
            class_name: "12-A",
            day_of_week: 1,
            starts_at: "09:00:00",
            subject_name: "Matematik",
            reason: "teacher_busy",
          },
        ],
      })
    ).toEqual({
      saved: false,
      classes: [
        { classId: "a", className: "12-A", added: 2, archived: 1, skipped: 0 },
      ],
      unassigned: [
        {
          className: "12-A",
          dayOfWeek: 1,
          startsAt: "09:00",
          subjectName: "Matematik",
          reason: "teacher_busy",
        },
      ],
    });
  });
});
