import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { NotebookPen } from "lucide-react";
import { useAuth } from "@/auth/useAuth";
import {
  archiveFollowupNote,
  createFollowupNote,
  NOTE_KIND_LABELS,
  updateFollowupNote,
  type FollowupNote,
} from "@/education/followupNoteService";
import { educationKeys } from "@/education/queries/educationKeys";
import { useFollowupNotes } from "@/education/queries/trackingQueries";
import { formatTrDate } from "@/education/trDate";
import { FollowupNoteForm } from "./FollowupNoteForm";

/**
 * Not ve görüşme kaydı (4.10c). Liste yazar adıyla gelir
 * (`student_followup_notes_list`); düzelt ve arşivle düğmeleri `canEdit`'e
 * göre görünür — yetkinin kendisi RLS'te. Arşivleme tarayıcı penceresi
 * açmadan, satır içinde onaylanır.
 */
export function FollowupNotes({ studentId }: { studentId: string }) {
  const { identity } = useAuth();
  const organizationId = identity?.membership?.organizationId ?? "";
  const queryClient = useQueryClient();
  const query = useFollowupNotes(studentId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: educationKeys.followupNotes(organizationId, studentId),
    });

  const archive = async (note: FollowupNote) => {
    setActionError(null);
    try {
      await archiveFollowupNote(note.id);
      setConfirmingId(null);
      await refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Arşivlenemedi.");
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-slate-100 p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
        <NotebookPen className="h-3.5 w-3.5" aria-hidden /> Notlar ve görüşmeler
      </p>

      <div className="mt-2">
        <FollowupNoteForm
          submitLabel="Not ekle"
          onSubmit={async input => {
            await createFollowupNote(organizationId, studentId, input);
            await refresh();
          }}
        />
      </div>

      {query.isPending ? (
        <p role="status" className="mt-3 text-[12px] text-slate-400">
          Notlar yükleniyor…
        </p>
      ) : query.isError ? (
        <p role="alert" className="mt-3 text-[12px] text-rose-600">
          Notlar alınamadı: {query.error.message}
        </p>
      ) : query.data.length === 0 ? (
        <p className="mt-3 text-[12px] text-slate-500">Henüz not yok.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {query.data.map(note => (
            <li key={note.id} className="py-2.5">
              {editingId === note.id ? (
                <FollowupNoteForm
                  initial={{
                    kind: note.kind,
                    occurredOn: note.occurredOn,
                    body: note.body,
                  }}
                  submitLabel="Kaydet"
                  onCancel={() => setEditingId(null)}
                  onSubmit={async input => {
                    await updateFollowupNote(note.id, input);
                    setEditingId(null);
                    await refresh();
                  }}
                />
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-bold text-slate-700">
                      {NOTE_KIND_LABELS[note.kind]}
                    </span>
                    <span>{formatTrDate(note.occurredOn)}</span>
                    <span>· {note.isMine ? "Siz" : note.authorName}</span>
                    {note.canEdit ? (
                      <span className="ml-auto flex gap-2">
                        {confirmingId === note.id ? (
                          <>
                            <span className="font-bold text-rose-700">
                              Arşivlensin mi?
                            </span>
                            <button
                              type="button"
                              onClick={() => void archive(note)}
                              className="font-bold text-rose-700 hover:underline"
                            >
                              Evet
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmingId(null)}
                              className="font-bold text-slate-600 hover:underline"
                            >
                              Vazgeç
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setEditingId(note.id)}
                              className="font-bold text-slate-600 hover:underline"
                            >
                              Düzelt
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmingId(note.id)}
                              className="font-bold text-slate-600 hover:underline"
                            >
                              Arşivle
                            </button>
                          </>
                        )}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 whitespace-pre-line text-[12px] text-slate-800">
                    {note.body}
                  </p>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {actionError ? (
        <p role="alert" className="mt-2 text-[11px] font-bold text-rose-600">
          {actionError}
        </p>
      ) : null}
    </div>
  );
}
