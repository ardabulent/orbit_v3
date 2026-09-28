import { useState } from "react";
import { BarChart3, ClipboardCheck, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { isDemoMode } from "@/auth/runtime";
import { formatTrDate } from "@/education/trDate";
import { Badge, StatCard } from "./shared";
import { StudentProfileSummary } from "./StudentProfileSummary";
import type { Role, Student } from "./types";
import type {
  Guardian,
  StudentGuardianLink,
} from "@/education/guardianService";

export type StudentDetailProps = {
  student: Student;
  onClose: () => void;
  role?: Role;
  studentGuardians?: StudentGuardianLink[];
  availableGuardians?: Guardian[];
  onLinkGuardian?: (
    studentId: string,
    guardianId: string
  ) => Promise<void> | void;
  onUnlinkGuardian?: (
    linkId: string,
    guardianName: string
  ) => Promise<void> | void;
  isLinkGuardianOpen?: boolean;
};

export type LinkGuardianPopoverProps = {
  studentId: string;
  guardians: Guardian[];
  onLink: (studentId: string, guardianId: string) => Promise<void> | void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function LinkGuardianPopover({
  studentId,
  guardians,
  onLink,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: LinkGuardianPopoverProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = isControlled
    ? (controlledOnOpenChange ?? (() => {}))
    : setUncontrolledOpen;
  const [selectedGuardianId, setSelectedGuardianId] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const handleLinkSubmit = async () => {
    if (!selectedGuardianId || linking) return;
    setLinking(true);
    setLinkError(null);
    try {
      await onLink(studentId, selectedGuardianId);
      setOpen(false);
      setSelectedGuardianId("");
    } catch (err) {
      setLinkError(
        err instanceof Error
          ? err.message
          : "Veli bağlama işlemi başarısız oldu."
      );
    } finally {
      setLinking(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded-lg px-2 py-1 text-blue-600 transition hover:bg-blue-50"
        >
          {/* Boyut span'da: `index.css`'teki katmansız `button { font: inherit }`. */}
          <span className="text-[11px] font-semibold">+ Veli bağla</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-4" align="end">
        <div className="space-y-3">
          <div>
            <h4 className="text-xs font-bold text-slate-800">Veli Bağla</h4>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Öğrenciye bağlanacak veliyi seçin.
            </p>
          </div>
          {guardians.length === 0 ? (
            <p className="py-1 text-[11px] text-slate-500">
              Bağlanabilir başka veli kaydı bulunmuyor.
            </p>
          ) : (
            <div className="space-y-2">
              <select
                value={selectedGuardianId}
                onChange={e => setSelectedGuardianId(e.target.value)}
                disabled={linking}
                className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs outline-none"
              >
                <option value="">Veli seçin…</option>
                {guardians.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.fullName}
                  </option>
                ))}
              </select>
              {linkError ? (
                <p className="text-[11px] font-semibold text-rose-600">
                  {linkError}
                </p>
              ) : null}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={linking}
                  className="rounded-md px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  onClick={() => void handleLinkSubmit()}
                  disabled={!selectedGuardianId || linking}
                  className="rounded-md bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {linking ? "Bağlanıyor…" : "Bağla"}
                </button>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function StudentDetail({
  student,
  onClose,
  role,
  studentGuardians,
  availableGuardians = [],
  onLinkGuardian,
  onUnlinkGuardian,
  isLinkGuardianOpen,
}: StudentDetailProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/30 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${student.name} öğrenci profili`}
    >
      <button
        onClick={onClose}
        aria-label="Profili kapat"
        className="absolute inset-0"
      />
      <aside className="relative h-full w-full max-w-[480px] overflow-y-auto bg-white p-6 shadow-2xl sm:rounded-2xl">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-3 pr-10">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-blue-50 text-[14px] font-extrabold text-blue-700">
            {student.name
              .split(" ")
              .map(word => word[0])
              .join("")}
          </span>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.13em] text-blue-600">
              Öğrenci profili
            </p>
            <h2 className="mt-1 font-display text-[22px] font-extrabold tracking-[-.04em] text-slate-900">
              {student.name}
            </h2>
            {student.group || student.code ? (
              <p className="mt-1 text-[11px] text-slate-500">
                {[student.group, student.code].filter(Boolean).join(" · ")}
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {/* Öğrencinin KENDİ giriş hesabı — velininki aşağıda. */}
              {student.hasAccount === true ? (
                <Badge tone="green">Giriş hesabı bağlı</Badge>
              ) : student.hasAccount === false ? (
                <Badge tone="slate">Giriş hesabı yok</Badge>
              ) : null}
              {!student.group ? <Badge tone="amber">Sınıfsız</Badge> : null}
            </div>
          </div>
        </div>
        {isDemoMode ? (
          <>
            {student.attendance !== undefined || student.score !== undefined ? (
              <div className="mt-6 grid grid-cols-2 gap-3">
                {student.attendance !== undefined ? (
                  <StatCard
                    label="Devam"
                    value={`%${student.attendance}`}
                    detail="Bu dönem"
                    icon={ClipboardCheck}
                    tone={student.attendance < 90 ? "amber" : "green"}
                  />
                ) : null}
                {student.score !== undefined ? (
                  <StatCard
                    label="Son sınav"
                    value={
                      student.latestExamMaxScore !== null &&
                      student.latestExamMaxScore !== undefined
                        ? `${student.score} / ${student.latestExamMaxScore}`
                        : String(student.score)
                    }
                    detail={
                      [
                        student.latestExamName,
                        formatTrDate(student.latestExamDate),
                      ]
                        .filter(Boolean)
                        .join(" · ") || undefined
                    }
                    icon={BarChart3}
                    tone="violet"
                  />
                ) : null}
              </div>
            ) : null}
          </>
        ) : (
          <StudentProfileSummary studentId={student.id} role={role} />
        )}
        <section className="mt-6 rounded-xl border border-slate-200 p-4">
          <h3 className="text-[12px] font-extrabold text-slate-800">
            Takip özeti
          </h3>
          <div className="mt-3 space-y-3 text-[11px]">
            {student.parent ? (
              <div className="flex justify-between">
                <span className="text-slate-400">Veli</span>
                <span className="font-bold text-slate-700">
                  {student.parent}
                </span>
              </div>
            ) : null}
            {student.homework !== undefined ? (
              <div className="flex justify-between">
                <span className="text-slate-400">Ödev tamamlama</span>
                <span className="font-bold text-slate-700">
                  {student.homework}
                </span>
              </div>
            ) : null}
            {student.payment ? (
              <div className="flex justify-between">
                <span className="text-slate-400">Ödeme durumu</span>
                <Badge tone={student.payment === "Güncel" ? "green" : "amber"}>
                  {student.payment}
                </Badge>
              </div>
            ) : null}
            {student.risk ? (
              <div className="flex justify-between">
                <span className="text-slate-400">Akademik sinyal</span>
                <Badge tone={student.risk === "Dengeli" ? "green" : "amber"}>
                  {student.risk}
                </Badge>
              </div>
            ) : null}
          </div>
        </section>
        {(studentGuardians !== undefined || role === "admin") && (
          <section className="mt-6 rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[12px] font-extrabold text-slate-800">
                Veliler
              </h3>
              {role === "admin" && onLinkGuardian ? (
                <LinkGuardianPopover
                  studentId={student.id}
                  guardians={availableGuardians}
                  onLink={onLinkGuardian}
                  open={isLinkGuardianOpen}
                />
              ) : null}
            </div>
            {studentGuardians && studentGuardians.length > 0 ? (
              <div className="mt-3 divide-y divide-slate-100">
                {studentGuardians.map(link => (
                  <div
                    key={link.id}
                    className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        {link.guardian?.fullName ? (
                          <span className="text-[12px] font-semibold text-slate-800">
                            {link.guardian.fullName}
                          </span>
                        ) : (
                          <span className="font-sans font-normal italic text-slate-400">
                            adı okunamadı
                          </span>
                        )}
                        {!link.guardian?.hasAccount ? (
                          <Badge tone="slate">Hesap bağlı değil</Badge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {link.guardian?.phone ? (
                          link.guardian.phone
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </p>
                    </div>
                    {role === "admin" && onUnlinkGuardian ? (
                      <button
                        type="button"
                        onClick={() =>
                          void onUnlinkGuardian(
                            link.id,
                            link.guardian?.fullName || "veli"
                          )
                        }
                        className="rounded-lg px-2 py-1 text-rose-600 transition hover:bg-rose-50"
                      >
                        <span className="text-[11px] font-semibold">
                          Bağı kopar
                        </span>
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-slate-400">
                Kayıtlı veli bağı bulunmuyor.
              </p>
            )}
          </section>
        )}
      </aside>
    </div>
  );
}
