import { describe, expect, it } from "vitest";
import { connectionNotice } from "./connectionNotice";

describe("connectionNotice (v1.5-12)", () => {
  it("internet yoksa kanal durumundan bağımsız olarak söyler", () => {
    for (const channelStatus of ["SUBSCRIBED", "CONNECTING", "CLOSED"] as const) {
      expect(connectionNotice({ online: false, channelStatus })?.kind).toBe(
        "offline"
      );
    }
  });

  it("canlı kanal düştüyse söyler", () => {
    for (const channelStatus of [
      "TIMED_OUT",
      "CLOSED",
      "CHANNEL_ERROR",
    ] as const) {
      expect(connectionNotice({ online: true, channelStatus })?.kind).toBe(
        "live-paused"
      );
    }
  });

  it("bağlıyken, bağlanırken ya da kanal kapalıyken (demo) susar", () => {
    for (const channelStatus of ["SUBSCRIBED", "CONNECTING", "IDLE"] as const) {
      expect(connectionNotice({ online: true, channelStatus })).toBeNull();
    }
  });
});
