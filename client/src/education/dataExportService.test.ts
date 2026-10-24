import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "@/lib/supabaseClient";
import {
  buildExportFiles,
  exportPhone,
  mapAttendance,
  mapExamResults,
  mapGuardians,
  mapPayments,
  mapStudents,
  prepareDataExport,
} from "./dataExportService";

vi.mock("@/lib/supabaseClient", () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

/** `.select().eq().is()…order().range()` zincirini taklit eder. */
function chainReturning(pages: unknown[][]) {
  let call = 0;
  const calls: { method: string; args: unknown[] }[] = [];
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is", "order"]) {
    chain[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return chain;
    };
  }
  chain.range = (...args: unknown[]) => {
    calls.push({ method: "range", args });
    return Promise.resolve({ data: pages[call++] ?? [], error: null });
  };
  return { chain, calls };
}

describe("dataExportService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("öğrenci: sınıflar ve veliler yalnız aktif bağlardan, arşivdeki öğrenci 'Arşivde'", () => {
    const table = mapStudents([
      {
        id: "s2",
        full_name: "Zeynep Ak",
        student_number: "102",
        auth_user_id: null,
        archived_at: "2026-10-01T00:00:00Z",
        created_at: "2026-09-01T08:00:00Z",
        branches: null,
        class_enrollments: [],
        student_guardians: [],
      },
      {
        id: "s1",
        full_name: "Çağrı Işık",
        student_number: "101",
        auth_user_id: "u1",
        archived_at: null,
        created_at: "2026-09-02T08:00:00Z",
        branches: { name: "Kadıköy" },
        class_enrollments: [
          { archived_at: null, classes: { name: "12-A", archived_at: null } },
          {
            archived_at: "2026-09-10",
            classes: { name: "Eski", archived_at: null },
          },
        ],
        student_guardians: [
          {
            archived_at: null,
            guardians: { full_name: "Ayşe Işık", archived_at: null },
          },
          {
            archived_at: "2026-09-10",
            guardians: { full_name: "Kopuk Veli", archived_at: null },
          },
        ],
      },
    ]);
    expect(table.rows).toEqual([
      [
        "101",
        "Çağrı Işık",
        "Kadıköy",
        "12-A",
        "Ayşe Işık",
        "Var",
        "Aktif",
        "2026-09-02",
      ],
      ["102", "Zeynep Ak", null, null, null, "Yok", "Arşivde", "2026-09-01"],
    ]);
  });

  it("veli: telefon ve aktif çocuklar", () => {
    const table = mapGuardians([
      {
        id: "g1",
        full_name: "Ayşe Işık",
        phone: "+90 532 111 22 33",
        auth_user_id: null,
        archived_at: null,
        created_at: "2026-09-02T08:00:00Z",
        student_guardians: [
          {
            archived_at: null,
            students: { full_name: "Çağrı Işık", archived_at: null },
          },
          {
            archived_at: null,
            students: { full_name: "Arşivli Çocuk", archived_at: "2026-10-01" },
          },
        ],
      },
    ]);
    expect(table.rows[0]).toEqual([
      "Ayşe Işık",
      "0532 111 22 33",
      "Çağrı Işık",
      "Yok",
      "Aktif",
      "2026-09-02",
    ]);
  });

  it("tarihler Türkiye günüdür, UTC değil: 21:30Z ertesi gün sayılır", () => {
    const table = mapGuardians([
      {
        id: "g1",
        full_name: "Gece Kaydı",
        phone: null,
        auth_user_id: null,
        archived_at: null,
        created_at: "2026-09-02T21:30:00Z",
        student_guardians: [],
      },
    ]);
    expect(table.rows[0][5]).toBe("2026-09-03");
  });

  it("telefon: Türkiye numarası yerel biçimde, yabancı olduğu gibi", () => {
    expect(exportPhone("+90 532 111 22 33")).toBe("0532 111 22 33");
    expect(exportPhone("+905321112233")).toBe("05321112233");
    expect(exportPhone("+49 30 1234567")).toBe("+49 30 1234567");
    expect(exportPhone(null)).toBeNull();
  });

  it("yoklama: Türkçe durum, tarihe göre sıralı", () => {
    const table = mapAttendance([
      {
        id: "r2",
        status: "absent",
        attendance_sessions: {
          session_date: "2026-10-21",
          starts_at: "09:00:00",
          classes: { name: "12-A" },
          subjects: null,
        },
        students: { full_name: "Çağrı Işık", student_number: "101" },
      },
      {
        id: "r1",
        status: "late",
        attendance_sessions: {
          session_date: "2026-10-20",
          starts_at: "10:40:00",
          classes: { name: "12-A" },
          subjects: { name: "Fizik" },
        },
        students: { full_name: "Çağrı Işık", student_number: "101" },
      },
    ]);
    expect(table.rows).toEqual([
      [
        "2026-10-20",
        "10:40",
        "12-A",
        "Fizik",
        "101",
        "Çağrı Işık",
        "Geç kaldı",
      ],
      ["2026-10-21", "09:00", "12-A", null, "101", "Çağrı Işık", "Gelmedi"],
    ]);
  });

  it("sınav: netli denemede 'Net' ve tam puan boş; kapsam yazılır", () => {
    const table = mapExamResults([
      {
        id: "e1",
        score: "57.75",
        exams: {
          name: "TYT 1",
          exam_date: "2026-10-15",
          max_score: null,
          net_penalty: 4,
          class_id: null,
          branch_id: null,
          classes: null,
          branches: null,
        },
        students: { full_name: "Çağrı Işık", student_number: "101" },
      },
      {
        id: "e2",
        score: 80,
        exams: {
          name: "Yazılı",
          exam_date: "2026-10-16",
          max_score: 100,
          net_penalty: null,
          class_id: null,
          branch_id: "b1",
          classes: null,
          branches: { name: "Kadıköy" },
        },
        students: { full_name: "Çağrı Işık", student_number: "101" },
      },
    ]);
    expect(table.rows).toEqual([
      [
        "2026-10-15",
        "TYT 1",
        "Kurum geneli",
        "101",
        "Çağrı Işık",
        57.75,
        "Net",
        null,
      ],
      [
        "2026-10-16",
        "Yazılı",
        "Kadıköy şubesi",
        "101",
        "Çağrı Işık",
        80,
        "Puan",
        100,
      ],
    ]);
  });

  it("ödeme: Ödendi / Gecikti / Bekliyor bugüne göre", () => {
    const plan = {
      name: "2026 Kayıt",
      total_amount: "30000",
      students: { full_name: "Çağrı Işık", student_number: "101" },
    };
    const table = mapPayments(
      [
        {
          id: "i3",
          sequence_no: 3,
          due_date: "2026-11-01",
          amount: "10000",
          paid_at: null,
          payment_plans: plan,
        },
        {
          id: "i1",
          sequence_no: 1,
          due_date: "2026-09-01",
          amount: "10000",
          paid_at: "2026-09-01T10:00:00Z",
          payment_plans: plan,
        },
        {
          id: "i2",
          sequence_no: 2,
          due_date: "2026-10-01",
          amount: "10000",
          paid_at: null,
          payment_plans: plan,
        },
      ],
      "2026-10-24"
    );
    expect(table.rows.map(r => [r[4], r[7], r[8]])).toEqual([
      [1, "2026-09-01", "Ödendi"],
      [2, null, "Gecikti"],
      [3, null, "Bekliyor"],
    ]);
  });

  it("CSV: küme başına bir dosya; Excel: tek dosya", () => {
    const tables = [mapGuardians([]), mapStudents([])];
    expect(
      buildExportFiles(tables, "csv", "2026-10-24").map(f => f.name)
    ).toEqual([
      "orbit-veliler-2026-10-24.csv",
      "orbit-ogrenciler-2026-10-24.csv",
    ]);
    expect(
      buildExportFiles(tables, "xlsx", "2026-10-24").map(f => f.name)
    ).toEqual(["orbit-kurum-verisi-2026-10-24.xlsx"]);
  });

  it("önce iz: kayıt yazılamazsa dosya verilmez", async () => {
    const { chain } = chainReturning([[]]);
    vi.mocked(supabase.from).mockReturnValue(chain as never);
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { code: "42501", message: "yetki yok" },
    } as never);

    await expect(
      prepareDataExport("org-1", ["guardians"], "xlsx", undefined, "2026-10-24")
    ).rejects.toThrow("kayda geçirilemediği için dosya verilmedi");
  });

  it("kayıt kimin hangi kümeyi kaç satır aldığını taşır; okuma kurum süzgeçli ve kimliğe göre sıralı", async () => {
    const { chain, calls } = chainReturning([
      [
        {
          id: "g1",
          full_name: "Ayşe Işık",
          phone: null,
          auth_user_id: null,
          archived_at: null,
          created_at: "2026-09-02T08:00:00Z",
          student_guardians: [],
        },
      ],
    ]);
    vi.mocked(supabase.from).mockReturnValue(chain as never);
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: 1,
      error: null,
    } as never);

    const result = await prepareDataExport(
      "org-1",
      ["guardians"],
      "csv",
      undefined,
      "2026-10-24"
    );

    expect(supabase.from).toHaveBeenCalledWith("guardians");
    expect(calls).toContainEqual({
      method: "eq",
      args: ["organization_id", "org-1"],
    });
    expect(calls).toContainEqual({
      method: "order",
      args: ["id", { ascending: true }],
    });
    expect(supabase.rpc).toHaveBeenCalledWith("record_data_export", {
      target_organization_id: "org-1",
      datasets: ["guardians"],
      row_counts: { guardians: 1 },
    });
    expect(result.files).toHaveLength(1);
  });

  it("ödeme okuması arşivlenmiş taksit ve planı dışarıda bırakır", async () => {
    const { chain, calls } = chainReturning([[]]);
    vi.mocked(supabase.from).mockReturnValue(chain as never);
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: 1,
      error: null,
    } as never);

    await prepareDataExport(
      "org-1",
      ["payments"],
      "csv",
      undefined,
      "2026-10-24"
    );

    expect(supabase.from).toHaveBeenCalledWith("installments");
    expect(calls).toContainEqual({ method: "is", args: ["archived_at", null] });
    expect(calls).toContainEqual({
      method: "is",
      args: ["payment_plans.archived_at", null],
    });
  });
});
