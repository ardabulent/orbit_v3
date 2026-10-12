/**
 * Düzenleme sürerken aynı verinin başka bir yerde değiştiğini söyler
 * (2026-10-12). Canlı güncelleme kullanıcının yazdıklarını ezmez; seçimi ona
 * bırakır: kaydederse kendi girdikleri geçerli olur, ya da bırakıp güncelini
 * görür.
 */
export function RemoteChangeNotice({ onDiscard }: { onDiscard: () => void }) {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-5 py-2.5 text-[12px] text-amber-900"
    >
      <span>
        Siz düzenlerken bu sınavın sonuçları başka bir yerde güncellendi.
        Kaydederseniz sizin girdikleriniz geçerli olur.
      </span>
      <button
        type="button"
        onClick={onDiscard}
        className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-bold text-amber-900 transition hover:bg-amber-100"
      >
        Değişikliklerimi bırak, güncelini göster
      </button>
    </div>
  );
}
