import { useSyncExternalStore } from "react";
import type { AccountRecordKind } from "@/education/accountForRecord";

/**
 * "Bu kayda hesap aç" isteği — satırdan sayfaya (ana plan 1.7).
 *
 * Pencere satırın içinde yaşayamaz: hesap bağlanınca kurum kanalı listeyi
 * kendiliğinden tazeler (realtime), satır "hesap var" hâline geçer ve satırdaki
 * bileşenle birlikte giriş fişi de kaybolur — geçici şifre bir daha gösterilmez.
 * Bunu tarayıcıda yaşadık (2026-10-23). İstek bu küçük depoya yazılır; pencereyi
 * sayfada sabit duran `OpenAccountHost` çizer.
 */
export type OpenAccountRequest = {
  kind: AccountRecordKind;
  recordId: string;
  recordName: string;
  branchId: string | null;
};

let current: OpenAccountRequest | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(listener => listener());
}

export function requestOpenAccount(request: OpenAccountRequest) {
  current = request;
  emit();
}

export function clearOpenAccountRequest() {
  current = null;
  emit();
}

export function useOpenAccountRequest(): OpenAccountRequest | null {
  return useSyncExternalStore(
    listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
    () => null
  );
}
