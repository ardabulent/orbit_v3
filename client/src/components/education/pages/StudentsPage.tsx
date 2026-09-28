import { useState } from "react";
import { PageHeader } from "../shared";
import type { Role, Student } from "../types";
import type { OrganizationMember } from "@/organization/memberService";
import type { Guardian } from "@/education/guardianService";
import { GuardiansTab } from "./GuardiansTab";
import type { StudentFilter } from "./studentFilters";
import { StudentsTable } from "./StudentsTable";

export type StudentsPageProps = {
  // Zorunlu: bir rol kapısının varsayılanı olmaz. Opsiyonel olsaydı
  // varsayılanı en geniş yetki olurdu ve prop'u geçmeyi unutan bir çağrı
  // "Yeni öğrenci" düğmesini sessizce herkese açardı (K-04).
  role: Role;
  students: Student[];
  query: string;
  onQuery: (value: string) => void;
  onSelect: (student: Student) => void;
  onAdd: () => void;
  onEdit?: (student: Student) => void;
  onArchive?: (student: Student) => void | Promise<void>;
  onLinkAccount?: (
    studentId: string,
    membershipId: string
  ) => void | Promise<void>;
  onUnlinkAccount?: (studentId: string) => void | Promise<void>;
  linkableMembers?: OrganizationMember[];
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  truncated?: boolean;
  /** Üst sınırın tek kaynağı servistedir; bant onu tekrar etmez, gösterir (K-06). */
  limit?: number;
  guardians?: Guardian[];
  guardianQuery?: string;
  onGuardianQuery?: (value: string) => void;
  onAddGuardian?: () => void;
  onEditGuardian?: (guardian: Guardian) => void;
  onArchiveGuardian?: (guardian: Guardian) => void | Promise<void>;
  onLinkGuardianAccount?: (
    guardianId: string,
    membershipId: string
  ) => void | Promise<void>;
  onUnlinkGuardianAccount?: (guardianId: string) => void | Promise<void>;
  linkableParentMembers?: OrganizationMember[];
  isGuardiansLoading?: boolean;
  guardiansError?: Error | null;
  onGuardiansRetry?: () => void;
  guardiansTruncated?: boolean;
  guardiansLimit?: number;
  /** Genel Bakış'tan süzgeçli gelişte açılacak süzgeç. */
  initialFilter?: StudentFilter;
};

export function StudentsPage({
  role,
  students: visibleStudents,
  query,
  onQuery,
  onSelect,
  onAdd,
  onEdit,
  onArchive,
  onLinkAccount,
  onUnlinkAccount,
  linkableMembers = [],
  isLoading = false,
  error = null,
  onRetry,
  truncated = false,
  limit,
  guardians = [],
  guardianQuery = "",
  onGuardianQuery,
  onAddGuardian,
  onEditGuardian,
  onArchiveGuardian,
  onLinkGuardianAccount,
  onUnlinkGuardianAccount,
  linkableParentMembers = [],
  isGuardiansLoading = false,
  guardiansError = null,
  onGuardiansRetry,
  guardiansTruncated = false,
  guardiansLimit,
  initialFilter = "all",
}: StudentsPageProps) {
  const [activeTab, setActiveTab] = useState<"students" | "guardians">(
    "students"
  );
  return (
    <>
      <PageHeader
        eyebrow="Öğrenci operasyonları"
        title={
          role === "admin" && activeTab === "guardians"
            ? "Veliler"
            : "Öğrenciler"
        }
        description={
          role === "admin" && activeTab === "guardians"
            ? "Kuruma kayıtlı velileri ve öğrenci bağlarını takip edin."
            : "Akademik gelişim, devam ve ödeme sinyallerini öğrenci bazında takip edin."
        }
        action={
          role === "admin"
            ? activeTab === "students"
              ? "Yeni öğrenci"
              : "Yeni veli"
            : undefined
        }
        onAction={
          role === "admin"
            ? activeTab === "students"
              ? onAdd
              : onAddGuardian
            : undefined
        }
      />
      {role === "admin" ? (
        <div className="mt-4 flex border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab("students")}
            className={`border-b-2 px-4 py-2.5 text-xs font-bold transition ${
              activeTab === "students"
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Öğrenciler
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("guardians")}
            className={`border-b-2 px-4 py-2.5 text-xs font-bold transition ${
              activeTab === "guardians"
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Veliler
          </button>
        </div>
      ) : null}
      {role === "admin" && activeTab === "guardians" ? (
        <div className="mt-6">
          <GuardiansTab
            guardians={guardians}
            query={guardianQuery}
            onQuery={onGuardianQuery ?? (() => {})}
            onAdd={onAddGuardian ?? (() => {})}
            onEdit={onEditGuardian ?? (() => {})}
            onArchive={onArchiveGuardian ?? (() => {})}
            onLinkAccount={onLinkGuardianAccount}
            onUnlinkAccount={onUnlinkGuardianAccount}
            linkableMembers={linkableParentMembers}
            isLoading={isGuardiansLoading}
            error={guardiansError}
            onRetry={onGuardiansRetry}
            truncated={guardiansTruncated}
            limit={guardiansLimit}
          />
        </div>
      ) : (
        <>
          <StudentsTable
            role={role}
            students={visibleStudents}
            query={query}
            onQuery={onQuery}
            onSelect={onSelect}
            onEdit={onEdit}
            onArchive={onArchive}
            onLinkAccount={onLinkAccount}
            onUnlinkAccount={onUnlinkAccount}
            linkableMembers={linkableMembers}
            isLoading={isLoading}
            error={error}
            onRetry={onRetry}
            truncated={truncated}
            limit={limit}
            initialFilter={initialFilter}
          />
        </>
      )}
    </>
  );
}
