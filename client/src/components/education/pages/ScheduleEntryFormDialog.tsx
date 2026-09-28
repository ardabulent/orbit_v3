import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { educationKeys, useSubjects } from "@/education/educationQueries";
import { useSettingsMembers } from "@/settings/settingsQueries";
import {
  createScheduleEntry,
  updateScheduleEntry,
} from "@/education/scheduleService";
import { WEEK_DAYS, weekDayToIso, type WeekDay } from "@/education/weekDays";
import type { ScheduleItem } from "../types";
import { eligibleTeachers } from "./teacherEligibility";
import { TeacherOptionGroups } from "./TeacherOptionGroups";

export type ScheduleEntryFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  classes: { id: string; name: string }[];
  entry?: ScheduleItem | null;
  defaultDay?: WeekDay;
  onDone?: () => void;
};

export function ScheduleEntryFormDialog({
  open,
  onOpenChange,
  organizationId,
  classes,
  entry,
  defaultDay = "Pazartesi",
  onDone,
}: ScheduleEntryFormDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = Boolean(entry?.id);

  const [classId, setClassId] = useState("");
  const [day, setDay] = useState<WeekDay>(defaultDay);
  const [startsAt, setStartsAt] = useState("09:00");
  const [endsAt, setEndsAt] = useState("");
  const [subjectMode, setSubjectMode] = useState<"subject" | "title">(
    "subject"
  );
  const [subjectId, setSubjectId] = useState("");
  const [title, setTitle] = useState("");
  const [membershipId, setMembershipId] = useState("");
  const [room, setRoom] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Kurum dersleri
  const subjectsQuery = useSubjects({
    organizationId,
    enabled: open,
  });
  const rawSubjects = subjectsQuery.data?.rows;
  const subjects = useMemo(() => rawSubjects ?? [], [rawSubjects]);

  // Kurum öğretmenleri (yalnızca admin ve teacher)
  const membersQuery = useSettingsMembers({
    organizationId,
    enabled: open,
  });
  const eligibleMembers = eligibleTeachers(membersQuery.data ?? []);

  useEffect(() => {
    if (!open) {
      setError(null);
      return;
    }

    if (entry) {
      setClassId(entry.classId || "");
      setDay(entry.day || defaultDay);
      setStartsAt(
        entry.startsAt
          ? entry.startsAt.slice(0, 5)
          : entry.time
            ? entry.time.slice(0, 5)
            : "09:00"
      );
      setEndsAt(entry.endsAt ? entry.endsAt.slice(0, 5) : "");
      if (entry.subjectId) {
        setSubjectMode("subject");
        setSubjectId(entry.subjectId);
        setTitle("");
      } else {
        setSubjectMode("title");
        setSubjectId("");
        setTitle(entry.title || "");
      }
      setMembershipId(entry.membershipId || "");
      setRoom(entry.room || "");
    } else {
      setClassId(classes[0]?.id || "");
      setDay(defaultDay);
      setStartsAt("09:00");
      setEndsAt("");
      setSubjectMode("subject");
      setSubjectId(subjects[0]?.id || "");
      setTitle("");
      setMembershipId("");
      setRoom("");
    }
    setError(null);
  }, [open, entry, defaultDay, classes, subjects]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) return;

    if (!classId) {
      setError("Lütfen bir sınıf seçin.");
      return;
    }
    if (!startsAt) {
      setError("Lütfen bir başlangıç saati girin.");
      return;
    }
    if (subjectMode === "subject" && !subjectId) {
      setError("Lütfen bir ders seçin veya özel başlık girin.");
      return;
    }
    if (subjectMode === "title" && !title.trim()) {
      setError("Lütfen ders başlığı girin.");
      return;
    }

    const dayOfWeek = weekDayToIso(day);

    setLoading(true);
    setError(null);

    try {
      if (isEditing && entry?.id) {
        await updateScheduleEntry(organizationId, entry.id, {
          dayOfWeek,
          startsAt,
          endsAt: endsAt ? endsAt : null,
          subjectId: subjectMode === "subject" ? subjectId : null,
          title: subjectMode === "title" ? title.trim() : null,
          membershipId: membershipId ? membershipId : null,
          room: room.trim() ? room.trim() : null,
        });

        toast.success("Ders programı güncellendi", {
          description: "Program satırı başarıyla güncellendi.",
        });
      } else {
        await createScheduleEntry({
          organizationId,
          classId,
          dayOfWeek,
          startsAt,
          endsAt: endsAt ? endsAt : null,
          subjectId: subjectMode === "subject" ? subjectId : null,
          title: subjectMode === "title" ? title.trim() : null,
          membershipId: membershipId ? membershipId : null,
          room: room.trim() ? room.trim() : null,
        });

        toast.success("Ders programı eklendi", {
          description: "Yeni program satırı başarıyla eklendi.",
        });
      }

      await queryClient.invalidateQueries({
        queryKey: educationKeys.schedule(organizationId),
      });

      onOpenChange(false);
      onDone?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ders programı kaydedilemedi."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing
                ? "Ders Programı Satırını Düzenle"
                : "Ders Programı Ekle"}
            </DialogTitle>
            <DialogDescription>
              Haftalık programa bir ders veya etüt satırı ekleyin.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Sınıf Seçimi */}
            <div className="grid gap-2">
              <Label htmlFor="schedule-class">Sınıf</Label>
              <select
                id="schedule-class"
                value={classId}
                onChange={e => setClassId(e.target.value)}
                disabled={loading || isEditing}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[12px] text-slate-800 disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sınıf seçin…</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {isEditing ? (
                <span className="text-[10px] text-slate-400">
                  Program satırının sınıfı değiştirilemez; farklı sınıf için
                  yeni satır ekleyin.
                </span>
              ) : null}
            </div>

            {/* Gün ve Saatler */}
            <div className="grid grid-cols-3 gap-2">
              <div className="grid gap-1">
                <Label htmlFor="schedule-day" className="text-[11px]">
                  Gün
                </Label>
                <select
                  id="schedule-day"
                  value={day}
                  onChange={e => setDay(e.target.value as WeekDay)}
                  disabled={loading}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-[12px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {WEEK_DAYS.map(d => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1">
                <Label htmlFor="schedule-starts-at" className="text-[11px]">
                  Başlangıç
                </Label>
                <Input
                  id="schedule-starts-at"
                  type="time"
                  value={startsAt}
                  onChange={e => setStartsAt(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div className="grid gap-1">
                <Label htmlFor="schedule-ends-at" className="text-[11px]">
                  Bitiş (Opsiyonel)
                </Label>
                <Input
                  id="schedule-ends-at"
                  type="time"
                  value={endsAt}
                  onChange={e => setEndsAt(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            {/* Ders veya Özel Başlık */}
            <div className="space-y-2 rounded-xl border border-slate-200 p-3 bg-slate-50/50">
              <div className="flex items-center gap-4 text-[12px]">
                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                  <input
                    type="radio"
                    name="subjectMode"
                    value="subject"
                    checked={subjectMode === "subject"}
                    onChange={() => setSubjectMode("subject")}
                    className="text-blue-600"
                  />
                  Kurum Dersi
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                  <input
                    type="radio"
                    name="subjectMode"
                    value="title"
                    checked={subjectMode === "title"}
                    onChange={() => setSubjectMode("title")}
                    className="text-blue-600"
                  />
                  Özel Başlık (Etüt, Sınav vb.)
                </label>
              </div>

              {subjectMode === "subject" ? (
                <div className="grid gap-1 pt-1">
                  <select
                    id="schedule-subject"
                    value={subjectId}
                    onChange={e => setSubjectId(e.target.value)}
                    disabled={loading || subjectsQuery.isLoading}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[12px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Ders seçin…</option>
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid gap-1 pt-1">
                  <Input
                    id="schedule-title"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Örn: Rehberlik Saati, Genel Deneme, Soru Çözümü"
                    maxLength={120}
                    disabled={loading}
                  />
                </div>
              )}
            </div>

            {/* Öğretmen ve Derslik */}
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1">
                <Label htmlFor="schedule-teacher" className="text-[11px]">
                  Öğretmen (Opsiyonel)
                </Label>
                <select
                  id="schedule-teacher"
                  value={membershipId}
                  onChange={e => setMembershipId(e.target.value)}
                  disabled={loading || membersQuery.isLoading}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-[12px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Öğretmensiz</option>
                  <TeacherOptionGroups members={eligibleMembers} />
                </select>
              </div>

              <div className="grid gap-1">
                <Label htmlFor="schedule-room" className="text-[11px]">
                  Derslik (Opsiyonel)
                </Label>
                <Input
                  id="schedule-room"
                  value={room}
                  onChange={e => setRoom(e.target.value)}
                  placeholder="Örn: A-101, Lab-1"
                  disabled={loading}
                />
              </div>
            </div>

            {error ? (
              <div
                role="alert"
                className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-[12px] text-rose-700"
              >
                {error}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="h-9 rounded-lg border border-slate-200 px-4 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-9 items-center justify-center rounded-lg bg-blue-600 px-4 text-[12px] font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {loading
                ? isEditing
                  ? "Kaydediliyor…"
                  : "Ekleniyor…"
                : isEditing
                  ? "Kaydet"
                  : "Ders Programı Ekle"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
