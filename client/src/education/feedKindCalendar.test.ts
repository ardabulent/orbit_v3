import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildMonthDisplayEvents } from "@/components/education/pages/dayPlanHelpers";

const chain: Record<string, ReturnType<typeof vi.fn>> = {};
const fromMock = vi.fn();

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    from: (table: string) => fromMock(table),
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
  },
}));

import { createFeedPost, loadCalendarNotices } from "./feedService";

function zincir(sonuc: unknown) {
  for (const ad of [
    "select",
    "eq",
    "is",
    "not",
    "gte",
    "lte",
    "order",
    "insert",
  ]) {
    chain[ad] = vi.fn(() => chain);
  }
  chain.limit = vi.fn(() => Promise.resolve(sonuc));
  chain.single = vi.fn(() => Promise.resolve(sonuc));
  fromMock.mockImplementation(() => chain);
}

describe("duyuru türü ve günü (2026-09-30)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("yeni duyuru türü ve günüyle yazılır", async () => {
    zincir({
      data: {
        id: "p1",
        organization_id: "o",
        class_id: null,
        title: "TYT Deneme 3",
        body: null,
        author_membership_id: "m",
        created_at: "2026-09-30T10:00:00Z",
        updated_at: "2026-09-30T10:00:00Z",
        archived_at: null,
        audience: "all",
        pinned: false,
        kind: "exam",
        event_date: "2026-10-11",
        classes: null,
      },
      error: null,
    });

    const post = await createFeedPost({
      organizationId: "o",
      title: "TYT Deneme 3",
      kind: "exam",
      eventDate: "2026-10-11",
    });

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "exam", event_date: "2026-10-11" })
    );
    expect(post).toMatchObject({ kind: "exam", eventDate: "2026-10-11" });
  });

  it("takvim yalnız arşivsiz ve günü dolu duyuruları aralıkta okur", async () => {
    zincir({
      data: [
        {
          id: "p1",
          title: " Veli toplantısı ",
          kind: "meeting",
          event_date: "2026-10-03",
          classes: { id: "c", name: "12-A" },
        },
        {
          id: "p2",
          title: "Bozuk tür",
          kind: "xyz",
          event_date: "2026-10-04",
          classes: null,
        },
      ],
      error: null,
    });

    const notices = await loadCalendarNotices("o", "2026-08-01", "2027-03-29");

    expect(chain.is).toHaveBeenCalledWith("archived_at", null);
    expect(chain.not).toHaveBeenCalledWith("event_date", "is", null);
    expect(chain.gte).toHaveBeenCalledWith("event_date", "2026-08-01");
    expect(chain.lte).toHaveBeenCalledWith("event_date", "2027-03-29");
    expect(notices).toEqual([
      {
        id: "p1",
        title: "Veli toplantısı",
        kind: "meeting",
        eventDate: "2026-10-03",
        className: "12-A",
      },
      // Bilinmeyen tür "Genel" sayılır, uydurulmaz.
      {
        id: "p2",
        title: "Bozuk tür",
        kind: "general",
        eventDate: "2026-10-04",
        className: null,
      },
    ]);
  });

  it("takvim tarihli duyuruyu kendi gününe koyar, görünmeyen ayı atlar", () => {
    const events = buildMonthDisplayEvents(
      new Date(2026, 9, 1),
      [],
      [],
      [],
      [
        {
          id: "n1",
          title: "Veli toplantısı",
          kind: "meeting",
          eventDate: "2026-10-03",
          className: null,
        },
        {
          id: "n2",
          title: "Uzak",
          kind: "event",
          eventDate: "2027-01-10",
          className: null,
        },
      ]
    );
    const duyurular = events.filter(e => e.noticeKind);
    expect(duyurular).toHaveLength(1);
    expect(duyurular[0]).toMatchObject({
      id: "notice-n1",
      date: "2026-10-03",
      noticeKind: "meeting",
    });
  });
});
