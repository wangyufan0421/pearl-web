import { describe, expect, it } from "vitest";
import { formatBlockDeviation, formatHashrate, formatUsd } from "./format";

describe("data formatters", () => {
  it("formats exahashes", () => {
    expect(formatHashrate(4.78e19)).toBe("47.8 EH/s");
  });

  it("formats small dollar values", () => {
    expect(formatUsd(0.5594)).toBe("$0.56");
  });

  it("marks a slower-than-target block interval", () => {
    expect(formatBlockDeviation(204.2, 194)).toContain("慢");
  });
});
