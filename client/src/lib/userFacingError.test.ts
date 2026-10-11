import { describe, expect, it } from "vitest";
import {
  isNetworkError,
  NETWORK_ERROR_TEXT,
  userFacingErrorText,
} from "./userFacingError";

describe("userFacingErrorText", () => {
  it("internet kesilince Türkçe bağlantı mesajı verir", () => {
    expect(userFacingErrorText(new Error("TypeError: Failed to fetch"))).toBe(
      NETWORK_ERROR_TEXT
    );
    expect(userFacingErrorText({ message: "Load failed" })).toBe(
      NETWORK_ERROR_TEXT
    );
    expect(userFacingErrorText({ message: "network unreachable" })).toBe(
      NETWORK_ERROR_TEXT
    );
    expect(isNetworkError(new Error("NetworkError when attempting"))).toBe(
      true
    );
  });

  it("veritabanının Türkçe uyarısını aynen geçirir", () => {
    expect(
      userFacingErrorText(new Error("Bağlama kodunun süresi dolmuş."))
    ).toBe("Bağlama kodunun süresi dolmuş.");
  });

  it("İngilizce teknik metni geçirmez", () => {
    expect(userFacingErrorText(new Error("numeric field overflow"))).toBeNull();
    expect(
      userFacingErrorText({
        message: 'duplicate key value violates unique constraint "x"',
      })
    ).toBeNull();
    expect(userFacingErrorText(new Error(""))).toBeNull();
    expect(userFacingErrorText(undefined)).toBeNull();
  });
});
