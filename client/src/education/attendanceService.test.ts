import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  calculateAttendancePercentage,
  extractActiveName,
  formatSessionDateTime,
  formatSessionTitle,
  loadLatestAttendanceSession,
  loadStudentAttendancePercentages,
  mapSessionRow,
  openAttendanceSession,
  loadAttendanceSheet,
  saveAttendance,
  translateAttendanceError,
} from "./attendanceService";

const fromMock = vi.fn();
const rpcMock = vi.fn();

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    from: (table: string) => fromMock(table),
    rpc: (fn: string, args: unknown) => rpcMock(fn, args),
  },
}));

type QueryResult = { data: unknown; error: unknown };

function createQueryChain(
  result: QueryResult,
  spy?: {
    eqArgs?: [string, unknown][];
    isArgs?: [string, unknown];
    orderArgs?: [string, { ascending?: boolean; nullsFirst?: boolean }][];
    limitArg?: number;
    inArgs?: [string, unknown[]];
    insertArg?: unknown;
  }
) {
  const chain: Record<string, unknown> = {};
  if (spy && !spy.eqArgs) spy.eqArgs = [];

  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn((col: string, val: unknown) => {
    if (spy?.eqArgs) spy.eqArgs.push([col, val]);
    return chain;
  });
  chain.is = vi.fn((col: string, val: unknown) => {
    if (spy) spy.isArgs = [col, val];
    return chain;
  });
  chain.in = vi.fn((col: string, vals: unknown[]) => {
    if (spy) spy.inArgs = [col, vals];
    return chain;
  });
  chain.order = vi.fn(
    (col: string, opts: { ascending?: boolean; nullsFirst?: boolean }) => {
      if (spy) {
        if (!spy.orderArgs) spy.orderArgs = [];
        spy.orderArgs.push([col, opts]);
      }
      return chain;
    }
  );
  chain.limit = vi.fn((limit: number) => {
    if (spy) spy.limitArg = limit;
    return Promise.resolve(result);
  });
  chain.insert = vi.fn((payload: unknown) => {
    if (spy) spy.insertArg = payload;
    return chain;
  });
  chain.single = vi.fn().mockResolvedValue(result);
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  chain.then = (
    onFulfilled: (value: unknown) => unknown,
    onRejected?: (reason: unknown) => unknown
  ) => Promise.resolve(result).then(onFulfilled, onRejected);

  return chain;
}

