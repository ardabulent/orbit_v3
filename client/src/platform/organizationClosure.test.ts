import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "@/lib/supabaseClient";
import { describeContent } from "./organizationContent";
import { platformActionDetail } from "./platformAuditLabels";
import {
  closeOrganization,
  loadOrganizationStats,
  purgeOrganization,
} from "./platformService";

vi.mock("@/lib/supabaseClient", () => ({
  supabase: { rpc: vi.fn() },
}));

const baseStats = {
  member_count: 36,
  admin_count: 1,
  branch_count: 2,
  audit_event_count: 214,
  student_count: 26,
  guardian_count: 7,
};

describe("kurum kapatma ve boşaltma (ana plan 2.5)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sayaç içerik haritasını ve kapanış anlarını taşır", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: {
        ...baseStats,
        content: { students: 26, exam_results: 11 },
        closed_at: "2026-09-23T22:00:00+00:00",
        purge_available_at: "2026-10-23T22:00:00+00:00",
      },
      error: null,
    } as never);

    const stats = await loadOrganizationStats("org-1");
    expect(stats?.content).toEqual({ students: 26, exam_results: 11 });
    expect(stats?.closedAt).toBe("2026-09-23T22:00:00+00:00");
    expect(stats?.purgeAvailableAt).toBe("2026-10-23T22:00:00+00:00");
  });

  it("içerik haritası bozuksa sayaç okunamadı sayılır (sıfır değil)", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { ...baseStats, content: { students: "çok" } },
      error: null,
    } as never);
    expect(await loadOrganizationStats("org-1")).toBeNull();

    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { ...baseStats },
      error: null,
    } as never);
    expect(await loadOrganizationStats("org-1")).toBeNull();
  });

  it("süresi dolmamış boşaltma, mümkün olacağı günü Türkiye saatiyle söyler", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { code: "ORB03", details: "2026-11-23 22:06:07+00" },
    } as never);

    await expect(purgeOrganization("org-1", 8931)).rejects.toThrow(
      /24 Kasım 2026 tarihinden sonra/
    );
  });

  it("yanlış kod ve kapatılmamış kurum kendi cümlesini alır", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { code: "22023" },
    } as never);
    await expect(purgeOrganization("org-1", 1)).rejects.toThrow(
      /kurum koduyla eşleşmiyor/
    );

    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { code: "ORB02" },
    } as never);
    await expect(purgeOrganization("org-1", 8931)).rejects.toThrow(
      /kapatılmadan boşaltılamaz/
    );
  });

  it("boşaltma kurum kodunu sunucuya onay olarak gönderir", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { deleted: { students: 26 }, deleted_total: 26 },
      error: null,
    } as never);

    const result = await purgeOrganization("org-1", 8931);
    expect(supabase.rpc).toHaveBeenCalledWith("platform_purge_organization", {
      target_organization_id: "org-1",
      confirmation_code: 8931,
    });
    expect(result).toEqual({ deleted: { students: 26 }, deletedTotal: 26 });
  });

  it("yetkisiz kapatma operatör cümlesiyle düşer", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { code: "42501" },
    } as never);
    await expect(closeOrganization("org-1")).rejects.toThrow(
      /platform operatörü yetkisi/
    );
  });

  it("içerik satırları Türkçe adla, çoktan aza; bilinmeyen tablo ham adla", () => {
    expect(
      describeContent({
        exam_results: 11,
        students: 26,
        yeni_tablo: 2,
        rooms: 0,
      })
    ).toEqual([
      { table: "students", label: "öğrenci", rows: 26 },
      { table: "exam_results", label: "sınav sonucu", rows: 11 },
      { table: "yeni_tablo", label: "yeni_tablo", rows: 2 },
    ]);
  });

  it("denetim kaydı boşaltmayı sayılarla ve kurum adıyla anlatır", () => {
    expect(
      platformActionDetail("platform.organization_purged", {
        organization_name: "Örnek Dershane",
        deleted: {
          students: 26,
          exam_results: 11,
          guardians: 7,
          rooms: 2,
          exams: 4,
        },
      })
    ).toBe(
      "Örnek Dershane: 50 içerik kaydı silindi (26 öğrenci, 11 sınav sonucu, 7 veli, 4 sınav, …)"
    );
  });
});
