import { describe, expect, it } from "vitest";
import { typeSecret } from "./debugAccess";

const type = (text: string) =>
  [...text].reduce((state, key) => (state.matched ? state : typeSecret(state.buffer, key)), { buffer: "", matched: false });

describe("debug access", () => {
  it("does not match ordinary typing", () => {
    expect(type("hello there, just playing the game").matched).toBe(false);
    expect(type("clackwork").matched).toBe(false);
  });

  it("ignores keys that are not characters", () => {
    expect(typeSecret("abc", "Shift")).toEqual({ buffer: "abc", matched: false });
    expect(typeSecret("abc", "Enter")).toEqual({ buffer: "abc", matched: false });
  });

  it("only remembers the last few characters", () => {
    expect(type("x".repeat(200)).buffer.length).toBeLessThanOrEqual(11);
  });
});
