import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { educationKeys } from "@/education/educationQueries";
import {
  archiveStudent,
  restoreStudent,
  linkStudentAccount,
  unlinkStudentAccount,
} from "@/education/studentService";
import {
  archiveGuardian,
  restoreGuardian,
  linkGuardianAccount,
  unlinkGuardianAccount,
  linkStudentGuardian,
  unlinkStudentGuardian,
  restoreStudentGuardianLink,
  translateGuardianError,
  type Guardian,
} from "@/education/guardianService";
import { archiveClass, restoreClass } from "@/education/classService";
import type { ClassGroup, Student } from "./types";

/**
 * Öğrenci, sınıf ve veli kayıtları üzerindeki işlemler: arşivle / geri al,
 * giriş hesabı bağla / çöz, öğrenciye veli bağla / kopar. Her işlem sonunda
 * etkilenen listeler tazelenir. `EducationPlatform`'dan bölündü (2026-10-25,
 * ana plan 5.3); davranış aynı.
 *
 * Yetki kararı sunucudadır (RLS ve RPC'ler); buradaki hiçbir şey güvenlik
 * sınırı değildir.
 */
export function useRecordActions({
  organizationId,
  selectedStudentId,
}: {
  organizationId: string;
  /** Açık öğrenci paneli; veli bağı koparılınca o panelin listesi tazelenir. */
  selectedStudentId: string | undefined;
}) {
  const queryClient = useQueryClient();

  const handleArchiveStudent = async (student: Student) => {
    try {
      await archiveStudent(student.id);
      // v1.4 ara denetimi: `restoreStudent` yazıldığı günden beri çağıransızdı.
      // Arşivlenmiş öğrenciyi listeleyen bir ekran yok (`loadStudents`
      // `archived_at is null` süzüyor), dolayısıyla geri almanın tek
      // gözlenebilir yeri kullanıcının işlemi yaptığı an. Desen uydurma değil:
      // v1.4-10'da veli bağı koparma tam olarak böyle geri alınıyor.
      toast.success("Öğrenci arşivlendi", {
        description: `${student.name} arşive kaldırıldı.`,
        action: {
          label: "Geri al",
          onClick: () => {
            void restoreStudent(student.id)
              .then(async () => {
                toast.success("Öğrenci geri yüklendi", {
                  description: `${student.name} arşivden çıkarıldı.`,
                });
                await queryClient.invalidateQueries({
                  queryKey: educationKeys.students(organizationId),
                });
              })
              .catch(err => {
                toast.error(
                  err instanceof Error
                    ? err.message
                    : "Öğrenci geri yüklenemedi."
                );
              });
          },
        },
      });
      await queryClient.invalidateQueries({
        queryKey: educationKeys.students(organizationId),
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Öğrenci arşivlenemedi."
      );
    }
  };

  const handleArchiveClass = async (cls: ClassGroup) => {
    // Onay penceresi YOK ve bu öğrenci arşivlemesiyle aynı gerekçeye dayanıyor:
    // arşivleme geri alınabilir bir işlem. Ayrıca `window.confirm` bu depoda
    // hiç kullanılmıyor — tarayıcıyı bloklar, tasarım diline uymaz ve test
    // edilemez. Onay gerekseydi yeri `components/ui/alert-dialog.tsx` olurdu.
    try {
      await archiveClass(cls.id);
      toast.success("Sınıf arşivlendi", {
        description: `${cls.name} arşive kaldırıldı.`,
        action: {
          label: "Geri al",
          onClick: () => {
            void restoreClass(cls.id)
              .then(async () => {
                toast.success("Sınıf geri yüklendi", {
                  description: `${cls.name} arşivden çıkarıldı.`,
                });
                await queryClient.invalidateQueries({
                  queryKey: educationKeys.classes(organizationId),
                });
              })
              .catch(err => {
                toast.error(
                  err instanceof Error ? err.message : "Sınıf geri yüklenemedi."
                );
              });
          },
        },
      });
      await queryClient.invalidateQueries({
        queryKey: educationKeys.classes(organizationId),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sınıf arşivlenemedi.");
    }
  };

  const handleLinkStudentAccount = async (
    studentId: string,
    membershipId: string
  ) => {
    await linkStudentAccount(studentId, membershipId);
    toast.success("Giriş hesabı atandı", {
      description: "Öğrenciye giriş hesabı bağlandı.",
    });
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: educationKeys.students(organizationId),
      }),
      queryClient.invalidateQueries({
        queryKey: ["settings", "members", { organizationId }],
      }),
    ]);
  };

  const handleUnlinkStudentAccount = async (studentId: string) => {
    await unlinkStudentAccount(studentId);
    toast.success("Hesap bağı çözüldü", {
      description: "Öğrencinin giriş hesabı bağı kaldırıldı.",
    });
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: educationKeys.students(organizationId),
      }),
      queryClient.invalidateQueries({
        queryKey: ["settings", "members", { organizationId }],
      }),
    ]);
  };

  const handleArchiveGuardian = async (guardian: Guardian) => {
    try {
      await archiveGuardian(organizationId, guardian.id);
      toast.success("Veli arşivlendi", {
        description: `${guardian.fullName} arşive kaldırıldı.`,
        action: {
          label: "Geri al",
          onClick: () => {
            void restoreGuardian(organizationId, guardian.id)
              .then(async () => {
                toast.success("Veli geri yüklendi");
                await Promise.all([
                  queryClient.invalidateQueries({
                    queryKey: educationKeys.guardians(organizationId),
                  }),
                  queryClient.invalidateQueries({
                    queryKey: educationKeys.students(organizationId),
                  }),
                ]);
              })
              .catch(err => {
                toast.error(translateGuardianError(err));
              });
          },
        },
      });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: educationKeys.guardians(organizationId),
        }),
        queryClient.invalidateQueries({
          queryKey: educationKeys.students(organizationId),
        }),
      ]);
    } catch (err) {
      toast.error(translateGuardianError(err));
    }
  };

  const handleLinkGuardianAccount = async (
    guardianId: string,
    membershipId: string
  ) => {
    try {
      await linkGuardianAccount(guardianId, membershipId);
      toast.success("Giriş hesabı atandı", {
        description: "Veliye giriş hesabı bağlandı.",
      });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: educationKeys.guardians(organizationId),
        }),
        queryClient.invalidateQueries({
          queryKey: ["settings", "members", { organizationId }],
        }),
        queryClient.invalidateQueries({
          // Öğrenci detayındaki velinin hesap rozeti bu sorgudan gelir (C-03).
          queryKey: educationKeys.studentGuardians(organizationId),
        }),
      ]);
    } catch (err) {
      toast.error(translateGuardianError(err));
    }
  };

  const handleUnlinkGuardianAccount = async (guardianId: string) => {
    try {
      await unlinkGuardianAccount(guardianId);
      toast.success("Hesap bağı çözüldü", {
        description: "Velinin giriş hesabı bağı kaldırıldı.",
      });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: educationKeys.guardians(organizationId),
        }),
        queryClient.invalidateQueries({
          queryKey: ["settings", "members", { organizationId }],
        }),
        queryClient.invalidateQueries({
          // Öğrenci detayındaki velinin hesap rozeti bu sorgudan gelir (C-03).
          queryKey: educationKeys.studentGuardians(organizationId),
        }),
      ]);
    } catch (err) {
      toast.error(translateGuardianError(err));
    }
  };

  const handleLinkGuardianToStudent = async (
    studentId: string,
    guardianId: string
  ) => {
    try {
      await linkStudentGuardian(organizationId, studentId, guardianId);
      toast.success("Veli bağlandı", {
        description: "Öğrenciye veli kaydı bağlandı.",
      });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: educationKeys.studentGuardians(organizationId, studentId),
        }),
        queryClient.invalidateQueries({
          queryKey: educationKeys.guardians(organizationId),
        }),
        queryClient.invalidateQueries({
          queryKey: educationKeys.students(organizationId),
        }),
      ]);
    } catch (err) {
      toast.error(translateGuardianError(err));
    }
  };

  const handleUnlinkGuardianFromStudent = async (
    linkId: string,
    guardianName: string
  ) => {
    try {
      await unlinkStudentGuardian(organizationId, linkId);
      toast.success("Veli bağı koparıldı", {
        description: `${guardianName} velisinin öğrenci bağı kaldırıldı.`,
        action: {
          label: "Geri al",
          onClick: () => {
            void restoreStudentGuardianLink(organizationId, linkId)
              .then(async () => {
                toast.success("Veli bağı geri yüklendi");
                await Promise.all([
                  queryClient.invalidateQueries({
                    queryKey: educationKeys.studentGuardians(
                      organizationId,
                      selectedStudentId
                    ),
                  }),
                  queryClient.invalidateQueries({
                    queryKey: educationKeys.guardians(organizationId),
                  }),
                  queryClient.invalidateQueries({
                    queryKey: educationKeys.students(organizationId),
                  }),
                ]);
              })
              .catch(err => {
                toast.error(translateGuardianError(err));
              });
          },
        },
      });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: educationKeys.studentGuardians(
            organizationId,
            selectedStudentId
          ),
        }),
        queryClient.invalidateQueries({
          queryKey: educationKeys.guardians(organizationId),
        }),
        queryClient.invalidateQueries({
          queryKey: educationKeys.students(organizationId),
        }),
      ]);
    } catch (err) {
      toast.error(translateGuardianError(err));
    }
  };

  return {
    handleArchiveStudent,
    handleArchiveClass,
    handleLinkStudentAccount,
    handleUnlinkStudentAccount,
    handleArchiveGuardian,
    handleLinkGuardianAccount,
    handleUnlinkGuardianAccount,
    handleLinkGuardianToStudent,
    handleUnlinkGuardianFromStudent,
  };
}
