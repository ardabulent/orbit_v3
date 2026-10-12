import { describe, expect, it } from "vitest";
import { translateRoomError } from "./roomService";
import { translateScheduleError } from "./scheduleService";
import { getAffectedQueryKeys } from "@/realtime/realtimeMapping";
import { educationKeys } from "./educationQueries";

describe("derslikler (v1.5-15)", () => {
  it("aynı adlı derslik ve uzun ad Türkçe söylenir", () => {
    expect(translateRoomError({ code: "23505" })).toContain("zaten var");
    expect(translateRoomError({ code: "23514" })).toContain("60 karakter");
  });

  it("kullanımdaki derslik kapatılırken veritabanının cümlesi geçer", () => {
    const message =
      "Bu derslik kapatılamaz: ders programında 3 derste kullanılıyor.";
    expect(translateRoomError({ code: "ORB03", message })).toBe(message);
  });

  it("derslik doluyken ders programı hatası hangi dersin orada olduğunu söyler", () => {
    const message =
      "A-101 bu saatte dolu: Pazartesi günü 10:00–10:40 arası 11-A · Matematik dersi var.";
    expect(translateScheduleError({ code: "ORB07", message })).toBe(message);
  });

  it("derslik değişince derslik listesi ve program tazelenir", () => {
    const keys = getAffectedQueryKeys("rooms", "org-1");
    expect(keys).toContainEqual(["education", "rooms"]);
    expect(keys).toContainEqual(educationKeys.schedule("org-1"));
  });
});
