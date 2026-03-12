import { describe, it, expect } from "vitest";
import { isoNow, formatDuration, formatTimestamp } from "../util/time.js";

describe("isoNow", () => {
  it("returns an ISO 8601 string", () => {
    const result = isoNow();
    expect(() => new Date(result)).not.toThrow();
    expect(result).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

describe("formatDuration", () => {
  it("formats minutes under 60", () => {
    expect(formatDuration(5 * 60_000)).toBe("5 min");
    expect(formatDuration(0)).toBe("0 min");
  });

  it("formats exact hours", () => {
    expect(formatDuration(120 * 60_000)).toBe("2h");
  });

  it("formats hours and remaining minutes", () => {
    expect(formatDuration(90 * 60_000)).toBe("1h 30m");
  });
});

describe("formatTimestamp", () => {
  it("returns HH:MM format", () => {
    const result = formatTimestamp("2024-01-15T09:05:00.000Z");
    expect(result).toMatch(/^\d{2}:\d{2}$/);
  });
});
