import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "@/lib/supabaseClient";
import {
  archiveFollowupNote,
  createFollowupNote,
  loadFollowupNotes,
  validateNoteInput,
} from "./followupNoteService";

const query = {
  insert: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
};

vi.mock("@/lib/supabaseClient", () => ({
  supabase: { rpc: vi.fn(), from: vi.fn(() => query) },
}));

type RpcResult = Awaited<ReturnType<typeof supabase.rpc>>;

describe("followupNoteService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    query.update.mockReturnValue(query);
    query.eq.mockReturnValue(query);
  });

  it("notları liste fonksiyonundan okur, bilinmeyen türü atlar", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [
        {
          id: "n1",
          kind: "guardian_meeting",
          occurred_on: "2026-11-24",
          body: "Veliyle konuşuldu.",
          author_name: "Murat Şahin",
          is_mine: true,
          can_edit: true,
          created_at: "2026-11-24T10:00:00Z",
          updated_at: "2026-11-24T10:00:00Z",
        },
        { id: "n2", kind: "uydurma" },
      ],
      error: null,
    } as unknown as RpcResult);
    const notes = await loadFollowupNotes("s1");
    expect(supabase.rpc).toHaveBeenCalledWith("student_followup_notes_list", {
      p_student_id: "s1",
    });
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({
      kind: "guardian_meeting",
      authorName: "Murat Şahin",
      isMine: true,
      canEdit: true,
    });
  });

  it("not eklerken yazar göndermez ve metni kırpar", async () => {
    query.insert.mockResolvedValue({ error: null });
    await createFollowupNote("org-1", "s1", {
      kind: "observation",
      occurredOn: "2026-11-24",
      body: "  Derste dalgın.  ",
    });
    expect(query.insert).toHaveBeenCalledWith({
      organization_id: "org-1",
      student_id: "s1",
      kind: "observation",
      occurred_on: "2026-11-24",
      body: "Derste dalgın.",
    });
  });

  it("hiç satır güncellenmediyse sessiz geçmez", async () => {
    query.select.mockResolvedValue({ data: [], error: null });
    await expect(archiveFollowupNote("n1")).rejects.toThrow(
      "Bu notu yalnız yazan ya da yönetici değiştirebilir."
    );
  });

  it("girdiyi doğrular", () => {
    const base = {
      kind: "observation" as const,
      occurredOn: "2026-11-24",
      body: "Not",
    };
    expect(validateNoteInput(base, "2026-11-24")).toBeNull();
    expect(validateNoteInput({ ...base, body: "   " }, "2026-11-24")).toBe(
      "Not boş olamaz."
    );
    expect(
      validateNoteInput({ ...base, occurredOn: "2026-11-25" }, "2026-11-24")
    ).toBe("Görüşme tarihi bugünden ileri olamaz.");
    expect(
      validateNoteInput({ ...base, body: "x".repeat(2001) }, "2026-11-24")
    ).toBe("Not en fazla 2000 karakter olabilir.");
  });
});
