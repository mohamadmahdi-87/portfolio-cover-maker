import { describe, expect, it } from "vitest";
import { createDefaultLayer } from "./defaults";
import { naturalImageRect, outputDimensions, safeCanvasPoint, validateImageDimensions } from "./geometry";

describe("cover geometry", () => {
  it("scales exact export dimensions", () => {
    expect(outputDimensions(1)).toEqual({ width: 1080, height: 848 });
    expect(outputDimensions(2)).toEqual({ width: 2160, height: 1696 });
    expect(outputDimensions(3)).toEqual({ width: 3240, height: 2544 });
  });

  it("fits tall screenshots to width and preserves their aspect ratio", () => {
    const layer = { ...createDefaultLayer("front"), contentOffsetY: 120 };
    const rect = naturalImageRect(layer, {
      id: "sample",
      name: "sample.png",
      mime: "image/png",
      width: 480,
      height: 1800,
      size: 10,
    });
    expect(rect.width).toBe(484);
    expect(rect.height).toBeCloseTo((1800 / 480) * 484);
    expect(rect.x).toBe(409);
    expect(rect.y).toBe(30);
  });

  it("clamps invalid dimensions and preview drag coordinates", () => {
    expect(validateImageDimensions(0, 500)).toContain("معتبر");
    expect(validateImageDimensions(6000, 6000)).toContain("بیش از حد بزرگ");
    expect(safeCanvasPoint(-50, 900, { left: 0, top: 0, width: 500, height: 400 } as DOMRect)).toEqual({
      x: 0,
      y: 848,
    });
    expect(safeCanvasPoint(250, 200, { left: 0, top: 0, width: 500, height: 400 } as DOMRect)).toEqual({
      x: 540,
      y: 424,
    });
  });
});
