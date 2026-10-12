import type { Room } from "@/education/roomService";
import type { WeekDay } from "@/education/weekDays";
import type { ScheduleItem } from "../types";

/**
 * Derslik doluluğu (2026-10-12, v1.5-15): seçilen günde hangi derslikte
 * hangi saatte ders var. Ekranın kendisi `RoomsTab`'ta; bu modül saf.
 */
export type RoomDay = {
  room: Room;
  lessons: ScheduleItem[];
};

const startOf = (item: ScheduleItem) =>
  (item.startsAt ?? item.time ?? "").slice(0, 5);

export function roomOccupancy(
  rooms: Room[],
  schedule: ScheduleItem[],
  day: WeekDay
): { byRoom: RoomDay[]; withoutRoom: number } {
  const onDay = schedule.filter(item => item.day === day);
  const byRoom = rooms
    .filter(room => !room.archivedAt)
    .map(room => ({
      room,
      lessons: onDay
        .filter(item => item.roomId === room.id)
        .sort((a, b) => startOf(a).localeCompare(startOf(b))),
    }));
  return {
    byRoom,
    withoutRoom: onDay.filter(item => !item.roomId).length,
  };
}
