import { describe, expect, it } from "vitest";
import { roomOccupancy } from "./roomOccupancy";
import type { ScheduleItem } from "../types";
import type { Room } from "@/education/roomService";

const room = (
  id: string,
  name: string,
  archivedAt: string | null = null
): Room => ({
  id,
  name,
  shareable: false,
  archivedAt,
});

const lesson = (
  id: string,
  day: ScheduleItem["day"],
  startsAt: string,
  roomId: string | null
) =>
  ({
    id,
    day,
    time: startsAt,
    startsAt,
    roomId,
    title: "Ders",
  }) as ScheduleItem;

describe("roomOccupancy (derslik doluluğu, v1.5-15)", () => {
  it("seçilen günün derslerini dersliğe göre, saat sırasıyla toplar", () => {
    const result = roomOccupancy(
      [room("a", "A-101"), room("b", "B-202"), room("x", "Eski", "2026-10-01")],
      [
        lesson("1", "Pazartesi", "11:00:00", "a"),
        lesson("2", "Pazartesi", "09:00:00", "a"),
        lesson("3", "Salı", "09:00:00", "a"),
        lesson("4", "Pazartesi", "10:00:00", null),
      ],
      "Pazartesi"
    );
    expect(result.byRoom.map(r => r.room.name)).toEqual(["A-101", "B-202"]);
    expect(result.byRoom[0].lessons.map(l => l.id)).toEqual(["2", "1"]);
    expect(result.byRoom[1].lessons).toEqual([]);
    expect(result.withoutRoom).toBe(1);
  });
});
