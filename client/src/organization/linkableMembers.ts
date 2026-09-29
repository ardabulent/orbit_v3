import type { OrganizationMember } from "./memberService";

/**
 * "Giriş hesabı ata" listesi (2026-09-30): yalnız verilen roldeki ve HİÇBİR
 * kayda bağlı olmayan hesaplar. `linkedPerson === null` "bağlı kayıt yok"
 * demektir; `undefined` (okunamadı) listeye alınmaz — bilinmeyende seçenek
 * sunulmaz. Önceden başka öğrenciye bağlı hesaplar da listeleniyordu.
 */
export function linkableMembers(
  members: OrganizationMember[],
  role: "student" | "parent"
): OrganizationMember[] {
  return members.filter(m => m.role === role && m.linkedPerson === null);
}