describe("attendanceService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("calculateAttendancePercentage (Formül Doğruluğu & K-22)", () => {
    it("izinli ders payda ve paya katılmaz, geç kalma devam sayılır", () => {
      // (Katıldı: 8 + Geç kaldı: 2) / (Katıldı: 8 + Geç kaldı: 2 + Gelmedi: 2) = 10 / 12 = %83
      const percentage = calculateAttendancePercentage({
        present: 8,
        late: 2,
        absent: 2,
      });
      expect(percentage).toBe(83);
    });

    it("öğrenci tüm derslere katıldıysa %100 üretir", () => {
      expect(
        calculateAttendancePercentage({ present: 5, late: 0, absent: 0 })
      ).toBe(100);
    });

    it("öğrenci yalnızca geç kaldıysa %100 üretir (geç kalma devamdır)", () => {
      expect(
        calculateAttendancePercentage({ present: 0, late: 4, absent: 0 })
      ).toBe(100);
    });

    it("öğrenci hiçbir derse katılmadıysa %0 üretir (payda sıfır değil)", () => {
      expect(
        calculateAttendancePercentage({ present: 0, late: 0, absent: 3 })
      ).toBe(0);
    });

    it("payda sıfırken (hiç ders yok veya yalnız izinli) kesinlikle 0 DEĞİL undefined döner (K-22)", () => {
      // K-22: Yokluk etiketi de bir iddiadır. Payda 0 iken rozet çizilmez.
      expect(
        calculateAttendancePercentage({ present: 0, late: 0, absent: 0 })
      ).toBeUndefined();
    });
  });

  describe("formatSessionDateTime & formatSessionTitle", () => {
    it("tarih ve saat bilgisini Türkçe arayüz formatına çevirir", () => {
      expect(formatSessionDateTime("2026-09-08", "09:00:00")).toBe(
        "8 Eylül 2026, 09:00"
      );
      expect(formatSessionDateTime("2026-09-08")).toBe("8 Eylül 2026");
      expect(formatSessionDateTime("2026-01-15", "14:30:00")).toBe(
        "15 Ocak 2026, 14:30"
      );
    });

    it("ders yoklaması için tam başlık üretir", () => {
      const title = formatSessionTitle({
        id: "sess-1",
        classId: "cls-1",
        className: "YKS 12-A",
        subjectId: "sub-1",
        subjectName: "TYT Matematik",
        sessionDate: "2026-09-08",
        startsAt: "09:00",
        records: [],
      });
      expect(title).toBe("TYT Matematik · YKS 12-A · 8 Eylül 2026, 09:00");
    });

    it("günlük yoklamada (subjectId boş) Günlük Yoklama önekini kullanır", () => {
      const title = formatSessionTitle({
        id: "sess-2",
        classId: "cls-1",
        className: "11-B Sayısal",
        subjectId: null,
        subjectName: null,
        sessionDate: "2026-09-08",
        startsAt: null,
        records: [],
      });
      expect(title).toBe("Günlük Yoklama · 11-B Sayısal · 8 Eylül 2026");
    });
  });

  describe("extractActiveName", () => {
    it("aktif nesneden adı ayıklar", () => {
      expect(extractActiveName({ name: "Fizik", archived_at: null })).toBe(
        "Fizik"
      );
      expect(extractActiveName([{ name: "Kimya", archived_at: null }])).toBe(
        "Kimya"
      );
    });

    it("arşivlenmiş nesneyi dikkate almaz (null döner)", () => {
      expect(
        extractActiveName({
          name: "Eski Ders",
          archived_at: "2026-01-01T00:00:00Z",
        })
      ).toBeNull();
    });

    it("boş veya tanımsız değerde null döner", () => {
      expect(extractActiveName(null)).toBeNull();
      expect(extractActiveName(undefined)).toBeNull();
    });
  });

  describe("mapSessionRow", () => {
    it("oturum ve kayıt satırlarını eksiksiz eşler ve kayıtları öğrenci adına göre sıralar", () => {
      const mapped = mapSessionRow({
        id: "sess-1",
        class_id: "cls-1",
        subject_id: "sub-1",
        session_date: "2026-09-08",
        starts_at: "09:00:00",
        classes: { name: "12-A", archived_at: null },
        subjects: { name: "Matematik", archived_at: null },
        attendance_records: [
          {
            id: "rec-2",
            student_id: "stu-2",
            status: "absent",
            students: { full_name: "Zeynep Kaya" },
          },
          {
            id: "rec-1",
            student_id: "stu-1",
            status: "present",
            students: { full_name: "Ahmet Demir" },
          },
        ],
      });

      expect(mapped.id).toBe("sess-1");
      expect(mapped.className).toBe("12-A");
      expect(mapped.subjectName).toBe("Matematik");
      expect(mapped.startsAt).toBe("09:00");
      expect(mapped.records).toHaveLength(2);
      // Alfabetik sıralama: Ahmet Demir önce gelir
      expect(mapped.records[0].studentName).toBe("Ahmet Demir");
      expect(mapped.records[0].status).toBe("Katıldı");
      expect(mapped.records[1].studentName).toBe("Zeynep Kaya");
      expect(mapped.records[1].status).toBe("Gelmedi");
    });
  });

  describe("loadStudentAttendancePercentages (RPC student_attendance_counts & Bulgu 1)", () => {
    it("boş öğrenci listesinde veritabanına sorgu atmadan boş map döner", async () => {
      const result = await loadStudentAttendancePercentages([]);
      expect(result.size).toBe(0);
      expect(rpcMock).not.toHaveBeenCalled();
      expect(fromMock).not.toHaveBeenCalled();
    });

    // ⛔ PostgREST `bigint` sütunlarını JSON'a DİZGE olarak koyar: sayaçlar
    // üretimde `8` değil `"8"` olarak gelir. Dönüşüm `Number(...)` ile doğru
    // yapılıyor — ama mock'lar sayı verdiği için o dönüşüm hiçbir testte
    // sınanmıyordu. Birinin yarın `Number(...)`'ı sadeleştirmesi bu testler
    // yeşilken üretimde yüzdeleri bozardı: "8" + "2" dizge birleşmesidir.
    it("sayaçlar dizge olarak gelse bile yüzde doğru hesaplanır (PostgREST bigint)", async () => {
      rpcMock.mockResolvedValue({
        data: [
          {
            student_id: "stu-str",
            present_count: "8",
            late_count: "2",
            absent_count: "2",
          },
        ],
        error: null,
      });

      const result = await loadStudentAttendancePercentages(["stu-str"]);

      // (8 + 2) / (8 + 2 + 2) = %83 — dizge birleşmesi olsaydı sonuç bambaşka olurdu
      expect(result.get("stu-str")).toBe(83);
    });

    it("student_attendance_counts RPC'sini tek seferde çağırır ve devam yüzdelerini hesaplar", async () => {
      rpcMock.mockResolvedValue({
        data: [
          // stu-1: 8 present, 2 late, 2 absent -> (8+2)/(8+2+2) = 10/12 = %83
          {
            student_id: "stu-1",
            present_count: 8,
            late_count: 2,
            absent_count: 2,
          },
          // stu-2: 0 present, 4 late, 0 absent -> (4)/(4) = %100 (geç kalma devamdır)
          {
            student_id: "stu-2",
            present_count: 0,
            late_count: 4,
            absent_count: 0,
          },
          // stu-3: 0 present, 0 late, 3 absent -> (0)/(3) = %0
          {
            student_id: "stu-3",
            present_count: 0,
            late_count: 0,
            absent_count: 3,
          },
          // stu-4: payda 0 (tüm sayaçlar 0 veya yalnız excused) -> undefined (K-22)
          {
            student_id: "stu-4",
            present_count: 0,
            late_count: 0,
            absent_count: 0,
          },
        ],
        error: null,
      });

      const map = await loadStudentAttendancePercentages([
        "stu-1",
        "stu-2",
        "stu-3",
        "stu-4",
        "stu-5", // kaydı hiç dönmeyen öğrenci
      ]);

      // RPC tek seferde çağrılmalıdır, öğrenci başına N çağrı yapılmaz (K-06)
      expect(rpcMock).toHaveBeenCalledTimes(1);
      expect(rpcMock).toHaveBeenCalledWith("student_attendance_counts", {
        target_student_ids: ["stu-1", "stu-2", "stu-3", "stu-4", "stu-5"],
      });

      // ⛔ ENGELLEYİCİ KRİTER: attendance_records tablosuna doğrudan sorgu GİTMEZ
      expect(fromMock).not.toHaveBeenCalledWith("attendance_records");

      // Yüzde doğrulamaları
      expect(map.get("stu-1")).toBe(83);
      expect(map.get("stu-2")).toBe(100);
      expect(map.get("stu-3")).toBe(0);
      // K-22: Payda sıfır iken %0 değil undefined kalmalıdır
      expect(map.get("stu-4")).toBeUndefined();
      // Kaydı dönmeyen öğrenci undefined kalmalıdır
      expect(map.get("stu-5")).toBeUndefined();
    });

    it("veritabanı hatasında boş map döner (fail-closed, K-04)", async () => {
      rpcMock.mockResolvedValue({
        data: null,
        error: { message: "connection timeout" },
      });

      const map = await loadStudentAttendancePercentages(["stu-1"]);
      expect(map.size).toBe(0);
      expect(fromMock).not.toHaveBeenCalledWith("attendance_records");
    });
  });

  describe("loadLatestAttendanceSession", () => {
    it("en son aktif oturumu tarih ve saat azalan sırayla çeker ve organization_id süzer", async () => {
      const spy: {
        eqArgs?: [string, unknown][];
        isArgs?: [string, unknown];
        orderArgs?: [string, { ascending?: boolean; nullsFirst?: boolean }][];
        limitArg?: number;
      } = {};

      fromMock.mockReturnValue(
        createQueryChain(
          {
            data: [
              {
                id: "sess-latest",
                class_id: "cls-1",
                session_date: "2026-09-08",
                starts_at: "09:00:00",
                classes: { name: "12-A", archived_at: null },
                subjects: { name: "Matematik", archived_at: null },
                attendance_records: [],
              },
            ],
            error: null,
          },
          spy
        )
      );

      const result = await loadLatestAttendanceSession("org-42");

      expect(fromMock).toHaveBeenCalledWith("attendance_sessions");
      expect(spy.eqArgs).toEqual([["organization_id", "org-42"]]);
      expect(spy.isArgs).toEqual(["archived_at", null]);
      expect(spy.orderArgs).toEqual([
        ["session_date", { ascending: false }],
        ["starts_at", { ascending: false, nullsFirst: false }],
      ]);
      expect(spy.limitArg).toBe(1);

      expect(result.session).not.toBeNull();
      expect(result.session?.id).toBe("sess-latest");
    });

    it("oturum yoksa session: null döner (K-03: uydurulmuş değer yok)", async () => {
      fromMock.mockReturnValue(
        createQueryChain({
          data: [],
          error: null,
        })
      );

      const result = await loadLatestAttendanceSession("org-42");
      expect(result.session).toBeNull();
    });

    it("veritabanı hatasında anlamlı Türkçe hata fırlatır", async () => {
      fromMock.mockReturnValue(
        createQueryChain({
          data: null,
          error: { message: "database error" },
        })
      );

      await expect(loadLatestAttendanceSession("org-42")).rejects.toThrow(
        "Yoklama oturumu yüklenemedi."
      );
    });
  });

  describe("openAttendanceSession (v1.4-03 · #268)", () => {
    it("oturum zaten varsa mevcut oturumun id'sini döner ve insert çağırmaz", async () => {
      const spy: { eqArgs?: [string, unknown][]; isArgs?: [string, unknown] } =
        {};

      fromMock.mockImplementation((table: string) => {
        expect(table).toBe("attendance_sessions");
        return createQueryChain(
          {
            data: { id: "existing-sess-1" },
            error: null,
          },
          spy
        );
      });

      // 2026-09-28: ders başına — oturumun kimliği ders ve saati de içerir.
      const result = await openAttendanceSession({
        organizationId: "org-1",
        classId: "cls-1",
        sessionDate: "2026-09-10",
        subjectId: "sub-1",
        startsAt: "09:00:00",
      });

      expect(result.id).toBe("existing-sess-1");
      expect(spy.eqArgs).toEqual([
        ["organization_id", "org-1"],
        ["class_id", "cls-1"],
        ["session_date", "2026-09-10"],
        ["subject_id", "sub-1"],
        ["starts_at", "09:00:00"],
      ]);
      expect(spy.isArgs).toEqual(["archived_at", null]);
    });

    it("dersi ve saati olmayan (günlük) oturum boş alanları is null ile arar", async () => {
      const isCalls: [string, unknown][] = [];
      fromMock.mockImplementation(() => {
        const chain = createQueryChain({
          data: { id: "daily-1" },
          error: null,
        });
        chain.is = vi.fn((col: string, val: unknown) => {
          isCalls.push([col, val]);
          return chain;
        });
        return chain;
      });

      await openAttendanceSession({
        organizationId: "org-1",
        classId: "cls-1",
        sessionDate: "2026-09-10",
      });

      expect(isCalls).toEqual([
        ["archived_at", null],
        ["subject_id", null],
        ["starts_at", null],
      ]);
    });

    it("⛔ oturum yoksa yeni oturum açar ve id GÖNDERMEZ (veritabanı üretir)", async () => {
      const insertSpy: { insertArg?: unknown } = {};

      fromMock.mockImplementation((table: string) => {
        expect(table).toBe("attendance_sessions");
        // İlk arama boş döner (oturum yok)
        const selectChain = createQueryChain({ data: null, error: null });
        selectChain.maybeSingle = vi.fn().mockResolvedValue({
          data: null,
          error: null,
        });

        // Insert zinciri
        selectChain.insert = vi.fn((payload: unknown) => {
          insertSpy.insertArg = payload;
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: "new-generated-sess-id" },
                error: null,
              }),
            }),
          };
        });

        return selectChain;
      });

      const result = await openAttendanceSession({
        organizationId: "org-1",
        classId: "cls-1",
        sessionDate: "2026-09-10",
        subjectId: "sub-1",
        startsAt: "09:00:00",
      });

      expect(result.id).toBe("new-generated-sess-id");
      // ⛔ İstemci asla id göndermez (authenticated için salt okunurdur)
      expect(insertSpy.insertArg).toEqual({
        organization_id: "org-1",
        class_id: "cls-1",
        session_date: "2026-09-10",
        subject_id: "sub-1",
        starts_at: "09:00:00",
      });
      expect(
        (insertSpy.insertArg as Record<string, unknown>).id
      ).toBeUndefined();
    });

    it("oturum açma hatasında translateAttendanceError üzerinden hata fırlatır", async () => {
      fromMock.mockImplementation(() => {
        return createQueryChain({
          data: null,
          error: { code: "42501", message: "permission denied" },
        });
      });

      await expect(
        openAttendanceSession({
          organizationId: "org-1",
          classId: "cls-1",
          sessionDate: "2026-09-10",
        })
      ).rejects.toThrow("Bu yoklamayı kaydetme yetkiniz yok.");
    });
  });

  describe("loadAttendanceSheet (v1.4-03 · #268)", () => {
    it("oturum, kayıtlı öğrenciler ve mevcut yoklama durumlarını açık organization_id ile çeker", async () => {
      const calls: { table: string; eqArgs?: [string, unknown][] }[] = [];

      fromMock.mockImplementation((table: string) => {
        const spy: { eqArgs: [string, unknown][] } = { eqArgs: [] };
        calls.push({ table, eqArgs: spy.eqArgs });

        if (table === "attendance_sessions") {
          return createQueryChain(
            {
              data: {
                id: "sess-1",
                organization_id: "org-1",
                class_id: "cls-1",
                subject_id: null,
                session_date: "2026-09-10",
                starts_at: null,
                classes: { name: "12-A", archived_at: null },
                subjects: null,
              },
              error: null,
            },
            spy
          );
        }

        if (table === "class_enrollments") {
          return createQueryChain(
            {
              data: [
                {
                  id: "enr-1",
                  student_id: "stu-1",
                  archived_at: null,
                  students: {
                    id: "stu-1",
                    full_name: "Ali Can",
                    student_number: "101",
                    archived_at: null,
                  },
                },
                {
                  id: "enr-2",
                  student_id: "stu-2",
                  archived_at: null,
                  students: {
                    id: "stu-2",
                    full_name: "Burak Yılmaz",
                    student_number: "102",
                    archived_at: null,
                  },
                },
              ],
              error: null,
            },
            spy
          );
        }

        if (table === "attendance_records") {
          return createQueryChain(
            {
              data: [
                {
                  id: "rec-1",
                  student_id: "stu-1",
                  status: "present",
                },
              ],
              error: null,
            },
            spy
          );
        }

        throw new Error(`Unexpected table ${table}`);
      });

      const sheet = await loadAttendanceSheet("org-1", "sess-1");

      expect(sheet.session.className).toBe("12-A");
      expect(sheet.students).toHaveLength(2);

      // stu-1'in kaydı var ("present" -> "Katıldı")
      expect(sheet.students[0].studentId).toBe("stu-1");
      expect(sheet.students[0].status).toBe("Katıldı");

      // stu-2'nin henüz kaydı yok: varsayılan durum KESİNLİKLE null'dır (K-03)
      expect(sheet.students[1].studentId).toBe("stu-2");
      expect(sheet.students[1].status).toBeNull();

      // Tüm sorgularda açık organization_id süzgeci çağrılmıştır
      for (const call of calls) {
        expect(call.eqArgs).toContainEqual(["organization_id", "org-1"]);
      }
    });

    it("oturum bulunamadığında 23503 hatası fırlatır", async () => {
      fromMock.mockImplementation((table: string) => {
        if (table === "attendance_sessions") {
          return createQueryChain({ data: null, error: null });
        }
        return createQueryChain({ data: [], error: null });
      });

      await expect(
        loadAttendanceSheet("org-1", "sess-nonexistent")
      ).rejects.toThrow(
        "Yoklama oturumu bulunamadı veya arşivlenmiş. Listeyi tazeleyip tekrar deneyin."
      );
    });
  });

  describe("saveAttendance (v1.4-03 · #268)", () => {
    it("record_attendance RPC'sini target_session_id ve entries ile çağırır", async () => {
      rpcMock.mockResolvedValue({
        data: 3,
        error: null,
      });

      const entries = [
        { student_id: "stu-1", status: "present" as const },
        { student_id: "stu-2", status: "absent" as const },
        { student_id: "stu-3", status: "late" as const },
      ];

      const count = await saveAttendance("sess-1", entries);

      expect(count).toBe(3);
      expect(rpcMock).toHaveBeenCalledWith("record_attendance", {
        target_session_id: "sess-1",
        entries,
      });
    });

    it("RPC hatasında translateAttendanceError üzerinden hata fırlatır", async () => {
      rpcMock.mockResolvedValue({
        data: null,
        error: { code: "ORB02", message: "student not enrolled" },
      });

      await expect(
        saveAttendance("sess-1", [
          { student_id: "stu-alien", status: "present" as const },
        ])
      ).rejects.toThrow(
        "Öğrenci bu sınıfa kayıtlı değil. Önce öğrenciyi sınıfa kaydedin (Sınıflar ekranından)."
      );
    });
  });

  describe("translateAttendanceError (v1.4-03 Dört Hata Kodu Sözleşmesi)", () => {
    it("ORB02 hatasını sınıf ekranına yönlendiren Türkçe mesaja çevirir", () => {
      const msg = translateAttendanceError({ code: "ORB02" });
      expect(msg).toContain("Önce öğrenciyi sınıfa kaydedin");
      expect(msg).toContain("Sınıflar ekranından");
    });

    it("42501 yetki hatasında kimlerin yoklama kaydedebileceğini söyler", () => {
      const msg = translateAttendanceError({ code: "42501" });
      expect(msg).toContain("Bu yoklamayı kaydetme yetkiniz yok.");
      expect(msg).toContain("kurum yöneticisi veya sınıfın öğretmeni");
    });

    it("23503 oturum yok hatasında listeyi tazelemeyi önerir", () => {
      const msg = translateAttendanceError({ code: "23503" });
      expect(msg).toContain("Yoklama oturumu bulunamadı veya arşivlenmiş.");
      expect(msg).toContain("tazeleyip tekrar deneyin");
    });

    it("22P02 geçersiz durum hatasını uygun mesaja çevirir", () => {
      const msg = translateAttendanceError({ code: "22P02" });
      expect(msg).toContain("Geçersiz yoklama durumu");
    });

    it("dört hata kodu birbirinden tamamen farklı dört ayrı mesaja çevrilir", () => {
      const m1 = translateAttendanceError({ code: "ORB02" });
      const m2 = translateAttendanceError({ code: "42501" });
      const m3 = translateAttendanceError({ code: "23503" });
      const m4 = translateAttendanceError({ code: "22P02" });

      const set = new Set([m1, m2, m3, m4]);
      expect(set.size).toBe(4);
    });
  });
});
