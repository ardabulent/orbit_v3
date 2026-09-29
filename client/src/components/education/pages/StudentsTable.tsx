import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { OrganizationMember } from "@/organization/memberService";
import { formatTrDate } from "@/education/trDate";
import { Badge, EmptyState, ErrorState, TableSkeleton } from "../shared";
import type { Role, Student } from "../types";
import { LinkAccountPopover } from "./LinkAccountPopover";
import {
  countByFilter,
  formatScore,
  matchesStudentFilter,
  STUDENT_FILTERS,
  type StudentFilter,
} from "./studentFilters";

/**
 * Öğrenci listesi: arama, hızlı süzgeçler, sınıf seçimi ve tablo.
 *
 * Süzgeçler istemcide, yüklenmiş satırlar üzerinde çalışır. Liste 100 satır
 * tavanına dayandığında bu söylenir ve süzgecin "yüklenen kayıtlar içinde"
 * olduğu yazılır — kesildiği söylenmeden hiçbir liste kesilmez (DECISION_LOG).
 */
export function StudentsTable({
  role,
  students,
  query,
  onQuery,
  onSelect,
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
  initialFilter = "all",
}: {
  role: Role;
  students: Student[];
  query: string;
  onQuery: (value: string) => void;
  onSelect: (student: Student) => void;
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
  limit?: number;
  initialFilter?: StudentFilter;
}) {
  const isAdmin = role === "admin";
  const [filter, setFilter] = useState<StudentFilter>(initialFilter);
  const [classFilter, setClassFilter] = useState<string>("");
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  const filters = STUDENT_FILTERS.filter(item => isAdmin || !item.adminOnly);
  const counts = useMemo(() => countByFilter(students), [students]);
  const classNames = useMemo(
    () =>
      Array.from(
        new Set(students.map(s => s.group).filter((g): g is string => !!g))
      ).sort((a, b) => a.localeCompare(b, "tr")),
    [students]
  );
  const rows = students.filter(
    student =>
      matchesStudentFilter(student, filter) &&
      (!classFilter || student.group === classFilter)
  );

  const handleArchive = async (student: Student) => {
    if (!onArchive || archivingId) return;
    setArchivingId(student.id);
    try {
      await onArchive(student);
    } finally {
      setArchivingId(null);
    }
  };

  const handleUnlink = async (student: Student) => {
    if (!onUnlinkAccount || unlinkingId) return;
    setUnlinkingId(student.id);
    try {
      await onUnlinkAccount(student.id);
    } finally {
      setUnlinkingId(null);
    }
  };

  return (
    <>
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-3 shadow-[0_4px_16px_rgba(15,23,42,.025)]">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={event => onQuery(event.target.value)}
              placeholder="Öğrenci adı veya numarası ara..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3 text-[12px] outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
            />
          </div>
          <select
            value={classFilter}
            onChange={event => setClassFilter(event.target.value)}
            aria-label="Sınıfa göre süz"
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-600 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
          >
            <option value="">Tüm sınıflar</option>
            {classNames.map(name => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        {filters.length > 1 ? (
          <div
            role="tablist"
            aria-label="Hızlı süzgeçler"
            className="mt-3 flex flex-wrap gap-2"
          >
            {filters.map(item => {
              const selected = item.id === filter;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setFilter(item.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition ${
                    selected
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <span className="text-[11px] font-bold">{item.label}</span>
                  <span
                    className={`text-[10px] font-extrabold tabular-nums ${
                      selected ? "text-white/70" : "text-slate-400"
                    }`}
                  >
                    {counts[item.id]}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {truncated ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-[11px] font-semibold text-amber-800">
          Liste üst sınıra ({limit} kayıt) ulaştı; süzgeç sayıları yalnız
          yüklenen kayıtları kapsıyor. Kalan kayıtları görmek için yukarıdaki
          arama kutusunu kullanın.
        </div>
      ) : null}

      {isLoading ? (
        <TableSkeleton rows={5} columns={5} className="mt-5" />
      ) : error ? (
        <ErrorState
          className="mt-5"
          title="Öğrenciler görüntülenemedi"
          message={error.message}
          onRetry={onRetry}
        />
      ) : (
        <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_16px_rgba(15,23,42,.025)]">
          {rows.length === 0 ? (
            <EmptyState
              title="Gösterilecek öğrenci yok"
              description={
                students.length === 0
                  ? query
                    ? "Arama kriterlerine uygun öğrenci bulunamadı."
                    : "Henüz kayıtlı öğrenci bulunmuyor."
                  : "Bu süzgece uyan öğrenci yok."
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-400">
                    <th className="px-5 py-3.5">Öğrenci</th>
                    <th className="px-5 py-3.5">Sınıf</th>
                    <th className="px-5 py-3.5">Veli</th>
                    <th className="px-5 py-3.5">Devam</th>
                    <th className="px-5 py-3.5">Son sınav</th>
                    <th className="px-5 py-3.5" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map(student => (
                    <StudentRow
                      key={student.id}
                      student={student}
                      isAdmin={isAdmin}
                      onSelect={onSelect}
                      onEdit={onEdit}
                      onArchive={onArchive ? handleArchive : undefined}
                      archiving={archivingId === student.id}
                      onLinkAccount={onLinkAccount}
                      onUnlink={onUnlinkAccount ? handleUnlink : undefined}
                      unlinking={unlinkingId === student.id}
                      linkableMembers={linkableMembers}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}

function StudentRow({
  student,
  isAdmin,
  onSelect,
  onEdit,
  onArchive,
  archiving,
  onLinkAccount,
  onUnlink,
  unlinking,
  linkableMembers,
}: {
  student: Student;
  isAdmin: boolean;
  onSelect: (student: Student) => void;
  onEdit?: (student: Student) => void;
  onArchive?: (student: Student) => void;
  archiving: boolean;
  onLinkAccount?: (
    studentId: string,
    membershipId: string
  ) => void | Promise<void>;
  onUnlink?: (student: Student) => void;
  unlinking: boolean;
  linkableMembers: OrganizationMember[];
}) {
  const initials = student.name
    .split(" ")
    .map(part => part[0])
    .join("");

  return (
    <tr className="border-b border-slate-100 text-[12px] last:border-0 hover:bg-slate-50/70">
      <td className="px-5 py-4">
        <button
          type="button"
          onClick={() => onSelect(student)}
          className="flex items-center gap-3 text-left"
        >
          <span className="grid h-9 w-9 place-items-center rounded-full bg-blue-50 text-[11px] font-extrabold text-blue-700">
            {initials}
          </span>
          <span>
            <span className="block font-extrabold text-slate-800 hover:underline">
              {student.name}
            </span>
            <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-400">
              {student.code ? <span>{student.code}</span> : null}
              {/* K-22: Hesabı olmayan öğrenci kırmızı değil slate rozet taşır */}
              {isAdmin && student.hasAccount === false ? (
                <Badge tone="slate">Giriş hesabı yok</Badge>
              ) : null}
            </span>
          </span>
        </button>
      </td>
      <td className="px-5 py-4 font-semibold text-slate-600">
        {student.group ?? <Badge tone="amber">Sınıfsız</Badge>}
      </td>
      <td className="px-5 py-4 text-slate-600">
        {student.parent ?? <Badge tone="amber">Velisiz</Badge>}
      </td>
      <td className="px-5 py-4">
        {student.attendance !== undefined ? (
          <Badge tone={student.attendance < 90 ? "amber" : "green"}>
            %{student.attendance}
          </Badge>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
      <td className="px-5 py-4">
        {student.score !== undefined ? (
          <div>
            <span className="font-extrabold text-slate-800">
              {student.latestExamMaxScore !== null &&
              student.latestExamMaxScore !== undefined
                ? `${formatScore(student.score)} / ${formatScore(student.latestExamMaxScore)}`
                : `${formatScore(student.score)} puan`}
            </span>
            {student.latestExamName || student.latestExamDate ? (
              <p className="mt-0.5 text-[10px] text-slate-400">
                {[student.latestExamName, formatTrDate(student.latestExamDate)]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
          </div>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
      <td className="px-5 py-4 text-right">
        <div className="flex items-center justify-end gap-1.5">
          {isAdmin ? (
            <>
              {student.hasAccount ? (
                onUnlink ? (
                  <button
                    type="button"
                    onClick={() => onUnlink(student)}
                    disabled={unlinking}
                    className="rounded-lg px-2 py-1 text-[11px] font-semibold text-amber-600 transition hover:bg-amber-50 disabled:opacity-50"
                  >
                    {unlinking ? "Ayrılıyor…" : "Giriş hesabını ayır"}
                  </button>
                ) : null
              ) : onLinkAccount ? (
                <LinkAccountPopover
                  student={student}
                  members={linkableMembers}
                  onLink={onLinkAccount}
                />
              ) : null}
              {onEdit ? (
                <button
                  type="button"
                  onClick={() => onEdit(student)}
                  className="rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-100"
                >
                  Düzenle
                </button>
              ) : null}
              {onArchive ? (
                <button
                  type="button"
                  onClick={() => onArchive(student)}
                  disabled={archiving}
                  className="rounded-lg px-2 py-1 text-[11px] font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                >
                  {archiving ? "Arşivleniyor…" : "Arşivle"}
                </button>
              ) : null}
            </>
          ) : null}
          <button
            type="button"
            onClick={() => onSelect(student)}
            className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-blue-600 transition hover:bg-blue-50"
          >
            Profili aç
          </button>
        </div>
      </td>
    </tr>
  );
}
