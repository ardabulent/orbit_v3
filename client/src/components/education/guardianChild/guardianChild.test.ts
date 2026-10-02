import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

(globalThis as unknown as { React: typeof React }).React = React;

import type { Student } from "../types";
import { ChildSwitcher } from "./ChildSwitcher";
import {
  GuardianChildContext,
  pickChild,
  type GuardianChildState,
} from "./guardianChildState";

const student = (id: string, name: string): Student => ({
  id,
  name,
  group: null,
  branch: null,
  parent: null,
});

const SELIN = student("s1", "Selin Koç");
const EMRE = student("s2", "Emre Koç");

const state = (over: Partial<GuardianChildState>): GuardianChildState => ({
  active: true,
  children: [SELIN, EMRE],
  child: SELIN,
  select: () => undefined,
  classIds: new Set(),
  isLoading: false,
  isError: false,
  retry: () => undefined,
  ...over,
});

const render = (value: GuardianChildState, variant?: "compact") =>
  renderToStaticMarkup(
    createElement(
      GuardianChildContext.Provider,
      { value },
      createElement(ChildSwitcher, variant ? { variant } : {})
    )
  );

describe("velinin seçili çocuğu (2026-10-02)", () => {
  it("kayıtlı seçim listedeyse o, değilse ilk çocuk", () => {
    expect(pickChild([SELIN, EMRE], "s2")).toBe(EMRE);
    expect(pickChild([SELIN, EMRE], "bağı-kaldırılmış")).toBe(SELIN);
    expect(pickChild([SELIN, EMRE], null)).toBe(SELIN);
    expect(pickChild([], "s1")).toBeNull();
  });

  it("iki çocuklu veliye üst çubukta adlar, seçili olan işaretli", () => {
    const html = render(state({ child: EMRE }));
    expect(html).toContain("Selin Koç");
    expect(html).toContain('aria-selected="true"');
    expect(html.indexOf('aria-selected="true"')).toBeGreaterThan(
      html.indexOf("Selin Koç")
    );
  });

  it("telefonda açılır liste", () => {
    const html = render(state({}), "compact");
    expect(html).toContain("<select");
    expect(html).toContain("Emre Koç");
  });

  it("tek çocuklu veliye ve veli olmayana seçici gösterilmez", () => {
    expect(render(state({ children: [SELIN] }))).toBe("");
    expect(render(state({ active: false }))).toBe("");
  });
});
