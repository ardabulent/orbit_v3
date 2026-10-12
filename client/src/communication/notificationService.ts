import { supabase } from "@/lib/supabaseClient";
import { userFacingErrorText } from "@/lib/userFacingError";

/**
 * Uygulama içi bildirimler (2026-10-12, göç 20261031000000).
 *
 * Bildirimi veritabanı yazar (mesaj, duyuru, ödev, sınav sonucu,
 * devamsızlık); kullanıcı yalnız kendininkini görür ve okundu işaretler.
 * Okunmuş bildirim 90 gün sonra silinir.
 */

export type NotificationKind =
  "message" | "announcement" | "homework" | "exam_result" | "attendance";

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  /** Tıklanınca açılacak sekme. */
  section: string | null;
  entityId: string | null;
  createdAt: string;
  readAt: string | null;
};

export const NOTIFICATION_PAGE = 30;

export async function loadNotifications(): Promise<{
  rows: AppNotification[];
  unreadCount: number;
}> {
  const [list, unread] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, kind, title, body, section, entity_id, created_at, read_at")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(NOTIFICATION_PAGE),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null),
  ]);
  const error = list.error ?? unread.error;
  if (error) {
    throw new Error(userFacingErrorText(error) ?? "Bildirimler alınamadı.");
  }
  return {
    rows: (
      (list.data ?? []) as {
        id: string;
        kind: NotificationKind;
        title: string;
        body: string | null;
        section: string | null;
        entity_id: string | null;
        created_at: string;
        read_at: string | null;
      }[]
    ).map(row => ({
      id: row.id,
      kind: row.kind,
      title: row.title,
      body: row.body,
      section: row.section,
      entityId: row.entity_id,
      createdAt: row.created_at,
      readAt: row.read_at,
    })),
    unreadCount: unread.count ?? 0,
  };
}

/** Verilen bildirimleri ya da (boşsa) hepsini okundu işaretler. */
export async function markNotificationsRead(ids?: string[]): Promise<void> {
  const { error } = await supabase.rpc("mark_notifications_read", {
    target_ids: ids && ids.length > 0 ? ids : null,
  });
  if (error) {
    throw new Error(
      userFacingErrorText(error) ?? "Bildirimler güncellenemedi."
    );
  }
}
