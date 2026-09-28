import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { educationKeys } from "./educationQueries";

describe("B16 / C-08: duyuru panosu paylaşımdan sonra yenilenir", () => {
  it("feed(org) ile geçersiz kılmak listenin {includeArchived:false} anahtarına ulaşır", async () => {
    const client = new QueryClient();
    const listKey = educationKeys.feed("org-1", { includeArchived: false });
    const archivedKey = educationKeys.feed("org-1", { includeArchived: true });
    const otherOrg = educationKeys.feed("org-2", { includeArchived: false });
    client.setQueryData(listKey, { rows: [] });
    client.setQueryData(archivedKey, { rows: [] });
    client.setQueryData(otherOrg, { rows: [] });

    await client.invalidateQueries({ queryKey: educationKeys.feed("org-1") });

    expect(client.getQueryState(listKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(archivedKey)?.isInvalidated).toBe(true);
    // Başka kurumun panosuna dokunulmaz.
    expect(client.getQueryState(otherOrg)?.isInvalidated).toBe(false);
  });

  it("anahtara boş alan yazılmaz", () => {
    expect(educationKeys.feed("org-1")).toEqual([
      "education",
      "feed",
      { organizationId: "org-1" },
    ]);
  });
});
