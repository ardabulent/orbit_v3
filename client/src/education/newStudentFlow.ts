import type { IssuedCredentials } from "@/components/credentials/IssuedCredentials";
import { createMember } from "@/organization/memberService";
import { enrollStudent } from "./classService";
import {
  createGuardian,
  linkGuardianAccount,
  linkStudentGuardian,
} from "./guardianService";
import { createStudent, linkStudentAccount } from "./studentService";

/**
 * "Yeni öğrenci" tek akışı (karar 2026-09-28).
 *
 * Eskiden bir öğrenciyi tam kurmak üç ayrı ekran istiyordu: öğrenci kaydı
 * Öğrenciler'de, hesap Ayarlar'da, bağlama yine Öğrenciler'de, veli Veliler'de,
 * sınıf Sınıflar'da. Ayarlar'dan açılan hesap bir öğrenci kaydı oluşturmadığı
 * için "hesap var ama listede yok" karışıklığı doğuyordu (ROADMAP §4.23 C-05).
 *
 * Akış adımları sırayla yürütür:
 *
 *   1. öğrenci kaydı      — başarısızsa akış durur, hiçbir şey yazılmamıştır
 *   2. sınıf kaydı        — isteğe bağlı
 *   3. veli               — yeni veli oluşturulur ya da mevcut veli seçilir; bağlanır
 *   4. öğrenci hesabı     — isteğe bağlı; açılır ve kayda bağlanır
 *   5. veli hesabı        — isteğe bağlı; açılır ve veli kaydına bağlanır
 *
 * 1'den sonraki bir adım başarısız olursa **kalanlar yine denenir** ve her
 * adımın sonucu raporlanır. Sessizce atlanan adım yok: "hesap açıldı ama
 * bağlanamadı" gibi bir yarım durum ekranda açıkça yazılır ve elle nasıl
 * tamamlanacağı söylenir (K-03, K-14). Akış geri alma denemez: yarım kalan
 * iş kayıtlarda görünür ve listeden tamamlanabilir; otomatik geri alma yeni
 * bir yarım durum üretebilirdi.
 *
 * Yetki her adımda çağıranındır — servisler RLS ve SQL fonksiyonlarından
 * geçer; bu modül yetki kararı vermez.
 */

export type NewStudentGuardian =
  | { mode: "none" }
  | {
      mode: "existing";
      guardianId: string;
      guardianName: string;
      hasAccount: boolean;
    }
  | { mode: "new"; fullName: string; phone?: string | null };

export type NewStudentInput = {
  organizationId: string;
  branchId: string;
  fullName: string;
  studentNumber?: string;
  classId?: string | null;
  guardian: NewStudentGuardian;
  createStudentAccount: boolean;
  createGuardianAccount: boolean;
};

export type NewStudentStep = {
  label: string;
  ok: boolean;
  /** Başarısız adımda neden ve kullanıcının ne yapacağı. */
  message?: string;
};

export type IssuedAccount = {
  subjectLabel: "Öğrenci" | "Veli";
  subjectName: string;
  credentials: IssuedCredentials;
};

export type NewStudentResult = {
  studentId: string;
  steps: NewStudentStep[];
  accounts: IssuedAccount[];
};

/** Test için servis çağrıları değiştirilebilir; üretimde varsayılanlar kullanılır. */
export type NewStudentDeps = {
  createStudent: typeof createStudent;
  enrollStudent: typeof enrollStudent;
  createGuardian: typeof createGuardian;
  linkStudentGuardian: typeof linkStudentGuardian;
  createMember: typeof createMember;
  linkStudentAccount: typeof linkStudentAccount;
  linkGuardianAccount: typeof linkGuardianAccount;
  newIdempotencyKey: () => string;
};

const defaultDeps: NewStudentDeps = {
  createStudent,
  enrollStudent,
  createGuardian,
  linkStudentGuardian,
  createMember,
  linkStudentAccount,
  linkGuardianAccount,
  newIdempotencyKey: () => crypto.randomUUID(),
};

const reason = (err: unknown) =>
  err instanceof Error ? err.message : "Bilinmeyen hata.";

