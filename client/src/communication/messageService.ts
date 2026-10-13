import { supabase } from "@/lib/supabaseClient";
import { userFacingErrorText } from "@/lib/userFacingError";

/**
 * Birebir mesajlaşma (2026-10-12, göç 20261031000000).
 *
 * Kim kime yazabilir kuralı ve gizlilik veritabanında: bir konuşmayı yalnız
 * iki tarafı görür (yönetici başkalarının yazışmasını okuyamaz), yazma yalnız
 * fonksiyonlardan geçer ve kural her mesajda yeniden denetlenir. Buradaki
 * hiçbir kontrol güvenlik sınırı değildir.
 */

export type MessageRole = "admin" | "teacher" | "student" | "parent";

export type MessageContact = {
  membershipId: string;
  displayName: string;
  role: MessageRole;
  detail: string | null;
};

export type ConversationSummary = {
  id: string;
  otherMembershipId: string;
  otherName: string;
  otherRole: MessageRole;
  lastMessage: string | null;
  lastMessageAt: string | null;
  lastFromMe: boolean;
  unread: boolean;
};

export type ChatMessage = {
  id: string;
  senderMembershipId: string;
  body: string;
  createdAt: string;
};

export const MESSAGE_MAX = 2000;
const MESSAGE_PAGE = 200;

export const ROLE_LABEL: Record<MessageRole, string> = {
  admin: "Yönetim",
  teacher: "Öğretmen",
  student: "Öğrenci",
  parent: "Veli",
};

export function translateMessageError(error: unknown): string {
  // Veritabanı kuralları Türkçe cümleyle döner ("Bu kişiye mesaj
  // gönderemezsiniz.", "Çok hızlı mesaj gönderiyorsunuz…").
  return userFacingErrorText(error) ?? "Mesaj işlemi yapılamadı.";
}

export async function loadMessageContacts(): Promise<MessageContact[]> {
  const { data, error } = await supabase.rpc("list_message_contacts");
  if (error) throw new Error(translateMessageError(error));
  return (
    (data ?? []) as {
      membership_id: string;
      display_name: string;
      role: MessageRole;
      detail: string | null;
    }[]
  ).map(row => ({
    membershipId: row.membership_id,
    displayName: row.display_name,
    role: row.role,
    detail: row.detail,
  }));
}

export async function loadConversations(): Promise<ConversationSummary[]> {
  const { data, error } = await supabase.rpc("list_conversations");
  if (error) throw new Error(translateMessageError(error));
  return (
    (data ?? []) as {
      conversation_id: string;
      other_membership_id: string;
      other_name: string;
      other_role: MessageRole;
      last_message: string | null;
      last_message_at: string | null;
      last_from_me: boolean | null;
      unread: boolean | null;
    }[]
  ).map(row => ({
    id: row.conversation_id,
    otherMembershipId: row.other_membership_id,
    otherName: row.other_name,
    otherRole: row.other_role,
    lastMessage: row.last_message,
    lastMessageAt: row.last_message_at,
    lastFromMe: Boolean(row.last_from_me),
    unread: Boolean(row.unread),
  }));
}

/** Son 200 mesaj, eskiden yeniye. */
export async function loadMessages(
  conversationId: string
): Promise<{ rows: ChatMessage[]; truncated: boolean }> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, sender_membership_id, body, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(MESSAGE_PAGE);
  if (error) throw new Error(translateMessageError(error));
  const rows = (
    (data ?? []) as {
      id: string;
      sender_membership_id: string;
      body: string;
      created_at: string;
    }[]
  )
    .map(row => ({
      id: row.id,
      senderMembershipId: row.sender_membership_id,
      body: row.body,
      createdAt: row.created_at,
    }))
    .reverse();
  return { rows, truncated: rows.length >= MESSAGE_PAGE };
}

export async function startConversation(
  targetMembershipId: string
): Promise<string> {
  const { data, error } = await supabase.rpc("start_conversation", {
    target_membership_id: targetMembershipId,
  });
  if (error) throw new Error(translateMessageError(error));
  return data as string;
}

export async function sendMessage(
  conversationId: string,
  body: string
): Promise<void> {
  const { error } = await supabase.rpc("send_message", {
    target_conversation_id: conversationId,
    message_body: body,
  });
  if (error) throw new Error(translateMessageError(error));
}

export async function markConversationRead(
  conversationId: string
): Promise<void> {
  const { error } = await supabase.rpc("mark_conversation_read", {
    target_conversation_id: conversationId,
  });
  if (error) throw new Error(translateMessageError(error));
}
