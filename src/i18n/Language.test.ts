import { describe, expect, it } from "vitest";
import { translate } from "./Language";

describe("display ticker", () => {
  it("uses PEARL for standalone ticker text in both languages", () => {
    expect(translate("$PRL / PRL", "zh")).toBe("$PEARL / PEARL");
    expect(translate("123 PRL", "en")).toBe("123 PEARL");
  });

  it("preserves API identifiers, source names and address prefixes", () => {
    expect(translate("prl_btc prlstats prl1abc", "zh")).toBe("prl_btc prlstats prl1abc");
  });
});