export async function runNewStudentFlow(
  input: NewStudentInput,
  deps: NewStudentDeps = defaultDeps
): Promise<NewStudentResult> {
  const fullName = input.fullName.trim();
  const steps: NewStudentStep[] = [];
  const accounts: IssuedAccount[] = [];

  // 1. Öğrenci kaydı — başarısızsa fırlatır; çağıran formda gösterir.
  const { id: studentId } = await deps.createStudent({
    organizationId: input.organizationId,
    branchId: input.branchId,
    fullName,
    studentNumber: input.studentNumber?.trim() || undefined,
  });
  steps.push({ label: "Öğrenci kaydı oluşturuldu", ok: true });

  // 2. Sınıf
  if (input.classId) {
    try {
      await deps.enrollStudent({
        organizationId: input.organizationId,
        classId: input.classId,
        studentId,
      });
      steps.push({ label: "Sınıfa eklendi", ok: true });
    } catch (err) {
      steps.push({
        label: "Sınıfa eklenemedi",
        ok: false,
        message: `${reason(err)} Sınıflar sekmesinden ekleyebilirsiniz.`,
      });
    }
  }

  // 3. Veli
  let guardianId: string | null = null;
  let guardianName: string | null = null;
  let guardianHasAccount = false;
  if (input.guardian.mode === "existing") {
    guardianId = input.guardian.guardianId;
    guardianName = input.guardian.guardianName;
    guardianHasAccount = input.guardian.hasAccount;
  } else if (input.guardian.mode === "new") {
    guardianName = input.guardian.fullName.trim();
    try {
      const created = await deps.createGuardian({
        organizationId: input.organizationId,
        fullName: guardianName,
        phone: input.guardian.phone?.trim() || null,
      });
      guardianId = created.id;
      steps.push({ label: "Veli kaydı oluşturuldu", ok: true });
    } catch (err) {
      steps.push({
        label: "Veli kaydı oluşturulamadı",
        ok: false,
        message: `${reason(err)} Veliler sekmesinden ekleyip öğrenci profilinden bağlayabilirsiniz.`,
      });
    }
  }
  if (guardianId) {
    try {
      await deps.linkStudentGuardian(
        input.organizationId,
        studentId,
        guardianId
      );
      steps.push({ label: "Veli öğrenciye bağlandı", ok: true });
    } catch (err) {
      steps.push({
        label: "Veli öğrenciye bağlanamadı",
        ok: false,
        message: `${reason(err)} Öğrenci profilindeki "Veli bağla" ile bağlayabilirsiniz.`,
      });
    }
  }

  // 4. Öğrenci hesabı
  if (input.createStudentAccount) {
    await openAndLinkAccount({
      deps,
      steps,
      accounts,
      role: "student",
      subjectLabel: "Öğrenci",
      subjectName: fullName,
      branchId: input.branchId,
      link: membershipId => deps.linkStudentAccount(studentId, membershipId),
      manualHint:
        'Öğrenciler listesindeki "Hesap bağla" ile bu hesabı bağlayabilirsiniz.',
    });
  }

  // 5. Veli hesabı — veli kaydı yoksa ya da zaten hesabı varsa açılmaz.
  if (input.createGuardianAccount) {
    if (!guardianId || !guardianName) {
      steps.push({
        label: "Veli hesabı açılmadı",
        ok: false,
        message: "Veli kaydı olmadığı için hesap açılmadı.",
      });
    } else if (guardianHasAccount) {
      steps.push({
        label: "Velinin zaten giriş hesabı var",
        ok: true,
      });
    } else {
      const id = guardianId;
      await openAndLinkAccount({
        deps,
        steps,
        accounts,
        role: "parent",
        subjectLabel: "Veli",
        subjectName: guardianName,
        branchId: input.branchId,
        link: membershipId => deps.linkGuardianAccount(id, membershipId),
        manualHint:
          'Veliler listesindeki "Hesap bağla" ile bu hesabı bağlayabilirsiniz.',
      });
    }
  }

  return { studentId, steps, accounts };
}

async function openAndLinkAccount({
  deps,
  steps,
  accounts,
  role,
  subjectLabel,
  subjectName,
  branchId,
  link,
  manualHint,
}: {
  deps: NewStudentDeps;
  steps: NewStudentStep[];
  accounts: IssuedAccount[];
  role: "student" | "parent";
  subjectLabel: "Öğrenci" | "Veli";
  subjectName: string;
  branchId: string;
  link: (membershipId: string) => Promise<void>;
  manualHint: string;
}) {
  let credentials: IssuedCredentials;
  try {
    credentials = await deps.createMember(
      { fullName: subjectName, role, branchId },
      deps.newIdempotencyKey()
    );
  } catch (err) {
    steps.push({
      label: `${subjectLabel} hesabı açılamadı`,
      ok: false,
      message: `${reason(err)} Hesabı daha sonra açabilirsiniz.`,
    });
    return;
  }
  // Hesap açıldıysa giriş bilgisi her durumda gösterilir: şifre yalnız bir
  // kez döner, bağlama başarısız olsa bile kaybolmamalı.
  accounts.push({ subjectLabel, subjectName, credentials });

  if (!credentials.membershipId) {
    steps.push({
      label: `${subjectLabel} hesabı açıldı ama bağlanamadı`,
      ok: false,
      message: `Sunucu hesabın kimliğini döndürmedi. ${manualHint}`,
    });
    return;
  }
  try {
    await link(credentials.membershipId);
    steps.push({
      label: `${subjectLabel} hesabı açıldı ve bağlandı`,
      ok: true,
    });
  } catch (err) {
    steps.push({
      label: `${subjectLabel} hesabı açıldı ama bağlanamadı`,
      ok: false,
      message: `${reason(err)} ${manualHint}`,
    });
  }
}
