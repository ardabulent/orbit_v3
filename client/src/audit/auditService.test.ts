import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_AUDIT_LIMIT,
  describeAuditAction,
  describeAuditEntity,
  describeAuditField,
  formatAuditMoment,
  loadOrganizationAuditEvents,
  resolveAuditActor,
} from "./auditService";

const fromMock = vi.fn();
const rpcMock = vi.fn();

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    from: (table: string) => fromMock(table),
    rpc: (name: string, args: unknown) => rpcMock(name, args),
  },
}));

describe("resolveAuditActor", () => {
  // Bu dört durumun ayrı ayrı ölçülmesi K-09'un doğrudan karşılığı:
  // "okunamadı" ile "yok" aynı cevap değildir ve ekran ikisini
  // karıştırırsa kullanıcıya olmayan bir olgu bildirir.

  it("aktor kimligi hic yazilmamissa sistem kaydidir", () => {
    expect(resolveAuditActor(null, new Map())).toEqual({ kind: "system" });
  });

  it("isim sorgusu basarisizsa hicbir sey iddia edilmez", () => {
    // `null` harita = sorgu hata verdi. Bu durumda "kurum dışı" demek yalan
    // olurdu; kişi pekâlâ kurumun üyesi olabilir.
    expect(resolveAuditActor("user-1", null)).toEqual({ kind: "unresolved" });
  });

  it("sorgu basarili ama kimlik donmediyse aktor kurum disindadir", () => {
    // Bu bir tahmin değil: politika tam olarak kurumun üyelerini döndürüyor,
    // dolayısıyla dönmemesi üye olmadığı anlamına geliyor.
    expect(resolveAuditActor("user-1", new Map())).toEqual({ kind: "outside" });
  });

  it("isim cozulduyse uye olarak adiyla gorunur", () => {
    expect(
      resolveAuditActor("user-1", new Map([["user-1", "Merve Karaca"]]))
    ).toEqual({ kind: "member", name: "Merve Karaca" });
  });

  it("bos harita ile null harita ayni sonucu vermez", () => {
    // Bu ikisinin karışması, servisin `null` yerine boş harita döndürmesiyle
    // olurdu ve sonucu şu olurdu: isim sorgusu bir kez hata verdiğinde
    // kurumun bütün üyeleri "kurum dışı" diye listelenir.
    expect(resolveAuditActor("user-1", new Map())).not.toEqual(
      resolveAuditActor("user-1", null)
    );
  });
});

describe("describeAuditAction / describeAuditEntity", () => {
  it("bilinen eylemleri Turkcelestirir", () => {
    expect(describeAuditAction("membership.created")).toBe("Üye eklendi");
    expect(describeAuditEntity("organization")).toBe("Kurum");
    expect(describeAuditAction("student.created")).toBe("Öğrenci eklendi");
    expect(describeAuditAction("student.updated")).toBe("Öğrenci güncellendi");
    expect(describeAuditAction("student.archived")).toBe("Öğrenci arşivlendi");
    expect(describeAuditAction("student.restored")).toBe(
      "Öğrenci geri yüklendi"
    );
    expect(describeAuditAction("student.account_linked")).toBe(
      "Öğrenci hesabı bağlandı"
    );
    expect(describeAuditAction("student.account_unlinked")).toBe(
      "Öğrenci hesap bağı çözüldü"
    );
    expect(describeAuditAction("guardian.account_linked")).toBe(
      "Veli hesabı bağlandı"
    );
    expect(describeAuditAction("guardian.account_unlinked")).toBe(
      "Veli hesap bağı çözüldü"
    );
    expect(describeAuditAction("class.created")).toBe("Sınıf eklendi");
    expect(describeAuditAction("class.updated")).toBe("Sınıf güncellendi");
    expect(describeAuditAction("class.archived")).toBe("Sınıf arşivlendi");
    expect(describeAuditAction("class.restored")).toBe("Sınıf geri yüklendi");
    expect(describeAuditAction("class_enrollment.created")).toBe(
      "Sınıfa öğrenci kaydedildi"
    );
    expect(describeAuditAction("class_enrollment.archived")).toBe(
      "Öğrencinin sınıf kaydı sonlandırıldı"
    );
    expect(describeAuditAction("class_enrollment.restored")).toBe(
      "Öğrencinin sınıf kaydı geri yüklendi"
    );
    expect(describeAuditAction("attendance_session.created")).toBe(
      "Yoklama oturumu açıldı"
    );
    expect(describeAuditAction("attendance_session.updated")).toBe(
      "Yoklama oturumu güncellendi"
    );
    expect(describeAuditAction("attendance_session.archived")).toBe(
      "Yoklama oturumu arşivlendi"
    );
    expect(describeAuditAction("attendance_session.restored")).toBe(
      "Yoklama oturumu geri yüklendi"
    );
    expect(describeAuditAction("attendance_record.updated")).toBe(
      "Yoklama kaydı güncellendi"
    );
    expect(describeAuditAction("exam.created")).toBe("Sınav eklendi");
    expect(describeAuditAction("exam.updated")).toBe("Sınav güncellendi");
    expect(describeAuditAction("exam.archived")).toBe("Sınav arşivlendi");
    expect(describeAuditAction("exam.restored")).toBe("Sınav geri yüklendi");
    expect(describeAuditAction("exam_result.created")).toBe(
      "Sınav sonucu eklendi"
    );
    expect(describeAuditAction("exam_result.updated")).toBe(
      "Sınav sonucu güncellendi"
    );
    expect(describeAuditEntity("student")).toBe("Öğrenci");
    expect(describeAuditEntity("guardian")).toBe("Veli");
    expect(describeAuditEntity("class")).toBe("Sınıf");
    expect(describeAuditEntity("class_enrollment")).toBe("Sınıf Kaydı");
    expect(describeAuditEntity("attendance_session")).toBe("Yoklama Oturumu");
    expect(describeAuditEntity("attendance_record")).toBe("Yoklama Kaydı");
    expect(describeAuditEntity("exam")).toBe("Sınav");
    expect(describeAuditEntity("exam_result")).toBe("Sınav Sonucu");
  });

  it("⛔ attendance_record.created diye bir eylem yoktur ve etiket haritasında yer almaz (hacim kısıtı)", () => {
    // İlk toplu giriş bilerek denetlenmez (§4.12); etiket haritasında olmamalıdır.
    expect(describeAuditAction("attendance_record.created")).toBe(
      "attendance_record.created"
    );
  });

  it("bilinmeyen eylemde ham kodu gosterir, etiket uydurmaz", () => {
    // K-03. Edge Function'da yeni bir eylem yazıldığında burası
    // güncellenmezse ekran çirkin ama DOĞRU bir şey gösterir.
    expect(describeAuditAction("unknown.action")).toBe("unknown.action");
    expect(describeAuditEntity("unknown_entity")).toBe("unknown_entity");
  });
});

