import { useState } from "react";
import { Badge, EmptyState } from "../shared";
import type { ClassGroup, Homework } from "../types";
import { groupStaffHomework } from "./homeworkGroups";
import { HomeworkGroup, HomeworkRow } from "./HomeworkRow";

/**
 * Yönetici ve öğretmenin Ödevler listesi (karar 2026-09-29):
 *   Kontrol bekleyen — teslim tarihi geçmiş, işaretlemesi bitmemiş
 *   Aktif            — teslim tarihi bugün ya da ileride
 *   Kontrolü biten   — işaretlemesi bitmiş; teslim oranı burada anlamlı
 */
export function StaffHomeworkList({
  items,
  today,
  classes,
  archivingId,
  onManageSubmissions,
  onEdit,
  onArchive,
}: {
  items: Homework[];
  today: string;
  classes: ClassGroup[];
  archivingId: string | null;
  onManageSubmissions: (item: Homework) => void;
  onEdit: (item: Homework) => void;
  onArchive: (item: Homework) => void;
}) {
  const [classFilter, setClassFilter] = useState("");
  const shown = classFilter
    ? items.filter(item => item.classId === classFilter)
    : items;
  const groups = groupStaffHomework(shown, today);
  const showClass = !classFilter;

  const actions = (item: Homework, primary: boolean) => (
    <>
      <button
        type="button"
        onClick={() => onManageSubmissions(item)}
        className={`rounded-lg px-3 py-1.5 transition ${
          primary
            ? "bg-slate-900 text-white hover:bg-slate-800"
            : "border border-slate-200 text-slate-700 hover:bg-slate-50"
        }`}
      >
        <span className="text-[11px] font-bold">
          {primary ? "Teslimleri işaretle" : "Teslimler"}
        </span>
      </button>
      <button
        type="button"
        onClick={() => onEdit(item)}
        className="text-slate-500 hover:text-slate-800"
      >
        <span className="text-[11px] font-semibold">Düzenle</span>
      </button>
      <button
        type="button"
        onClick={() => onArchive(item)}
        disabled={archivingId === item.id}
        className="text-rose-600 hover:text-rose-800 disabled:opacity-50"
      >
        <span className="text-[11px] font-semibold">
          {archivingId === item.id ? "Arşivleniyor…" : "Arşivle"}
        </span>
      </button>
    </>
  );

  return (
    <div className="mt-6">
      {classes.length > 1 ? (
        <label className="mb-4 flex items-center gap-2 text-[11px] font-bold text-slate-500">
          Sınıf
          <select
            value={classFilter}
            onChange={e => setClassFilter(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[12px] font-semibold text-slate-800"
          >
            <option value="">Tümü</option>
            {classes.map(cls => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {shown.length === 0 ? (
        <EmptyState
          title="Görüntülenecek ödev bulunmuyor"
          description="Sayfa başlığındaki 'Yeni ödev' ile ödev verin."
        />
      ) : (
        <div className="space-y-6">
          <HomeworkGroup
            title="Kontrol bekleyen"
            count={groups.toCheck.length}
            empty="Teslimi kontrol edilmeyi bekleyen ödev yok."
          >
            {groups.toCheck.map(item => (
              <HomeworkRow
                key={item.id}
                homework={item}
                showClass={showClass}
                aside={
                  <>
                    <Badge tone="amber">Teslim tarihi geçti</Badge>
                    {actions(item, true)}
                  </>
                }
              />
            ))}
          </HomeworkGroup>
          <HomeworkGroup
            title="Aktif"
            count={groups.active.length}
            empty="Teslimi bekleyen ödev yok."
          >
            {groups.active.map(item => (
              <HomeworkRow
                key={item.id}
                homework={item}
                showClass={showClass}
                aside={actions(item, false)}
              />
            ))}
          </HomeworkGroup>
          <HomeworkGroup
            title="Kontrolü biten"
            count={groups.done.length}
            empty="İşaretlemesi bitmiş ödev yok."
          >
            {groups.done.map(item => (
              <HomeworkRow
                key={item.id}
                homework={item}
                showClass={showClass}
                aside={
                  <>
                    {item.submissionCount !== undefined ? (
                      <Badge tone="green">
                        {item.submissionCount}
                        {item.totalStudents !== undefined
                          ? ` / ${item.totalStudents}`
                          : ""}{" "}
                        teslim
                      </Badge>
                    ) : null}
                    {actions(item, false)}
                  </>
                }
              />
            ))}
          </HomeworkGroup>
        </div>
      )}
    </div>
  );
}
