import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth/useAuth";
import { isDemoMode } from "@/auth/runtime";
import { supabase } from "@/lib/supabaseClient";
import { reportError } from "@/errorReporting/installErrorReporting";
import { educationKeys } from "@/education/educationQueries";
import {
  getAffectedQueryKeys,
  REALTIME_BATCH_DEBOUNCE_MS,
  type RealtimeChangePayload,
} from "./realtimeMapping";

export type OrganizationChannelStatus =
  | "IDLE"
  | "CONNECTING"
  | "SUBSCRIBED"
  | "TIMED_OUT"
  | "CLOSED"
  | "CHANNEL_ERROR";

export type OrganizationChannelState = {
  status: OrganizationChannelStatus;
  isConnected: boolean;
  error: Error | null;
};

export type UseOrganizationChannelOptions = {
  /**
   * Dinlenecek kurum kimliği. Belirtilmezse `useAuth().identity` üzerinden çözülür.
   */
  organizationId?: string | null;
  /**
   * Hook'un aktif olup olmadığı. Varsayılan `true`.
   */
  enabled?: boolean;
};

/**
 * Aktif kurumun Realtime kanalına abone olan tekil hook (v1.3-05).
 *
 * Mimari kısıtlar (v1.3-05 brifingi):
 * 1. **Tek abonelik, tek yer:** `EducationPlatform` içinde tek kez çağrılır, ekran başına çağrılmaz.
 * 2. **Kanal adı ve gizlilik:** `org:<organizationId>` konu adı ve `private: true` zorunludur.
 * 3. **⛔ Yükten cache'e yazılmaz:** Yayın satır düzeyinde RLS'ten geçmez; veri taşımaz,
 *    yalnızca boş bir dürtmedir. `setQueryData` kesinlikle çağrılmaz; yalnızca `invalidateQueries` yapılır.
 * 4. **Jeton tazelenmesi:** `private: true` kanallar için `supabase.realtime.setAuth(token)`
 *    başlangıçta ve her oturum/jeton yenilenmesinde (`TOKEN_REFRESHED`) tekrar verilir.
 * 5. **`<StrictMode>` uyumluluğu:** Kurulum ve sökme çiftleri tamdır; unmount sırasında kanal kaldırılır.
 * 6. **Birleştirme (Debounce):** Arka arkaya gelen mesajlar 300 ms penceresinde toplanıp tekilleştirilir.
 * 7. **Kopma ve yeniden bağlanma (K-22):** Bağlantı koptuktan sonra tekrar `SUBSCRIBED` olunduğunda,
 *    kopukluk sırasında kaçırılan olayları telafi etmek için `educationKeys.all` bir kez toptan tazelenir.
 */
export function useOrganizationChannel(
  options?: UseOrganizationChannelOptions
): OrganizationChannelState {
  const queryClient = useQueryClient();
  const { identity } = useAuth();

  const organizationId =
    options?.organizationId ?? identity?.membership?.organizationId ?? null;

  const isEnabled =
    (options?.enabled ?? true) && !isDemoMode && Boolean(organizationId);

  const [channelStatus, setChannelStatus] = useState<
    "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR" | null
  >(null);
  const [error, setError] = useState<Error | null>(null);

  // Durum React durum türetmesi olarak belirlenir:
  // - Devre dışıysa her zaman "IDLE"
  // - Etkinse ve kanal henüz yanıt vermediyse "CONNECTING"
  // - Kanaldan durum geldiyse o durum geçerlidir
  const status: OrganizationChannelStatus =
    !isEnabled || !organizationId ? "IDLE" : (channelStatus ?? "CONNECTING");

  // Yeniden bağlanma (reconnect) takibi için ref'ler
  const wasConnectedRef = useRef(false);
  const hadDisconnectedRef = useRef(false);

  // Arka arkaya gelen mesajları biriktirme ve tekilleştirme
  const pendingTablesRef = useRef<Set<string>>(new Set());
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isEnabled || !organizationId) {
      wasConnectedRef.current = false;
      hadDisconnectedRef.current = false;
      return;
    }

    let active = true;
    const pendingTables = pendingTablesRef.current;

    // 1. Erişim jetonunu ilk açılışta ver
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        if (data?.session?.access_token) {
          supabase.realtime.setAuth(data.session.access_token);
        }
      })
      .catch((err: unknown) => {
        // Jeton verilemezse özel kanal açılamaz (fail-closed); bu sessiz
        // kalmaz — durum hatayı taşır ve kaydediciye gider (2026-10-12'ye
        // kadar boş bir catch'ti).
        if (!active) return;
        const failure =
          err instanceof Error ? err : new Error("Oturum okunamadı");
        setError(failure);
        reportError("error", failure);
      });

    // 2. Jeton yenilendiğinde Realtime bağlantısına yeni jetonu ilet
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!active) return;
        if (session?.access_token) {
          supabase.realtime.setAuth(session.access_token);
        }
      }
    );

    // 3. Özel kurum kanalını aç
    const channel = supabase.channel(`org:${organizationId}`, {
      config: { private: true },
    });

    // 4. Değişiklik bildirimini dinle
    channel.on("broadcast", { event: "change" }, message => {
      if (!active) return;

      const payload = message?.payload as RealtimeChangePayload | undefined;
      const table = payload?.table ?? (message as { table?: unknown })?.table;
      if (!table || typeof table !== "string") {
        return;
      }

      // Tabloyu biriktir ve 300 ms debounce penceresi başlat
      pendingTables.add(table);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        if (!active) return;

        const tables = Array.from(pendingTables);
        pendingTables.clear();

        // İlgili sorgu anahtarlarını topla ve tekilleştir
        const uniqueQueryKeys = new Map<string, readonly unknown[]>();
        for (const tbl of tables) {
          const affected = getAffectedQueryKeys(tbl, organizationId);
          for (const key of affected) {
            uniqueQueryKeys.set(JSON.stringify(key), key);
          }
        }

        // ⛔ setQueryData çağrılmaz — yalnızca invalidateQueries ile dürtülür
        for (const queryKey of uniqueQueryKeys.values()) {
          queryClient.invalidateQueries({ queryKey });
        }
      }, REALTIME_BATCH_DEBOUNCE_MS);
    });

    // 5. Kanala abone ol ve bağlantı durumunu izle
    channel.subscribe((subStatus, err) => {
      if (!active) return;

      if (subStatus === "SUBSCRIBED") {
        setChannelStatus("SUBSCRIBED");
        setError(null);

        // Bağlantı koptuktan sonra geri geldiyse: aradaki kaçan mesajları telafi etmek
        // için tüm eğitim sorguları tek seferlik toptan tazelenir (K-22).
        if (hadDisconnectedRef.current) {
          queryClient.invalidateQueries({ queryKey: educationKeys.all });
          hadDisconnectedRef.current = false;
        }

        wasConnectedRef.current = true;
      } else if (
        subStatus === "TIMED_OUT" ||
        subStatus === "CLOSED" ||
        subStatus === "CHANNEL_ERROR"
      ) {
        setChannelStatus(subStatus);
        if (err) {
          setError(err);
        }
        if (wasConnectedRef.current) {
          hadDisconnectedRef.current = true;
        }
      }
    });

    // 6. Temizlik (<StrictMode> ve unmount)
    return () => {
      active = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      pendingTables.clear();
      authListener.subscription.unsubscribe();
      supabase.removeChannel(channel);
      setChannelStatus(null);
      setError(null);
    };
  }, [isEnabled, organizationId, queryClient]);

  return {
    status,
    isConnected: status === "SUBSCRIBED",
    error,
  };
}
