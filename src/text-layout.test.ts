import { describe, expect, it } from "vitest";
import { fitText, textDirection } from "./text-layout";

const measurementContext = () => {
  const context = {
    font: "600 44px sans-serif",
    measureText(text: string) {
      const size = Number(this.font.match(/([0-9.]+)px/u)?.[1] ?? 44);
      return { width: [...text].length * size * 0.55 };
    },
  };
  return context as unknown as CanvasRenderingContext2D;
};

describe("text layout", () => {
  it("reduces font size before wrapping and limits output to two lines", () => {
    const result = fitText(measurementContext(), "North Star Studio", 180, 44, 20);
    expect(result.fontSize).toBeLessThan(44);
    expect(result.lines.length).toBeLessThanOrEqual(2);
    expect(result.overflow).toBe(false);
  });

  it("keeps a short multiword title on one line when a smaller size prevents row overlap", () => {
    const result = fitText(measurementContext(), "Synthetic Example", 340, 44, 25);
    expect(result.fontSize).toBeLessThan(44);
    expect(result.lines).toEqual(["Synthetic Example"]);
    expect(result.overflow).toBe(false);
  });

  it("reports unbreakable overflow instead of silently dropping it", () => {
    const result = fitText(measurementContext(), "بسیارطولانیبدونفاصله", 70, 44, 20);
    expect(result.overflow).toBe(true);
  });

  it("chooses text direction without reversing Persian text", () => {
    expect(textDirection("پروژهٔ آزمایشی ۱۲", "auto")).toBe("rtl");
    expect(textDirection("Portfolio Studio", "auto")).toBe("ltr");
    expect(textDirection("Studio", "rtl")).toBe("rtl");
  });
});
