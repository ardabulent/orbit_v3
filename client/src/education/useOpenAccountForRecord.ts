import { useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth/useAuth";
import { settingsKeys } from "@/settings/settingsQueries";
import {
  openAccountForRecord,
  type OpenAccountInput,
  type OpenAccountResult,
} from "./accountForRecord";
import { educationKeys } from "./educationQueries";

/**
 * Kayda hesap açma ve listeleri tazeleme (ana plan 1.7).
 *
 * Tazeleme bilerek AYRI: hesap bağlanınca satır "hesap var" hâline geçer ve
 * "Giriş hesabı ata" penceresi satırdan kalkar. Liste hemen tazelenseydi giriş
 * fişi pencereyle birlikte kaybolurdu — geçici şifre yalnız bir kez üretilir.
 * Çağıran, fiş kapatıldığında `refresh`'i çağırır.
 */
export function useOpenAccountForRecord() {
  const queryClient = useQueryClient();
  const { identity } = useAuth();
  const organizationId = identity?.membership?.organizationId ?? "";
  // Aynı kayıt için yeniden deneme aynı anahtarı taşır; sunucu ikinci hesap
  // açmaz (v1.2-17). Başarıda düşer: bir sonraki açış gerçekten yenidir.
  const keys = useRef(new Map<string, string>());

  const open = async (input: OpenAccountInput): Promise<OpenAccountResult> => {
    const key = keys.current.get(input.recordId) ?? crypto.randomUUID();
    keys.current.set(input.recordId, key);
    const result = await openAccountForRecord(input, key);
    keys.current.delete(input.recordId);
    return result;
  };

  const refresh = () =>
    Promise.all(
      [
        educationKeys.students(organizationId),
        educationKeys.guardians(organizationId),
        educationKeys.studentGuardians(organizationId),
        educationKeys.adminOverview(organizationId),
        settingsKeys.members(organizationId),
      ].map(queryKey => queryClient.invalidateQueries({ queryKey }))
    );

  return { open, refresh };
}
