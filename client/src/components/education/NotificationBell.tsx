import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import {
  communicationKeys,
  useNotifications,
} from "@/communication/communicationQueries";
import {
  markNotificationsRead,
  type AppNotification,
} from "@/communication/notificationService";
import type { Section } from "./types";

const KNOWN_SECTIONS: Section[] = [
  "İletişim",
  "Ödevler",
  "Sınavlar",
  "Yoklama",
];

function timeAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "şimdi";
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} sa önce`;
  return `${Math.round(hours / 24)} gün önce`;
}

/**
 * Üst çubuktaki zil (2026-10-12). v1.5-22'de sahte olduğu için kaldırılmıştı;
 * artık gerçek bildirimleri sayar. Tıklanan bildirim okundu işaretlenir ve
 * ilgili sekme açılır.
 */
export function NotificationBell({
  onNavigate,
}: {
  onNavigate: (section: Section) => void;
}) {
  const queryClient = useQueryClient();
  const notifications = useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unread = notifications.data?.unreadCount ?? 0;
  const rows = notifications.data?.rows ?? [];

  const markRead = async (ids?: string[]) => {
    try {
      await markNotificationsRead(ids);
      await queryClient.invalidateQueries({ queryKey: communicationKeys.all });
    } catch (err: unknown) {
      toast.error("Bildirimler güncellenemedi", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const openItem = (item: AppNotification) => {
    setOpen(false);
    if (!item.readAt) void markRead([item.id]);
    const section = KNOWN_SECTIONS.find(s => s === item.section);
    if (section) onNavigate(section);
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label={
          unread > 0 ? `Bildirimler, ${unread} okunmamış` : "Bildirimler"
        }
        aria-expanded={open}
        className="relative grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
      >
        <Bell className="h-4 w-4" aria-hidden />
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-rose-600 px-1 text-center text-[10px] font-bold leading-[18px] text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Bildirimler"
          className="absolute right-0 top-11 z-40 w-[min(360px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,.14)]"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-[13px] font-extrabold text-slate-900">
              Bildirimler
            </p>
            {unread > 0 ? (
              <button
                type="button"
                onClick={() => void markRead()}
                className="text-[11px] font-bold text-blue-700 hover:underline"
              >
                Tümünü okundu işaretle
              </button>
            ) : null}
          </div>
          {notifications.isLoading ? (
            <p className="px-4 py-6 text-center text-[12px] text-slate-400">
              Yükleniyor…
            </p>
          ) : notifications.error ? (
            <p className="px-4 py-6 text-center text-[12px] text-rose-700">
              {notifications.error.message}
            </p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-6 text-center text-[12px] text-slate-400">
              Bildirim yok.
            </p>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-slate-50 overflow-y-auto">
              {rows.map(item => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => openItem(item)}
                    className={`flex w-full gap-2.5 px-4 py-3 text-left transition hover:bg-slate-50 ${
                      item.readAt ? "" : "bg-blue-50/40"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                        item.readAt ? "bg-transparent" : "bg-blue-600"
                      }`}
                    />
                    <span className="min-w-0">
                      <span className="block text-[12px] font-bold text-slate-800">
                        {item.title}
                      </span>
                      {item.body ? (
                        <span className="mt-0.5 line-clamp-2 block text-[11px] text-slate-500">
                          {item.body}
                        </span>
                      ) : null}
                      <span className="mt-0.5 block text-[10px] text-slate-400">
                        {timeAgo(item.createdAt)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
