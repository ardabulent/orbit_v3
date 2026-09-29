import {
  AUDIT_ACTION_KIND_LABELS,
  AUDIT_ENTITY_OPTIONS,
  EMPTY_AUDIT_FILTERS,
  type AuditActionKind,
  type AuditFilters,
} from "@/audit/auditService";

const SELECT =
  "h-9 min-w-40 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-semibold text-slate-700";

/**
 * Denetim Kaydı süzgeci (karar 2026-09-29): kim yaptı, işlem türü, kayıt
 * türü, tarih aralığı. Süzme sunucuda yapılır; burada yalnız seçim tutulur.
 */
export function AuditFiltersBar({
  filters,
  onChange,
  actors,
}: {
  filters: AuditFilters;
  onChange: (filters: AuditFilters) => void;
  actors: { id: string; name: string }[];
}) {
  const active = Object.values(filters).some(value => value !== null);

  return (
    <div className="mt-6 flex flex-wrap items-end gap-3">
      <label className="grid gap-1 text-[11px] font-bold text-slate-500">
        Kim yaptı
        <select
          value={filters.actorUserId ?? ""}
          onChange={e =>
            onChange({ ...filters, actorUserId: e.target.value || null })
          }
          className={SELECT}
        >
          <option value="">Herkes</option>
          {actors.map(actor => (
            <option key={actor.id} value={actor.id}>
              {actor.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-[11px] font-bold text-slate-500">
        İşlem türü
        <select
          value={filters.actionKind ?? ""}
          onChange={e =>
            onChange({
              ...filters,
              actionKind: (e.target.value || null) as AuditActionKind | null,
            })
          }
          className={SELECT}
        >
          <option value="">Hepsi</option>
          {Object.entries(AUDIT_ACTION_KIND_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-[11px] font-bold text-slate-500">
        Kayıt türü
        <select
          value={filters.entityType ?? ""}
          onChange={e =>
            onChange({ ...filters, entityType: e.target.value || null })
          }
          className={SELECT}
        >
          <option value="">Hepsi</option>
          {AUDIT_ENTITY_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-[11px] font-bold text-slate-500">
        Başlangıç
        <input
          type="date"
          value={filters.from ?? ""}
          max={filters.to ?? undefined}
          onChange={e => onChange({ ...filters, from: e.target.value || null })}
          className={SELECT}
        />
      </label>
      <label className="grid gap-1 text-[11px] font-bold text-slate-500">
        Bitiş
        <input
          type="date"
          value={filters.to ?? ""}
          min={filters.from ?? undefined}
          onChange={e => onChange({ ...filters, to: e.target.value || null })}
          className={SELECT}
        />
      </label>
      {active ? (
        <button
          type="button"
          onClick={() => onChange(EMPTY_AUDIT_FILTERS)}
          className="h-9 rounded-lg px-3 text-blue-600 hover:bg-blue-50"
        >
          <span className="text-[12px] font-bold">Süzgeci temizle</span>
        </button>
      ) : null}
    </div>
  );
}
