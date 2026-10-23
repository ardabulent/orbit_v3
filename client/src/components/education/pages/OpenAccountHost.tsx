import { OpenAccountDialog } from "./OpenAccountDialog";
import {
  clearOpenAccountRequest,
  useOpenAccountRequest,
} from "./openAccountRequest";

/**
 * Hesap açma penceresinin sayfadaki sabit yeri (ana plan 1.7). Öğrenciler
 * sayfasında bir kez durur; satırlar tazelense de pencere ve içindeki giriş
 * fişi yerinde kalır. Ayrıntı: `openAccountRequest.ts`.
 */
export function OpenAccountHost() {
  const request = useOpenAccountRequest();
  if (!request) return null;
  return (
    <OpenAccountDialog
      key={request.recordId}
      kind={request.kind}
      recordId={request.recordId}
      recordName={request.recordName}
      branchId={request.branchId}
      onClose={clearOpenAccountRequest}
    />
  );
}
