import { useEffect, useState, useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";
import {
  CONNECTION_NOTICE_GRACE_MS,
  connectionNotice,
} from "./connectionNotice";
import type { OrganizationChannelStatus } from "./useOrganizationChannel";

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * İnternet ya da canlı kanal koptuğunda ekranın üstünde duran uyarı
 * (2026-10-12, v1.5-12). Yalnız gösterir; yeniden bağlanma ve tazeleme
 * `useOrganizationChannel` ile React Query'nin işidir.
 */
export function ConnectionBanner({
  channelStatus,
}: {
  channelStatus: OrganizationChannelStatus;
}) {
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true
  );
  const notice = connectionNotice({ online, channelStatus });
  const noticeKind = notice?.kind ?? null;

  // Kısa kopmalar gösterilmez; durum süre dolana kadar sürerse görünür.
  const [shownKind, setShownKind] = useState<typeof noticeKind>(null);
  // Durum değişince (ör. bağlantı geldi, sonra yine gitti) bekleme baştan.
  const [seenKind, setSeenKind] = useState<typeof noticeKind>(noticeKind);
  if (noticeKind !== seenKind) {
    setSeenKind(noticeKind);
    setShownKind(null);
  }
  useEffect(() => {
    if (!noticeKind) return;
    const timer = setTimeout(
      () => setShownKind(noticeKind),
      CONNECTION_NOTICE_GRACE_MS
    );
    return () => clearTimeout(timer);
  }, [noticeKind]);

  if (!notice || shownKind !== notice.kind) return null;

  return (
    <div
      role="status"
      className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-[12px] text-amber-900 sm:px-6 lg:px-8"
    >
      <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>
        <strong>{notice.title}</strong> {notice.detail}
      </span>
    </div>
  );
}
