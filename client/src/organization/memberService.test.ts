import { describe, expect, it, vi } from "vitest";
import {
  changeMemberRole,
  createMember,
  formatLoginNumber,
  isMemberStatus,
  isNeutralMembershipInfo,
  loadOrganizationMembers,
  memberErrorMessage,
  MembershipActionError,
  removeMember,
  resolveBranchSelection,
  sortMembers,
  translateMembershipActionError,
  type OrganizationMember,
} from "./memberService";

const fromMock = vi.fn();
const invokeMock = vi.fn();

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    from: (table: string) => fromMock(table),
    functions: {
      invoke: (...args: unknown[]) => invokeMock(...args),
    },
  },
}));

describe("memberService", () => {
  describe("formatLoginNumber", () => {
    it("kurum kodu 1003 ve kişi kodu 1000 olduğunda 8 haneli numarayı üretir", () => {
      expect(formatLoginNumber(1003, 1000)).toBe("10031000");
    });

    it("kişi kodu null olduğunda uydurulmuş numara üretmez, null döner", () => {
      expect(formatLoginNumber(1003, null)).toBeNull();
    });

    it("kurum kodu null olduğunda null döner", () => {
      expect(formatLoginNumber(null, 1000)).toBeNull();
    });

    it("kurum veya kişi kodu undefined olduğunda null döner", () => {
      expect(formatLoginNumber(undefined, 1000)).toBeNull();
      expect(formatLoginNumber(1003, undefined)).toBeNull();
      expect(formatLoginNumber(undefined, undefined)).toBeNull();
    });
  });

  describe("isMemberStatus", () => {
    it("geçerli durumları tanır", () => {
      expect(isMemberStatus("invited")).toBe(true);
      expect(isMemberStatus("active")).toBe(true);
      expect(isMemberStatus("suspended")).toBe(true);
    });

    it("tanınmayan durumları reddeder", () => {
      expect(isMemberStatus("unknown")).toBe(false);
      expect(isMemberStatus("pending")).toBe(false);
      expect(isMemberStatus("")).toBe(false);
    });
  });

  describe("sortMembers", () => {
    it("üyeleri admin -> teacher -> student -> parent sırasına göre dizer", () => {
      const unsorted: OrganizationMember[] = [
        {
          membershipId: "1",
          displayName: "Ahmet Veli",
          loginNumber: "10011001",
          role: "parent",
          branchName: null,
          status: "active",
        },
        {
          membershipId: "2",
          displayName: "Mehmet Öğrenci",
          loginNumber: "10011002",
          role: "student",
          branchName: null,
          status: "active",
        },
        {
          membershipId: "3",
          displayName: "Ayşe Yönetici",
          loginNumber: "10011003",
          role: "admin",
          branchName: null,
          status: "active",
        },
        {
          membershipId: "4",
          displayName: "Fatma Öğretmen",
          loginNumber: "10011004",
          role: "teacher",
          branchName: null,
          status: "active",
        },
      ];

      const sorted = sortMembers(unsorted);

      expect(sorted.map(m => m.role)).toEqual([
        "admin",
        "teacher",
        "student",
        "parent",
      ]);
    });

    it("aynı roldeki üyeleri ada göre alfabetik sıralar", () => {
      const unsorted: OrganizationMember[] = [
        {
          membershipId: "1",
          displayName: "Zeynep Kaya",
          loginNumber: "10011001",
          role: "teacher",
          branchName: null,
          status: "active",
        },
        {
          membershipId: "2",
          displayName: "Ali Demir",
          loginNumber: "10011002",
          role: "teacher",
          branchName: null,
          status: "active",
        },
        {
          membershipId: "3",
          displayName: "Çiğdem Çelik",
          loginNumber: "10011003",
          role: "teacher",
          branchName: null,
          status: "active",
        },
        {
          membershipId: "4",
          displayName: "Burak Şen",
          loginNumber: "10011004",
          role: "teacher",
          branchName: null,
          status: "active",
        },
      ];

      const sorted = sortMembers(unsorted);

      expect(sorted.map(m => m.displayName)).toEqual([
        "Ali Demir",
        "Burak Şen",
        "Çiğdem Çelik",
        "Zeynep Kaya",
      ]);
    });

    it("adı null olan üye kendi rol grubunun sonuna gider", () => {
      const unsorted: OrganizationMember[] = [
        {
          membershipId: "1",
          displayName: null,
          loginNumber: "10011001",
          role: "teacher",
          branchName: null,
          status: "active",
        },
        {
          membershipId: "2",
          displayName: "Zeynep Kaya",
          loginNumber: "10011002",
          role: "teacher",
          branchName: null,
          status: "active",
        },
        {
          membershipId: "3",
          displayName: "Ali Demir",
          loginNumber: "10011003",
          role: "teacher",
          branchName: null,
          status: "active",
        },
      ];

      const sorted = sortMembers(unsorted);

      expect(sorted.map(m => m.displayName)).toEqual([
        "Ali Demir",
        "Zeynep Kaya",
        null,
      ]);
    });

    it("adı null olan iki üye birbirine göre kararlı sırada kalır", () => {
      const unsorted: OrganizationMember[] = [
        {
          membershipId: "mem-a",
          displayName: null,
          loginNumber: "10011001",
          role: "student",
          branchName: null,
          status: "active",
        },
        {
          membershipId: "mem-b",
          displayName: "Ayşe Kaya",
          loginNumber: "10011002",
          role: "student",
          branchName: null,
          status: "active",
        },
        {
          membershipId: "mem-c",
          displayName: null,
          loginNumber: "10011003",
          role: "student",
          branchName: null,
          status: "active",
        },
      ];

      const sorted = sortMembers(unsorted);

      expect(sorted.map(m => m.membershipId)).toEqual([
        "mem-b",
        "mem-a",
        "mem-c",
      ]);
    });
  });

  describe("memberErrorMessage", () => {
    it("bilinen hata kodları için anlamlı Türkçe mesaj döner", () => {
      expect(memberErrorMessage("unauthorized", "yedek")).toBe(
        "Oturumunuz düşmüş görünüyor. Tekrar giriş yapın."
      );
      expect(memberErrorMessage("forbidden", "yedek")).toBe(
        "Bu işlem için kurum yöneticisi yetkisi gerekiyor veya üye bulunamadı."
      );
      expect(memberErrorMessage("password_update_failed", "yedek")).toBe(
        "Yeni şifre kaydedilemedi. Lütfen tekrar deneyin."
      );
      expect(memberErrorMessage("member_create_failed", "yedek")).toBe(
        "Üye oluşturulamadı. Bilgileri kontrol edip tekrar deneyin."
      );
    });

    it("bilinmeyen veya geçersiz hata kodlarında genel mesaj döner", () => {
      expect(
        memberErrorMessage(
          "unknown_code",
          "Yeni şifre üretilemedi. Lütfen tekrar deneyin."
        )
      ).toBe("Yeni şifre üretilemedi. Lütfen tekrar deneyin.");
      expect(
        memberErrorMessage(
          null,
          "Yeni şifre üretilemedi. Lütfen tekrar deneyin."
        )
      ).toBe("Yeni şifre üretilemedi. Lütfen tekrar deneyin.");
      expect(
        memberErrorMessage(
          undefined,
          "Üye oluşturulamadı. Bilgileri kontrol edip tekrar deneyin."
        )
      ).toBe("Üye oluşturulamadı. Bilgileri kontrol edip tekrar deneyin.");
    });
  });

  describe("resolveBranchSelection", () => {
    it("seçim yapılmadığında (boş string, null, undefined) undefined döner ve gönderimi engeller", () => {
      expect(resolveBranchSelection("")).toBeUndefined();
      expect(resolveBranchSelection(null)).toBeUndefined();
      expect(resolveBranchSelection(undefined)).toBeUndefined();
    });

    it("kurum geneli (__all__) seçildiğinde sunucu sözleşmesine uygun null döner", () => {
      expect(resolveBranchSelection("__all__")).toBeNull();
    });

    it("belirli bir şube ID'si seçildiğinde şube ID'sini aynen korur", () => {
      expect(resolveBranchSelection("branch-corlu")).toBe("branch-corlu");
      expect(
        resolveBranchSelection("9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d")
      ).toBe("9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d");
    });
  });

  describe("loadOrganizationMembers (v1.4-10 · Bağlı Kişi)", () => {
    it("öğrenci ve veli üyeliklerinin bağlı kişi bilgisini çözer, bağlı olmayana null atar", async () => {
      fromMock.mockImplementation((table: string) => {
        const chain: Record<string, unknown> = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.is = vi.fn().mockReturnValue(chain);
        chain.in = vi.fn().mockImplementation(() => {
          if (table === "profiles") {
            return Promise.resolve({
              data: [
                { id: "u-stu-1", display_name: "Ali Profil" },
                { id: "u-stu-2", display_name: "Ayşe Profil" },
                { id: "u-par-1", display_name: "Fatma Profil" },
                { id: "u-adm-1", display_name: "Yönetici Profil" },
              ],
              error: null,
            });
          }
          if (table === "branches") {
            return Promise.resolve({ data: [], error: null });
          }
          if (table === "students") {
            return Promise.resolve({
              data: [
                {
                  id: "stu-rec-1",
                  full_name: "Ali Öğrenci",
                  auth_user_id: "u-stu-1",
                },
              ],
              error: null,
            });
          }
          if (table === "guardians") {
            return Promise.resolve({
              data: [
                {
                  id: "g-rec-1",
                  full_name: "Fatma Veli",
                  auth_user_id: "u-par-1",
                },
              ],
              error: null,
            });
          }
          return Promise.resolve({ data: [], error: null });
        });

        if (table === "organization_memberships") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "m-1",
                    user_id: "u-stu-1",
                    branch_id: null,
                    person_code: 1001,
                    role: "student",
                    status: "active",
                  },
                  {
                    id: "m-2",
                    user_id: "u-stu-2",
                    branch_id: null,
                    person_code: 1002,
                    role: "student",
                    status: "active",
                  },
                  {
                    id: "m-3",
                    user_id: "u-par-1",
                    branch_id: null,
                    person_code: 1003,
                    role: "parent",
                    status: "active",
                  },
                  {
                    id: "m-4",
                    user_id: "u-adm-1",
                    branch_id: null,
                    person_code: 1004,
                    role: "admin",
                    status: "active",
                  },
                ],
                error: null,
              }),
            }),
          };
        }

        return chain;
      });

      const members = await loadOrganizationMembers("org-1", 1001);

      // m-4: admin
      const admin = members.find(m => m.membershipId === "m-4");
      expect(admin?.linkedPerson).toBeUndefined();

      // m-1: bağlı öğrenci
      const linkedStudent = members.find(m => m.membershipId === "m-1");
      expect(linkedStudent?.linkedPerson).toEqual({
        type: "student",
        id: "stu-rec-1",
        name: "Ali Öğrenci",
      });

      // m-2: bağlı OLMAYAN öğrenci
      const unlinkedStudent = members.find(m => m.membershipId === "m-2");
      expect(unlinkedStudent?.linkedPerson).toBeNull();

      // m-3: bağlı veli
      const linkedGuardian = members.find(m => m.membershipId === "m-3");
      expect(linkedGuardian?.linkedPerson).toEqual({
        type: "guardian",
        id: "g-rec-1",
        name: "Fatma Veli",
      });
    });
  });

  describe("translateMembershipActionError (v1.4-07 · #280)", () => {
    it("ORB03 geldiğinde atama sayılarını okur ve ham detail dizgesini basmaz (K-23)", () => {
      const rawDetail = "ders ataması=2, rehberlik=1, program satırı=0";
      const message = translateMembershipActionError({
        code: "ORB03",
        detail: rawDetail,
        hint: "Önce ilgili atamaları arşivleyin, sonra rolü değiştirin.",
      });

      // K-23: Ham detail dizgesi doğrudan basılmaz
      expect(message).not.toContain(rawDetail);
      // Sayılar okunarak insani Türkçe mesaja dönüştürülür
      expect(message).toContain("2 ders ataması");
      expect(message).toContain("1 rehberlik görevi");
      expect(message).toContain(
        "sınıf yönetiminden ilgili atamaları arşivleyin"
      );
    });

    it("ORB03 farklı atama kombinasyonlarını doğru ayrıştırır", () => {
      const msg = translateMembershipActionError({
        code: "ORB03",
        detail: "ders ataması=0, rehberlik=0, program satırı=3",
      });
      expect(msg).toContain("3 ders programı satırı");
      expect(msg).not.toContain("ders ataması");
      expect(msg).not.toContain("rehberlik görevi");
    });

    it("ORB03 detail null veya boş olduğunda genel yönlendirme cümlesi kurar", () => {
      const msg = translateMembershipActionError({
        code: "ORB03",
        detail: null,
      });
      expect(msg).toContain("ayakta duran ders veya rehberlik ataması");
      expect(msg).toContain("sınıf yönetiminden");
    });

    it("ORB04 rol değiştirme ve çıkarma için nötr bilgi mesajı üretir", () => {
      const roleMsg = translateMembershipActionError(
        { code: "ORB04" },
        "change_role"
      );
      expect(roleMsg).toBe(
        "Rol zaten bu değerde; herhangi bir değişiklik yapılmadı."
      );

      const removeMsg = translateMembershipActionError(
        { code: "ORB04" },
        "remove"
      );
      expect(removeMsg).toBe("Bu üyelik zaten kurumdan çıkarılmış durumda.");
    });

    it("42501 hedef yönetici olduğunda yönetici devri uyarısı döner (v1.4-08)", () => {
      const msg = translateMembershipActionError({
        code: "42501",
        hint: "Yönetici devri v1.4-08 kapsamında yapılmalıdır.",
      });
      expect(msg).toBe(
        "Kurum yöneticilerinin rolü buradan değiştirilemez veya kurumdan çıkarılamaz. Yönetici devri ayrı bir işlemdir."
      );
    });

    it("42501 çağıran yönetici olmadığında yetki uyarısı döner", () => {
      const msg = translateMembershipActionError({
        code: "42501",
        hint: "Yalnızca aktif yöneticiler üye rollerini değiştirebilir.",
      });
      expect(msg).toBe("Bu işlem için kurum yöneticisi yetkisi gerekiyor.");
    });

    it("23503 için üyelik kaydı bulunamadı mesajı döner", () => {
      const msg = translateMembershipActionError({ code: "23503" });
      expect(msg).toBe("Üyelik kaydı bulunamadı.");
    });

    it("request_in_progress ve rate_limited için tekrar deneme yönlendirmesi yapar", () => {
      expect(
        translateMembershipActionError({ error: "request_in_progress" })
      ).toContain("İşlem şu anda devam ediyor");

      expect(
        translateMembershipActionError({ error: "rate_limited" })
      ).toContain("Çok fazla istek gönderildi");
    });

    it("unauthorized ve service_unavailable için ilgili açıklamaları döner", () => {
      expect(
        translateMembershipActionError({ error: "unauthorized" })
      ).toContain("Oturumunuz düşmüş görünüyor");

      expect(
        translateMembershipActionError({ error: "service_unavailable" })
      ).toContain("Servis şu anda yanıt vermiyor");
    });

    it("ORB06 rol değiştirme hatasında tek yönetici uyarısı döner (kendisi için)", () => {
      const msg = translateMembershipActionError(
        { code: "ORB06" },
        "change_role",
        { isSelf: true }
      );
      expect(msg).toBe(
        "Kurumun tek yöneticisisiniz. Rolünüzü değiştirmeden önce başka bir üyeyi yönetici yapın."
      );
    });

    it("ORB06 rol değiştirme hatasında hedef başkasıysa üçüncü şahıs uyarısı döner", () => {
      const msg = translateMembershipActionError(
        { code: "ORB06" },
        "change_role",
        { isSelf: false }
      );
      expect(msg).toBe(
        "Kurumun tek yöneticisinin rolü değiştirilemez. Önce başka bir üyeyi yönetici yapın."
      );
    });

    it("ORB06 çıkarma hatasında tek yönetici kurumdan çıkarılamaz uyarısı döner", () => {
      const msg = translateMembershipActionError({ code: "ORB06" }, "remove");
      expect(msg).toBe(
        "Kurumun tek yöneticisi kurumdan çıkarılamaz. Önce başka bir üyeyi yönetici yapın."
      );
    });

    it("MembershipActionError doğrudan kendi mesajını korur", () => {
      const customErr = new MembershipActionError("Özel üyelik hatası", {
        code: "CUSTOM",
      });
      expect(translateMembershipActionError(customErr)).toBe(
        "Özel üyelik hatası"
      );
    });
  });

  describe("isNeutralMembershipInfo (v1.4-07 · #280)", () => {
    it("ORB04 kodunu nötr bilgi olarak doğrular", () => {
      expect(isNeutralMembershipInfo({ code: "ORB04" })).toBe(true);
      expect(isNeutralMembershipInfo({ error: "ORB04" })).toBe(true);
    });

    it("MembershipActionError isNeutralInfo bayrağını okur", () => {
      const neutralErr = new MembershipActionError("Bilgi", {
        isNeutralInfo: true,
      });
      expect(isNeutralMembershipInfo(neutralErr)).toBe(true);

      const blockingErr = new MembershipActionError("Hata", {
        isNeutralInfo: false,
      });
      expect(isNeutralMembershipInfo(blockingErr)).toBe(false);
    });

    it("ORB03, ORB06 veya 42501 gibi gerçek hatalarda false döner", () => {
      expect(isNeutralMembershipInfo({ code: "ORB03" })).toBe(false);
      expect(isNeutralMembershipInfo({ code: "ORB06" })).toBe(false);
      expect(isNeutralMembershipInfo({ code: "42501" })).toBe(false);
      expect(isNeutralMembershipInfo(new Error("Bağlantı koptu"))).toBe(false);
    });
  });

  describe("changeMemberRole (v1.4-07 · #280, v1.4-08 · #282)", () => {
    // ⚠️ Bu iddia 2026-09-13'te TERSİNE döndü (v1.4-08, #282).
    // v1.4-07'de terfi/admin ataması istemcide 42501 ile engelleniyordu ("admin rolleri burada ele alınmaz").
    // v1.4-08 o kapıyı kaldırdı — yönetici devri ve çoklu yönetici meşru olduğu için admin rolüne
    // geçiş sunucu fonksiyonuna iletilir. Son aktif yönetici koruması (ORB06) sunucuda bir sayım ile yürütülür.
    it("admin rolüne geçiş isteği sunucu fonksiyonuna iletilir (v1.4-08 · #282)", async () => {
      invokeMock.mockReset();
      invokeMock.mockResolvedValue({
        data: { data: { role_changed: true, role: "admin" } },
        error: null,
      });

      const result = await changeMemberRole("mem-1", "admin", "idem-admin-1");

      expect(invokeMock).toHaveBeenCalledWith("change-member-role", {
        body: { membershipId: "mem-1", role: "admin" },
        headers: { "Idempotency-Key": "idem-admin-1" },
      });
      expect(result).toEqual({ roleChanged: true, role: "admin" });
    });

    it("geçerli rol geçişinde change-member-role fonksiyonunu çağırır ve idempotencyKey iletir", async () => {
      invokeMock.mockReset();
      invokeMock.mockResolvedValue({
        data: { data: { role_changed: true, role: "teacher" } },
        error: null,
      });

      const result = await changeMemberRole("mem-1", "teacher", "idem-123");

      expect(invokeMock).toHaveBeenCalledWith("change-member-role", {
        body: { membershipId: "mem-1", role: "teacher" },
        headers: { "Idempotency-Key": "idem-123" },
      });
      expect(result).toEqual({ roleChanged: true, role: "teacher" });
    });

    it("sunucu ORB03 döndüğünde atama detayını ayrıştırıp MembershipActionError fırlatır", async () => {
      invokeMock.mockReset();
      const mockError = {
        message: "Edge Function returned a non-2xx status code",
        context: {
          json: () =>
            Promise.resolve({
              error: "role_change_refused",
              code: "ORB03",
              detail: "ders ataması=2, rehberlik=1, program satırı=0",
              hint: "Önce ilgili atamaları arşivleyin, sonra rolü değiştirin.",
            }),
        },
      };
      invokeMock.mockResolvedValue({
        data: null,
        error: mockError,
      });

      await expect(changeMemberRole("mem-t1", "student")).rejects.toThrow(
        "2 ders ataması, 1 rehberlik görevi"
      );
    });

    it("sunucu ORB04 döndüğünde isNeutralInfo=true ile MembershipActionError fırlatır", async () => {
      invokeMock.mockReset();
      const mockError = {
        context: {
          json: () =>
            Promise.resolve({
              error: "role_change_refused",
              code: "ORB04",
              hint: "Rol zaten bu değerde",
            }),
        },
      };
      invokeMock.mockResolvedValue({
        data: null,
        error: mockError,
      });

      try {
        await changeMemberRole("mem-1", "teacher");
        expect.fail("Hata fırlatılmalıydı");
      } catch (err) {
        expect(err).toBeInstanceOf(MembershipActionError);
        expect((err as MembershipActionError).isNeutralInfo).toBe(true);
        expect((err as MembershipActionError).code).toBe("ORB04");
      }
    });
  });

  describe("removeMember (v1.4-07 · #280)", () => {
    it("remove-member fonksiyonunu çağırır ve unlinked alanlarını camelCase nesneye dönüştürür", async () => {
      invokeMock.mockReset();
      invokeMock.mockResolvedValue({
        data: {
          data: {
            removed: true,
            role: "student",
            unlinked_student_id: "stu-101",
            unlinked_guardian_id: null,
          },
        },
        error: null,
      });

      const result = await removeMember("mem-s1", "idem-rem-1");

      expect(invokeMock).toHaveBeenCalledWith("remove-member", {
        body: { membershipId: "mem-s1" },
        headers: { "Idempotency-Key": "idem-rem-1" },
      });
      expect(result).toEqual({
        removed: true,
        role: "student",
        unlinkedStudentId: "stu-101",
        unlinkedGuardianId: null,
      });
    });

    it("sunucu ORB04 döndüğünde isNeutralInfo=true taşır", async () => {
      invokeMock.mockReset();
      const mockError = {
        context: {
          json: () =>
            Promise.resolve({
              error: "removal_refused",
              code: "ORB04",
              hint: "Bu üyelik zaten çıkarılmış",
            }),
        },
      };
      invokeMock.mockResolvedValue({
        data: null,
        error: mockError,
      });

      try {
        await removeMember("mem-s1");
        expect.fail("Hata fırlatılmalıydı");
      } catch (err) {
        expect(err).toBeInstanceOf(MembershipActionError);
        expect((err as MembershipActionError).isNeutralInfo).toBe(true);
        expect((err as MembershipActionError).code).toBe("ORB04");
        expect((err as MembershipActionError).message).toContain(
          "Bu üyelik zaten kurumdan çıkarılmış durumda."
        );
      }
    });
  });

  describe("createMember — üyelik kimliği (Yeni öğrenci akışı)", () => {
    it("sunucu döndürürse membershipId'yi taşır", async () => {
      invokeMock.mockReset();
      invokeMock.mockResolvedValue({
        data: {
          data: {
            login_number: "78018105",
            temporary_password: "gecici",
            password_lock_set: true,
            audit_written: true,
            membership_id: "mem-9",
          },
        },
        error: null,
      });

      const result = await createMember(
        { fullName: "Selin Koç", role: "student", branchId: "b-1" },
        "key-1"
      );

      expect(result.membershipId).toBe("mem-9");
      expect(invokeMock).toHaveBeenCalledWith("create-member", {
        body: { fullName: "Selin Koç", role: "student", branchId: "b-1" },
        headers: { "Idempotency-Key": "key-1" },
      });
    });

    it("eski yanıtta kimlik yoksa undefined kalır; uydurulmaz", async () => {
      invokeMock.mockReset();
      invokeMock.mockResolvedValue({
        data: {
          data: { login_number: "78018105", temporary_password: "gecici" },
        },
        error: null,
      });

      const result = await createMember({
        fullName: "Selin Koç",
        role: "student",
        branchId: null,
      });

      expect(result.membershipId).toBeUndefined();
    });
  });
});
