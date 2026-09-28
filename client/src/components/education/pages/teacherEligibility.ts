import type { OrganizationMember } from "@/organization/memberService";

/** Öğretmen seçme listelerine girebilen üyeler: öğretmen ve yönetici (C-05). */
export function eligibleTeachers(
  members: OrganizationMember[]
): OrganizationMember[] {
  return members.filter(m => m.role === "teacher" || m.role === "admin");
}
