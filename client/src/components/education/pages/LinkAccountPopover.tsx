import type { OrganizationMember } from "@/organization/memberService";
import type { Student } from "../types";
import { AssignAccountPopover } from "./AssignAccountPopover";

/**
 * Öğrenci KAYDINA (ad, sınıf, veli) öğrencinin ORBIT'e girdiği HESABI atar.
 * "Hesap bağlama" sözcüğü aynı kişinin iki hesabını birleştirmek için
 * Ayarlar'da ayrıca kullanıldığından burada "giriş hesabı ata" denir.
 * Ortak pencere: `AssignAccountPopover` (öğrenci ve veli, 2026-10-23).
 */
export function LinkAccountPopover({
  student,
  members,
  onLink,
  canOpenAccount = false,
}: {
  student: Student;
  members: OrganizationMember[];
  onLink: (studentId: string, membershipId: string) => Promise<void> | void;
  canOpenAccount?: boolean;
}) {
  return (
    <AssignAccountPopover
      kind="student"
      recordId={student.id}
      recordName={student.name}
      branchId={student.branchId ?? null}
      members={members}
      onLink={onLink}
      canOpenAccount={canOpenAccount}
    />
  );
}
