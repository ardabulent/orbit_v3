import type { OrganizationMember } from "@/organization/memberService";

/**
 * Öğretmen seçme listelerinin seçenekleri — tek yer (K-06).
 *
 * Sınıf rehberi, sınıf öğretmeni ve ders programı aynı listeyi ayrı ayrı
 * yazıyordu ve yöneticiler öğretmenlerle karışık, yalnız parantez içindeki
 * "(Yönetici)" ile ayrılarak çıkıyordu (ROADMAP §4.23 C-05).
 *
 * Karar (2026-09-28): yönetici ders verebildiği için seçilebilir kalır, ama
 * ayrı grupta — öğretmenler üstte, yöneticiler altta.
 */
export function TeacherOptionGroups({
  members,
}: {
  members: OrganizationMember[];
}) {
  const teachers = members.filter(m => m.role === "teacher");
  const admins = members.filter(m => m.role === "admin");
  const option = (m: OrganizationMember) => (
    <option key={m.membershipId} value={m.membershipId}>
      {m.displayName || "adı okunamadı"}
    </option>
  );

  return (
    <>
      {teachers.length > 0 ? (
        <optgroup label="Öğretmenler">{teachers.map(option)}</optgroup>
      ) : null}
      {admins.length > 0 ? (
        <optgroup label="Yöneticiler">{admins.map(option)}</optgroup>
      ) : null}
    </>
  );
}
