import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/auth/useAuth";
import { useRooms } from "@/education/educationQueries";
import {
  archiveRoom,
  createRoom,
  restoreRoom,
  ROOM_NAME_MAX,
  updateRoom,
  type Room,
} from "@/education/roomService";
import { getTodayWeekDay, WEEK_DAYS, type WeekDay } from "@/education/weekDays";
import { CardSkeleton, EmptyState, ErrorState } from "../shared";
import type { ScheduleItem } from "../types";
import { roomOccupancy } from "./roomOccupancy";
import { timeRange } from "./scheduleGrid";

/**
 * Ders Programı → Derslikler (2026-10-12, ROADMAP v1.5-15). Yalnız yönetici.
 *
 * Üstte derslik ekleme; altında seçilen günün doluluğu: her derslikte hangi
 * saatte hangi sınıfın dersi var. Aynı saatte iki ders veritabanında
 * engelli; paylaşılabilir derslik (Online, Bahçe) bunun dışında.
 */
export function RoomsTab({ schedule }: { schedule: ScheduleItem[] }) {
  const { identity } = useAuth();
  const organizationId = identity?.membership?.organizationId ?? "";
  const queryClient = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const roomsQuery = useRooms({ includeArchived: showArchived });
  const [day, setDay] = useState<WeekDay>(getTodayWeekDay());
  const [newName, setNewName] = useState("");
  const [newShareable, setNewShareable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(
    null
  );

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["education"] });

  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(done);
      await refresh();
      return true;
    } catch (err: unknown) {
      toast.error("Derslik işlemi yapılamadı", {
        description: err instanceof Error ? err.message : undefined,
      });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const ok = await run(
      () =>
        createRoom({
          organizationId,
          name: newName,
          shareable: newShareable,
        }),
      `"${newName.trim()}" eklendi`
    );
    if (ok) {
      setNewName("");
      setNewShareable(false);
    }
  };

  const rooms = roomsQuery.data ?? [];
  const occupancy = roomOccupancy(rooms, schedule, day);
  const archived = rooms.filter(r => r.archivedAt);

  return (
    <div className="mt-5 space-y-5">
      <form
        onSubmit={handleAdd}
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4"
      >
        <label className="grid min-w-[180px] flex-1 gap-1 text-[11px] font-bold text-slate-600">
          Yeni derslik
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            maxLength={ROOM_NAME_MAX}
            placeholder="Örn: A-101, Fen Laboratuvarı"
            className="h-9 rounded-lg border border-slate-200 px-3 text-[13px] font-normal outline-none focus:border-slate-400"
          />
        </label>
        <label className="flex h-9 items-center gap-2 text-[12px] text-slate-700">
          <input
            type="checkbox"
            checked={newShareable}
            onChange={e => setNewShareable(e.target.checked)}
          />
          Paylaşılabilir
        </label>
        <button
          type="submit"
          disabled={busy || !newName.trim()}
          className="h-9 rounded-lg bg-slate-900 px-4 text-[12px] font-bold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          Ekle
        </button>
        <p className="w-full text-[11px] text-slate-500">
          Aynı saatte iki derse verilemez. Online, Bahçe gibi aynı anda birden
          çok derse açık yerleri “paylaşılabilir” işaretleyin.
        </p>
      </form>

      <div>
        <div
          className="flex flex-wrap items-center gap-1"
          role="tablist"
          aria-label="Gün"
        >
          {WEEK_DAYS.map(d => (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={d === day}
              onClick={() => setDay(d)}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-bold transition ${
                d === day
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
        {occupancy.withoutRoom > 0 ? (
          <p className="mt-2 text-[11px] text-slate-500">
            {day} günü {occupancy.withoutRoom} dersin dersliği seçilmemiş.
          </p>
        ) : null}
      </div>

      {roomsQuery.isLoading ? (
        <CardSkeleton />
      ) : roomsQuery.error ? (
        <ErrorState
          title="Derslikler yüklenemedi"
          message={roomsQuery.error.message}
          onRetry={() => void roomsQuery.refetch()}
        />
      ) : occupancy.byRoom.length === 0 ? (
        <EmptyState
          title="Henüz derslik yok"
          description="Yukarıdan ekleyin; sonra ders programında her derse derslik seçin."
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {occupancy.byRoom.map(({ room, lessons }) => (
            <li
              key={room.id}
              className="rounded-2xl border border-slate-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                {editing?.id === room.id ? (
                  <form
                    className="flex flex-1 gap-2"
                    onSubmit={async e => {
                      e.preventDefault();
                      const ok = await run(
                        () =>
                          updateRoom(room.id, {
                            name: editing.name,
                            shareable: room.shareable,
                          }),
                        "Derslik adı değişti"
                      );
                      if (ok) setEditing(null);
                    }}
                  >
                    <input
                      aria-label="Derslik adı"
                      value={editing.name}
                      maxLength={ROOM_NAME_MAX}
                      onChange={e =>
                        setEditing({ id: room.id, name: e.target.value })
                      }
                      className="h-8 min-w-0 flex-1 rounded-lg border border-slate-200 px-2 text-[13px]"
                    />
                    <button
                      type="submit"
                      disabled={busy || !editing.name.trim()}
                      className="h-8 rounded-lg bg-slate-900 px-3 text-[11px] font-bold text-white disabled:opacity-50"
                    >
                      Kaydet
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(null)}
                      className="h-8 px-2 text-[11px] font-bold text-slate-500"
                    >
                      Vazgeç
                    </button>
                  </form>
                ) : (
                  <p className="text-[13px] font-extrabold text-slate-800">
                    {room.name}
                    {room.shareable ? (
                      <span className="ml-2 rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                        Paylaşılabilir
                      </span>
                    ) : null}
                  </p>
                )}
                {editing?.id !== room.id ? (
                  <RoomActions
                    room={room}
                    busy={busy}
                    onRename={() =>
                      setEditing({ id: room.id, name: room.name })
                    }
                    onToggleShare={() =>
                      void run(
                        () =>
                          updateRoom(room.id, {
                            name: room.name,
                            shareable: !room.shareable,
                          }),
                        room.shareable
                          ? "Paylaşım kapatıldı"
                          : "Derslik paylaşılabilir oldu"
                      )
                    }
                    onArchive={() =>
                      void run(() => archiveRoom(room.id), "Derslik kapatıldı")
                    }
                  />
                ) : null}
              </div>
              {lessons.length === 0 ? (
                <p className="mt-2 text-[12px] text-slate-400">
                  {day} günü boş.
                </p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {lessons.map(lesson => (
                    <li
                      key={lesson.id}
                      className="flex gap-2 text-[12px] text-slate-700"
                    >
                      <span className="w-[92px] shrink-0 font-bold tabular-nums text-slate-900">
                        {timeRange(lesson)}
                      </span>
                      <span className="min-w-0 truncate">
                        {[lesson.group, lesson.title, lesson.teacher]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      <div>
        <label className="flex items-center gap-2 text-[12px] text-slate-600">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={e => setShowArchived(e.target.checked)}
          />
          Kapatılan derslikleri göster
        </label>
        {showArchived ? (
          archived.length === 0 ? (
            <p className="mt-2 text-[12px] text-slate-400">
              Kapatılmış derslik yok.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
              {archived.map(room => (
                <li
                  key={room.id}
                  className="flex items-center justify-between px-4 py-2.5 text-[12px]"
                >
                  <span className="text-slate-600">{room.name}</span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () => restoreRoom(room.id),
                        "Derslik yeniden açıldı"
                      )
                    }
                    className="rounded-lg border border-slate-200 px-3 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Aç
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </div>
    </div>
  );
}

function RoomActions({
  room,
  busy,
  onRename,
  onToggleShare,
  onArchive,
}: {
  room: Room;
  busy: boolean;
  onRename: () => void;
  onToggleShare: () => void;
  onArchive: () => void;
}) {
  const action =
    "rounded-md px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50";
  return (
    <div className="flex flex-wrap gap-1">
      <button
        type="button"
        className={action}
        disabled={busy}
        onClick={onRename}
      >
        Yeniden adlandır
      </button>
      <button
        type="button"
        className={action}
        disabled={busy}
        onClick={onToggleShare}
      >
        {room.shareable ? "Paylaşımı kapat" : "Paylaşılabilir yap"}
      </button>
      <button
        type="button"
        className={action}
        disabled={busy}
        onClick={onArchive}
      >
        Kapat
      </button>
    </div>
  );
}
