import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, PenSquare, Search, Send } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/auth/useAuth";
import {
  communicationKeys,
  useConversations,
  useMessageContacts,
  useMessages,
} from "@/communication/communicationQueries";
import {
  markConversationRead,
  MESSAGE_MAX,
  ROLE_LABEL,
  sendMessage,
  startConversation,
  type ConversationSummary,
} from "@/communication/messageService";
import { CardSkeleton, EmptyState, ErrorState } from "../shared";

function shortTime(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const today = new Date();
  return date.toDateString() === today.toDateString()
    ? date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

/**
 * Birebir mesajlar (2026-10-12). Kim kime yazabileceğini veritabanı söyler
 * (`list_message_contacts`); bu ekran yalnız o listeyi gösterir.
 */
export function MessagesSection() {
  const { identity } = useAuth();
  const myMembershipId = identity?.membership?.membershipId ?? "";
  const queryClient = useQueryClient();
  const conversations = useConversations();
  const [selected, setSelected] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [pendingContact, setPendingContact] = useState<{
    membershipId: string;
    name: string;
  } | null>(null);

  const rows = conversations.data ?? [];
  const current = rows.find(c => c.id === selected) ?? null;

  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: communicationKeys.all }),
    [queryClient]
  );

  return (
    <div className="grid min-h-[520px] gap-4 lg:grid-cols-[minmax(260px,.8fr)_1.2fr]">
      <section
        className={`rounded-2xl border border-slate-200 bg-white ${
          selected || picking ? "hidden lg:block" : ""
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <p className="text-[13px] font-extrabold text-slate-900">Mesajlar</p>
          <button
            type="button"
            onClick={() => {
              setPicking(true);
              setSelected(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-slate-800"
          >
            <PenSquare className="h-3.5 w-3.5" aria-hidden />
            Yeni mesaj
          </button>
        </div>
        {conversations.isLoading ? (
          <div className="p-4">
            <CardSkeleton />
          </div>
        ) : conversations.error ? (
          <div className="p-4">
            <ErrorState
              title="Mesajlar yüklenemedi"
              message={conversations.error.message}
              onRetry={() => void conversations.refetch()}
            />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="Henüz mesajınız yok"
              description="“Yeni mesaj” ile yazabileceğiniz kişileri görün."
            />
          </div>
        ) : (
          <ul className="divide-y divide-slate-50">
            {rows.map(item => (
              <ConversationRow
                key={item.id}
                item={item}
                selected={item.id === selected}
                onOpen={() => {
                  setPicking(false);
                  setPendingContact(null);
                  setSelected(item.id);
                }}
              />
            ))}
          </ul>
        )}
      </section>

      <section
        className={`rounded-2xl border border-slate-200 bg-white ${
          selected || picking || pendingContact ? "" : "hidden lg:block"
        }`}
      >
        {picking ? (
          <ContactPicker
            onBack={() => setPicking(false)}
            onPick={contact => {
              setPicking(false);
              const existing = rows.find(
                c => c.otherMembershipId === contact.membershipId
              );
              if (existing) {
                setSelected(existing.id);
              } else {
                setSelected(null);
                setPendingContact(contact);
              }
            }}
          />
        ) : current || pendingContact ? (
          <Thread
            key={current?.id ?? pendingContact?.membershipId}
            conversation={current}
            pendingContact={pendingContact}
            myMembershipId={myMembershipId}
            onBack={() => {
              setSelected(null);
              setPendingContact(null);
            }}
            onStarted={async conversationId => {
              setPendingContact(null);
              setSelected(conversationId);
              await refresh();
            }}
            onChanged={refresh}
          />
        ) : (
          <div className="grid h-full place-items-center p-8">
            <EmptyState
              title="Bir yazışma seçin"
              description="Soldan bir yazışma açın ya da yeni mesaj başlatın."
            />
          </div>
        )}
      </section>
    </div>
  );
}

function ConversationRow({
  item,
  selected,
  onOpen,
}: {
  item: ConversationSummary;
  selected: boolean;
  onOpen: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50 ${
          selected ? "bg-slate-50" : ""
        }`}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-900 text-[11px] font-extrabold text-white">
          {item.otherName
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map(w => w[0])
            .join("")}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span
              className={`truncate text-[13px] ${item.unread ? "font-extrabold text-slate-900" : "font-bold text-slate-700"}`}
            >
              {item.otherName}
            </span>
            <span className="shrink-0 text-[10px] text-slate-400">
              {shortTime(item.lastMessageAt)}
            </span>
          </span>
          <span className="block text-[10px] text-slate-400">
            {ROLE_LABEL[item.otherRole]}
          </span>
          <span
            className={`mt-0.5 block truncate text-[12px] ${item.unread ? "font-bold text-slate-800" : "text-slate-500"}`}
          >
            {item.lastFromMe ? "Siz: " : ""}
            {item.lastMessage}
          </span>
        </span>
        {item.unread ? (
          <span
            aria-label="Okunmamış"
            className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-600"
          />
        ) : null}
      </button>
    </li>
  );
}

