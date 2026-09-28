import { describe, expect, it } from "vitest";
import { getDefaultScheduleDay, getTodayWeekDay } from "@/education/weekDays";

describe("scheduleHelpers", () => {
  describe("getTodayWeekDay", () => {
    it("hafta içi günlerini doğru çözer", () => {
      // 2026-08-24 Pazartesi
      expect(getTodayWeekDay(new Date("2026-08-24T10:00:00"))).toBe(
        "Pazartesi"
      );
      // 2026-08-25 Salı
      expect(getTodayWeekDay(new Date("2026-08-25T10:00:00"))).toBe("Salı");
      // 2026-08-26 Çarşamba
      expect(getTodayWeekDay(new Date("2026-08-26T10:00:00"))).toBe("Çarşamba");
      // 2026-08-27 Perşembe
      expect(getTodayWeekDay(new Date("2026-08-27T10:00:00"))).toBe("Perşembe");
      // 2026-08-28 Cuma
      expect(getTodayWeekDay(new Date("2026-08-28T10:00:00"))).toBe("Cuma");
    });

    it("hafta sonunda (Cumartesi ve Pazar) günün adını döner", () => {
      // 2026-08-29 Cumartesi
      expect(getTodayWeekDay(new Date("2026-08-29T10:00:00"))).toBe(
        "Cumartesi"
      );
      // 2026-08-30 Pazar
      expect(getTodayWeekDay(new Date("2026-08-30T10:00:00"))).toBe("Pazar");
    });
  });

  describe("getDefaultScheduleDay", () => {
    it("hafta içi bugünün gününü seçili getirir", () => {
      expect(getDefaultScheduleDay(new Date("2026-08-26T10:00:00"))).toBe(
        "Çarşamba"
      );
    });

    it("hafta sonu bugünün gününü varsayılan olarak seçer", () => {
      expect(getDefaultScheduleDay(new Date("2026-08-29T10:00:00"))).toBe(
        "Cumartesi"
      );
      expect(getDefaultScheduleDay(new Date("2026-08-30T10:00:00"))).toBe(
        "Pazar"
      );
    });
  });
});