describe("formatAuditMoment", () => {
  it("gecerli tarihi okunur hale getirir", () => {
    expect(formatAuditMoment("2026-09-05T08:30:00Z")).toContain("2026");
  });

  it("cozulemeyen tarihte hicbir sey gostermez", () => {
    // K-03: "Invalid Date" veya "NaN" basmaktansa boş bırakılır.
    expect(formatAuditMoment("bozuk-tarih")).toBeNull();
  });
});

describe("loadOrganizationAuditEvents (v1.3-06 sayfalama sözleşmesi, 2026-09-29 fonksiyonla)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  type FeedRow = {
    id: number;
    actor_user_id: string | null;
    action: string;
    entity_type: string;
    entity_id: string | null;
    created_at: string;
    label: string | null;
    changed: string[] | null;
  };

  function setupFeed(options: { rows?: FeedRow[]; error?: Error | null }) {
    rpcMock.mockResolvedValue({
      data: options.error ? null : (options.rows ?? []),
      error: options.error ?? null,
    });
    fromMock.mockImplementation((table: string) => {
      if (table === "profiles") {
        const chain: Record<string, unknown> = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.in = vi.fn().mockResolvedValue({
          data: [{ id: "actor-1", display_name: "Ali Veli" }],
          error: null,
        });
        return chain;
      }
      throw new Error(`Beklenmeyen tablo: ${table}`);
    });
  }

  const row = (id: number): FeedRow => ({
    id,
    actor_user_id: "actor-1",
    action: "guardian.updated",
    entity_type: "guardian",
    entity_id: `id-${id}`,
    created_at: "2026-09-09T10:00:00Z",
    label: "Ayşe Koç",
    changed: ["phone"],
  });

  const lastArgs = () =>
    rpcMock.mock.calls[rpcMock.mock.calls.length - 1] as [
      string,
      Record<string, unknown>,
    ];

  it("⛔ denetim kaydı tablodan değil, metadata döndürmeyen fonksiyondan okunur", async () => {
    setupFeed({ rows: [] });

    await loadOrganizationAuditEvents("org-1", 50);

    expect(lastArgs()[0]).toBe("organization_audit_feed");
    expect(fromMock).not.toHaveBeenCalledWith("audit_events");
  });

  it("⛔ ilk sayfada imleç yoktur; ikinci sayfada imleç kayıt numarasıdır", async () => {
    setupFeed({ rows: [] });

    await loadOrganizationAuditEvents("org-1", 50);
    expect(lastArgs()[1].p_before_id).toBeNull();

    await loadOrganizationAuditEvents("org-1", 50, 105);
    expect(lastArgs()[1].p_before_id).toBe(105);
  });

  it("sunucudan limit + 1 satır istenir", async () => {
    setupFeed({ rows: [] });

    await loadOrganizationAuditEvents("org-1");
    expect(lastArgs()[1].p_limit).toBe(DEFAULT_AUDIT_LIMIT + 1);

    await loadOrganizationAuditEvents("org-1", 10);
    expect(lastArgs()[1].p_limit).toBe(11);
  });

  it("limit + 1 satır geldiğinde: dönen satır sayısı limit, nextCursor son satırın id'sidir", async () => {
    setupFeed({ rows: [60, 59, 58, 57, 56, 55].map(row) });

    const result = await loadOrganizationAuditEvents("org-1", 5);

    expect(result.rows).toHaveLength(5);
    expect(result.rows[0].id).toBe(60);
    expect(result.rows[4].id).toBe(56);
    expect(result.nextCursor).toBe(56);
  });

  it("⛔ limit kadar ya da daha az satır geldiğinde nextCursor null'dır ('burası gerçek son')", async () => {
    setupFeed({ rows: [50, 49, 48, 47, 46].map(row) });
    const exact = await loadOrganizationAuditEvents("org-1", 5);
    expect(exact.rows).toHaveLength(5);
    expect(exact.nextCursor).toBeNull();

    setupFeed({ rows: [] });
    const empty = await loadOrganizationAuditEvents("org-1", 5);
    expect(empty.rows).toHaveLength(0);
    expect(empty.nextCursor).toBeNull();
  });

  // ⛔ Güvenlik önlemi DEĞİL, dizin meselesi: kapsam RLS'ten gelir ama RLS
  // koşulu bir fonksiyon çağrısı olduğu için planlayıcı onu dizin koşuluna
  // çeviremiyor. Fonksiyon kurum kimliğini zorunlu parametre olarak alır.
  it("⛔ kurum kimliği AÇIKÇA gönderilir (dizin bunsuz kullanılamıyor)", async () => {
    setupFeed({ rows: [] });

    await loadOrganizationAuditEvents("org-42", 50);

    expect(lastArgs()[1].p_organization_id).toBe("org-42");
  });

  it("süzgeç sunucuya aynen gider; boş süzgeç null'dır", async () => {
    setupFeed({ rows: [] });

    await loadOrganizationAuditEvents("org-1", 50, null);
    expect(lastArgs()[1]).toMatchObject({
      p_actor_user_id: null,
      p_action_kind: null,
      p_entity_type: null,
      p_from: null,
      p_to: null,
    });

    await loadOrganizationAuditEvents("org-1", 50, null, {
      actorUserId: "actor-1",
      actionKind: "updated",
      entityType: "guardian",
      from: "2026-09-01",
      to: "2026-09-29",
    });
    expect(lastArgs()[1]).toMatchObject({
      p_actor_user_id: "actor-1",
      p_action_kind: "updated",
      p_entity_type: "guardian",
      p_from: "2026-09-01",
      p_to: "2026-09-29",
    });
  });

  it("kaydın adı ve değişen alan adları satıra geçer", async () => {
    setupFeed({ rows: [row(7), { ...row(6), label: null, changed: null }] });

    const result = await loadOrganizationAuditEvents("org-1", 50);

    expect(result.rows[0]).toMatchObject({
      label: "Ayşe Koç",
      changed: ["phone"],
      actor: { kind: "member", name: "Ali Veli" },
    });
    expect(result.rows[1].label).toBeNull();
    expect(result.rows[1].changed).toEqual([]);
  });

  it("veritabanı hatası durumunda hata fırlatır", async () => {
    setupFeed({ error: new Error("DB network fail") });

    await expect(loadOrganizationAuditEvents("org-1", 50)).rejects.toThrow(
      "Denetim kaydı yüklenemedi."
    );
  });
});

describe("describeAuditField ve yeni kayıt türleri (2026-09-29)", () => {
  it("değişen alan adları Türkçe; bilinmeyen ham kalır", () => {
    expect(describeAuditField("phone")).toBe("Telefon");
    expect(describeAuditField("paid_at")).toBe("Ödeme");
    expect(describeAuditField("bilinmeyen_alan")).toBe("bilinmeyen_alan");
  });

  it("taksit, ödeme planı, ödev, duyuru ve vekil artık ham kodla görünmez", () => {
    expect(describeAuditAction("installment.created")).toBe("Taksit eklendi");
    expect(describeAuditAction("payment_plan.archived")).toBe(
      "Ödeme Planı arşivlendi"
    );
    expect(describeAuditAction("homework.updated")).toBe("Ödev güncellendi");
    expect(describeAuditAction("feed_post.created")).toBe("Duyuru paylaşıldı");
    expect(describeAuditAction("substitute_assignment.created")).toBe(
      "Vekil Öğretmen eklendi"
    );
    expect(describeAuditEntity("installment")).toBe("Taksit");
  });
});