function ContactPicker({
  onBack,
  onPick,
}: {
  onBack: () => void;
  onPick: (contact: { membershipId: string; name: string }) => void;
}) {
  const contacts = useMessageContacts();
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("tr");
    return (contacts.data ?? []).filter(
      c =>
        !needle ||
        `${c.displayName} ${c.detail ?? ""}`
          .toLocaleLowerCase("tr")
          .includes(needle)
    );
  }, [contacts.data, search]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Geri"
          className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <p className="text-[13px] font-extrabold text-slate-900">
          Kime yazmak istiyorsunuz?
        </p>
      </div>
      <label className="relative mx-4 mt-3 block">
        <span className="sr-only">Kişi ara</span>
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Ad ya da sınıf"
          className="h-9 w-full rounded-lg border border-slate-200 pl-8 pr-3 text-[13px] outline-none focus:border-slate-400"
        />
      </label>
      {contacts.isLoading ? (
        <div className="p-4">
          <CardSkeleton />
        </div>
      ) : contacts.error ? (
        <div className="p-4">
          <ErrorState
            title="Kişiler yüklenemedi"
            message={contacts.error.message}
            onRetry={() => void contacts.refetch()}
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-4">
          <EmptyState
            title={search ? "Eşleşen kişi yok" : "Yazabileceğiniz kişi yok"}
            description="Öğretmenler yalnız okuttukları sınıfların öğrencilerine ve velilerine yazabilir."
          />
        </div>
      ) : (
        <ul className="mt-2 max-h-[440px] divide-y divide-slate-50 overflow-y-auto">
          {filtered.map(contact => (
            <li key={contact.membershipId}>
              <button
                type="button"
                onClick={() =>
                  onPick({
                    membershipId: contact.membershipId,
                    name: contact.displayName,
                  })
                }
                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-bold text-slate-800">
                    {contact.displayName}
                  </span>
                  <span className="block truncate text-[11px] text-slate-500">
                    {[ROLE_LABEL[contact.role], contact.detail]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Thread({
  conversation,
  pendingContact,
  myMembershipId,
  onBack,
  onStarted,
  onChanged,
}: {
  conversation: ConversationSummary | null;
  pendingContact: { membershipId: string; name: string } | null;
  myMembershipId: string;
  onBack: () => void;
  onStarted: (conversationId: string) => Promise<void>;
  onChanged: () => Promise<unknown>;
}) {
  const messages = useMessages(conversation?.id ?? null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const name = conversation?.otherName ?? pendingContact?.name ?? "";

  // Açılınca ve yeni mesaj gelince okundu işaretlenir.
  const unread = conversation?.unread ?? false;
  const conversationId = conversation?.id;
  useEffect(() => {
    if (!conversationId || !unread) return;
    markConversationRead(conversationId)
      .then(onChanged)
      .catch((err: unknown) => {
        toast.error("Okundu bilgisi kaydedilemedi", {
          description: err instanceof Error ? err.message : undefined,
        });
      });
  }, [conversationId, unread, onChanged]);

  const count = messages.data?.rows.length ?? 0;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [count]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    try {
      let id = conversation?.id;
      if (!id && pendingContact) {
        id = await startConversation(pendingContact.membershipId);
      }
      if (!id) return;
      await sendMessage(id, body);
      setDraft("");
      if (!conversation) await onStarted(id);
      else await onChanged();
    } catch (err: unknown) {
      toast.error("Mesaj gönderilemedi", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full min-h-[520px] flex-col">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Yazışmalara dön"
          className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-extrabold text-slate-900">
            {name}
          </p>
          {conversation ? (
            <p className="text-[10px] text-slate-400">
              {ROLE_LABEL[conversation.otherRole]}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {!conversation ? (
          <p className="text-center text-[12px] text-slate-400">
            İlk mesajınızı yazın.
          </p>
        ) : messages.isLoading ? (
          <CardSkeleton />
        ) : messages.error ? (
          <ErrorState
            title="Mesajlar yüklenemedi"
            message={messages.error.message}
            onRetry={() => void messages.refetch()}
          />
        ) : (
          <>
            {messages.data?.truncated ? (
              <p className="text-center text-[11px] text-slate-400">
                Son 200 mesaj gösteriliyor.
              </p>
            ) : null}
            {messages.data?.rows.map(msg => {
              const mine = msg.senderMembershipId === myMembershipId;
              return (
                <div
                  key={msg.id}
                  className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-[13px] leading-5 ${
                    mine
                      ? "ml-auto rounded-tr-sm bg-blue-600 text-white"
                      : "rounded-tl-sm bg-slate-100 text-slate-800"
                  }`}
                >
                  {msg.body}
                  <span
                    className={`mt-1 block text-right text-[10px] ${mine ? "text-blue-100" : "text-slate-400"}`}
                  >
                    {shortTime(msg.createdAt)}
                  </span>
                </div>
              );
            })}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="border-t border-slate-100 p-3">
        <label className="sr-only" htmlFor="message-draft">
          Mesaj
        </label>
        <textarea
          id="message-draft"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(e);
            }
          }}
          maxLength={MESSAGE_MAX}
          rows={2}
          placeholder="Mesajınızı yazın… (Enter gönderir, Shift+Enter yeni satır)"
          className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-[13px] outline-none focus:border-blue-400 focus:bg-white"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-slate-400">
            {draft.length}/{MESSAGE_MAX}
          </span>
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-[12px] font-bold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" aria-hidden />
            {sending ? "Gönderiliyor…" : "Gönder"}
          </button>
        </div>
      </form>
    </div>
  );
}
