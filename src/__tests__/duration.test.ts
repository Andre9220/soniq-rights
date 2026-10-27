import { describe, expect, it } from "vitest";
import { formatDuration, parseDuration } from "@/lib/audio/duration";

describe("formatDuration", () => {
  it.each([
    [0, "0:00"],
    [5, "0:05"],
    [59.4, "0:59"],
    [59.6, "1:00"],
    [222.3, "3:42"],
    [600, "10:00"],
    [3725, "1:02:05"],
  ])("%s s → %s", (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });

  it("returns an empty string for invalid durations", () => {
    expect(formatDuration(NaN)).toBe("");
    expect(formatDuration(Infinity)).toBe("");
    expect(formatDuration(-1)).toBe("");
  });
});

describe("parseDuration", () => {
  it.each([
    ["3:42", 222],
    ["03:42", 222],
    ["0:05", 5],
    ["1:02:05", 3725],
    ["185", 185],
    [" 4:00 ", 240],
  ])("%s → %s s", (input, expected) => {
    expect(parseDuration(input)).toBe(expected);
  });

  it.each(["", "3:", "3:60", "abc", "3.42", "1:60:00", "1:2:3:4", "-3:00"])("rejects %j", (input) => {
    expect(parseDuration(input)).toBeNull();
  });

  it("round-trips with formatDuration", () => {
    for (const s of [1, 61, 222, 3599, 3725]) expect(parseDuration(formatDuration(s))).toBe(s);
  });
});
