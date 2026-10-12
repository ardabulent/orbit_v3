import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/useAuth";
import { isDemoMode } from "@/auth/runtime";
import {
  loadConversations,
  loadMessageContacts,
  loadMessages,
} from "./messageService";
import { loadNotifications } from "./notificationService";

/**
 * Mesaj ve bildirim sorguları. Anahtarlar kullanıcıya özeldir (kurum değil):
 * kişiye özel kanal (`user:<id>`) dürtünce `communicationKeys.all` tazelenir.
 */
export const communicationKeys = {
  all: ["communication"] as const,
  notifications: (userId: string) =>
    ["communication", "notifications", { userId }] as const,
  conversations: (userId: string) =>
    ["communication", "conversations", { userId }] as const,
  messages: (conversationId: string) =>
    ["communication", "messages", { conversationId }] as const,
  contacts: (userId: string) =>
    ["communication", "contacts", { userId }] as const,
};

function useLiveUserId(): string | null {
  const { identity } = useAuth();
  if (isDemoMode || !identity?.membership) return null;
  return identity.userId;
}

export function useNotifications() {
  const userId = useLiveUserId();
  return useQuery({
    queryKey: communicationKeys.notifications(userId ?? ""),
    queryFn: loadNotifications,
    enabled: Boolean(userId),
  });
}

export function useConversations(options?: { enabled?: boolean }) {
  const userId = useLiveUserId();
  return useQuery({
    queryKey: communicationKeys.conversations(userId ?? ""),
    queryFn: loadConversations,
    enabled: Boolean(userId) && (options?.enabled ?? true),
  });
}

export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: communicationKeys.messages(conversationId ?? ""),
    queryFn: () => loadMessages(conversationId as string),
    enabled: Boolean(conversationId) && !isDemoMode,
  });
}

export function useMessageContacts(options?: { enabled?: boolean }) {
  const userId = useLiveUserId();
  return useQuery({
    queryKey: communicationKeys.contacts(userId ?? ""),
    queryFn: loadMessageContacts,
    enabled: Boolean(userId) && (options?.enabled ?? true),
    staleTime: 60_000,
  });
}
