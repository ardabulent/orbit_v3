import { useState } from "react";
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
import { createSubject } from "@/education/subjectService";
import {
  planSubjectNames,
  SUBJECT_NAME_MAX,
  suggestSubjectGroups,
} from "./commonSubjects";

/**
 * "Yeni ders" diyaloğu: hazır listeden bir veya birkaç ders seçilir, listede
 * olmayan elle yazılır (karar 2026-09-28).
 *
 * Dersler tek tek oluşturulur; biri başarısız olursa diğerleri geri
 * alınmaz. Oluşanlar seçimden düşer, başarısız olan seçili kalır ve hatası
 * yazılır — yönetici yalnız kalanı yeniden dener.
 */
export function AddSubjectDialog({
  open,
  onOpenChange,
  organizationId,
  existingNames,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string | undefined;
  /** Kurumdaki açık derslerin adları; önerilerden düşülür. */
  existingNames: string[];
  onCreated: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [typed, setTyped] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groups = suggestSubjectGroups(existingNames);
  const plan = planSubjectNames(selected, typed, existingNames);
  const count = plan.error ? 0 : plan.names.length;

  // Form kapanırken sıfırlanır; açan düğme sayfa başlığında olduğu için
  // açılış anını bu bileşen görmez.
  const setOpen = (next: boolean) => {
    if (!next) {
      setSelected([]);
      setTyped("");
      setError(null);
    }
    onOpenChange(next);
  };

  const toggle = (name: string) => {
    setError(null);
    setSelected(current =>
      current.includes(name)
        ? current.filter(item => item !== name)
        : [...current, name]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) return;
    if (plan.error) {
      setError(plan.error);
      return;
    }

    setLoading(true);
    setError(null);
    const created: string[] = [];
    let failure: { name: string; message: string } | null = null;

    for (const name of plan.names) {
      try {
        const subject = await createSubject({ organizationId, name });
        created.push(subject.name);
      } catch (err) {
        failure = {
          name,
          message: err instanceof Error ? err.message : "Ders oluşturulamadı.",
        };
        break;
      }
    }

    if (created.length > 0) {
      await onCreated();
      toast.success(
        created.length === 1 ? "Ders oluşturuldu" : "Dersler oluşturuldu",
        { description: created.join(", ") }
      );
    }
    setLoading(false);

    if (failure) {
      const done = new Set(created);
      setSelected(current => current.filter(name => !done.has(name)));
      if (done.has(typed.trim())) setTyped("");
      setError(`"${failure.name}" eklenemedi: ${failure.message}`);
      return;
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[520px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Yeni ders ekle</DialogTitle>
            <DialogDescription>
              Sık okutulan derslerden seçin ya da listede olmayanı yazın. Bir
              seferde birden çok ders ekleyebilirsiniz.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {groups.length > 0 ? (
              <div className="grid gap-3">
                {groups.map(group => (
                  <div key={group.label}>
                    <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[.12em] text-slate-400">
                      {group.label}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {group.subjects.map(name => {
                        const isOn = selected.includes(name);
                        return (
                          <button
                            key={name}
                            type="button"
                            onClick={() => toggle(name)}
                            disabled={loading}
                            aria-pressed={isOn}
                            className={`rounded-full border px-3 py-1 transition disabled:opacity-50 ${
                              isOn
                                ? "border-blue-600 bg-blue-600 text-white"
                                : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50"
                            }`}
                          >
                            <span className="text-[11px] font-semibold">
                              {name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="grid gap-2">
              <Label htmlFor="new-subject-name">
                {groups.length > 0 ? "Listede yoksa ders adı" : "Ders adı"}
              </Label>
              <Input
                id="new-subject-name"
                value={typed}
                onChange={e => {
                  setError(null);
                  setTyped(e.target.value);
                }}
                placeholder="Örn: Rehberlik, Paragraf"
                disabled={loading}
                maxLength={SUBJECT_NAME_MAX}
              />
            </div>

            {error ? (
              <div
                role="alert"
                className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-[12px] text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300"
              >
                {error}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={loading}
              className="h-9 rounded-lg border border-slate-200 px-4 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-9 items-center justify-center rounded-lg bg-blue-600 px-4 text-[12px] font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {loading
                ? "Ekleniyor…"
                : count > 1
                  ? `${count} dersi ekle`
                  : "Ders ekle"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
