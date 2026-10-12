import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth/useAuth";
import { isDemoMode } from "@/auth/runtime";
import { supabase } from "@/lib/supabaseClient";
import { reportError } from "@/errorReporting/installErrorReporting";
import { communicationKeys } from "@/communication/communicationQueries";

/**
 * Kişiye özel `user:<kullanıcı>` kanalı (2026-10-12, göç 20261031000000).
 *
 * Bildirim ve mesaj kişiye özeldir; kurum kanalından yayınlansaydı her mesaj
 * bütün kurumun ekranını tazelerdi. Veritabanı bildirim yazınca bu kanala
 * veri taşımayan bir dürtme gönderir; burada yalnız mesaj ve bildirim
 * sorguları tazelenir (kurum kanalındaki kalıp: yükten önbelleğe yazılmaz).
 * Kanalı yalnız sahibi dinleyebilir (realtime.messages kuralı).
 */
export function useUserChannel(): void {
  const queryClient = useQueryClient();
  const { identity } = useAuth();
  const userId = !isDemoMode && identity?.membership ? identity.userId : null;

  useEffect(() => {
    if (!userId) return;
    let active = true;
    let hadDisconnected = false;

    const refresh = () =>
      queryClient.invalidateQueries({ queryKey: communicationKeys.all });

    // Kanal jeton verildikten SONRA açılır: `setAuth` asenkron ve özel kanal
    // jetonsuz katılırsa yetki kuralı onu reddeder (2026-10-12'de ölçüldü:
    // beklemeden abone olan istemciye dürtme hiç gelmedi).
    let channel: ReturnType<typeof supabase.channel> | null = null;
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        if (data?.session?.access_token) {
          await supabase.realtime.setAuth(data.session.access_token);
        }
      } catch (err: unknown) {
        // Jeton verilemezse kanal açılmaz (fail-closed); sessiz kalmaz.
        reportError(
          "error",
          err instanceof Error ? err : new Error("Oturum okunamadı")
        );
        return;
      }
      if (!active) return;
      channel = supabase.channel(`user:${userId}`, {
        config: { private: true },
      });
      channel.on("broadcast", { event: "notify" }, () => {
        if (active) void refresh();
      });
      channel.subscribe(status => {
        if (!active) return;
        if (status === "SUBSCRIBED") {
          // Kopukken gelen dürtmeler kaçmış olabilir.
          if (hadDisconnected) void refresh();
          hadDisconnected = false;
        } else if (
          status === "TIMED_OUT" ||
          status === "CLOSED" ||
          status === "CHANNEL_ERROR"
        ) {
          hadDisconnected = true;
        }
      });
    })();

    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}
