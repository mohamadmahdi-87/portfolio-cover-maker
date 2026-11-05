import { describe, expect, it } from "vitest";
import { createDefaultLayer, createDefaultMobileLayer, createDefaultProject } from "./defaults";
import { floatingImageViewportHeight, imageClipRect, mapProjectivePoint, naturalImageRect, outputDimensions, perspectiveQuad, safeCanvasPoint, validateImageDimensions, viewportImageCrop } from "./geometry";

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

  it("uses the social template's square canvas for export, clipping, and pointer mapping", () => {
    const projectId = "instagram-feed" as const;
    expect(outputDimensions(1, projectId)).toEqual({ width: 1080, height: 1080 });
    expect(outputDimensions(3, projectId)).toEqual({ width: 3240, height: 3240 });
    expect(safeCanvasPoint(250, 250, { left: 0, top: 0, width: 500, height: 500 } as DOMRect, projectId)).toEqual({ x: 540, y: 540 });
    const layer = { ...createDefaultLayer("front", projectId), contentOffsetY: 90 };
    const rect = naturalImageRect(layer, { id: "social-shot", name: "shot.png", mime: "image/png", width: 500, height: 1800, size: 10 }, projectId);
    expect(rect).toEqual({ x: 465, y: 155, width: 425, height: 1530 });
    expect(imageClipRect(layer, projectId)).toEqual({ x: -1080, y: 245, width: 3240, height: 835 });
  });

  it("uses the editorial collage's 4:5 canvas and keeps its back-left/front-right stack", () => {
    const projectId = "editorial-collage" as const;
    expect(outputDimensions(1, projectId)).toEqual({ width: 1080, height: 1350 });
    expect(outputDimensions(3, projectId)).toEqual({ width: 3240, height: 4050 });
    expect(safeCanvasPoint(200, 250, { left: 0, top: 0, width: 400, height: 500 } as DOMRect, projectId)).toEqual({ x: 540, y: 675 });
    const back = createDefaultLayer("back", projectId);
    const front = createDefaultLayer("front", projectId);
    expect(back).toMatchObject({ x: 38, y: 0, width: 590 });
    expect(front).toMatchObject({ x: 430, y: 340, width: 610 });
    const image = { id: "collage-shot", name: "shot.png", mime: "image/png" as const, width: 500, height: 1600, size: 10 };
    const rect = naturalImageRect(front, image, projectId);
    expect(rect).toMatchObject({ x: 430, y: 340, width: 610 });
    expect(rect.height).toBeCloseTo((1600 / 500) * 610);
    expect(imageClipRect(front, projectId)).toEqual({ x: -1080, y: 340, width: 3240, height: 1010 });
  });

  it("sets the desktop and mobile showcase to the portfolio's 4:3 dimensions", () => {
    const templateId = "device-showcase" as const;
    const back = createDefaultLayer("back", templateId);
    const front = createDefaultLayer("front", templateId);
    const mobile = createDefaultMobileLayer(templateId);
    expect(outputDimensions(1, templateId)).toEqual({ width: 1080, height: 810 });
    expect(outputDimensions(3, templateId)).toEqual({ width: 3240, height: 2430 });
    expect(safeCanvasPoint(250, 187.5, { left: 0, top: 0, width: 500, height: 375 } as DOMRect, templateId)).toEqual({ x: 540, y: 405 });
    expect(back).toMatchObject({ x: 110, y: 175, width: 480, viewportHeight: 355 });
    expect(front).toMatchObject({ x: 430, y: 165, width: 500, viewportHeight: 370 });
    expect(mobile).toMatchObject({ x: 862, y: 337, width: 148, viewportHeight: 326 });
    const quad = perspectiveQuad(front, front.viewportHeight ?? 370);
    expect(quad.topLeft.y).not.toBe(quad.topRight.y);
    expect(quad.bottomLeft.x).not.toBe(quad.bottomRight.x);

    const neutral = perspectiveQuad({ ...front, rotation: 0, perspective: 0, tilt: 0, yaw: 0 }, 370);
    const turnedRight = perspectiveQuad({ ...front, rotation: 0, perspective: 0, tilt: 0, yaw: 24 }, 370);
    const turnedLeft = perspectiveQuad({ ...front, rotation: 0, perspective: 0, tilt: 0, yaw: -24 }, 370);
    const edgeLength = (start: { x: number; y: number }, end: { x: number; y: number }) => Math.hypot(end.x - start.x, end.y - start.y);
    expect(edgeLength(neutral.topLeft, neutral.bottomLeft)).toBeCloseTo(edgeLength(neutral.topRight, neutral.bottomRight));
    expect(edgeLength(turnedRight.topLeft, turnedRight.bottomLeft)).toBeGreaterThan(edgeLength(turnedRight.topRight, turnedRight.bottomRight));
    expect(edgeLength(turnedLeft.topLeft, turnedLeft.bottomLeft)).toBeLessThan(edgeLength(turnedLeft.topRight, turnedLeft.bottomRight));
  });

  it("maps screenshot corners to a perspective plane without changing the source geometry", () => {
    const quad = {
      topLeft: { x: 80, y: 40 },
      topRight: { x: 330, y: 62 },
      bottomRight: { x: 294, y: 280 },
      bottomLeft: { x: 52, y: 245 },
    };
    expect(mapProjectivePoint(quad, 0, 0)).toMatchObject(quad.topLeft);
    expect(mapProjectivePoint(quad, 1, 0).x).toBeCloseTo(quad.topRight.x);
    expect(mapProjectivePoint(quad, 1, 0).y).toBeCloseTo(quad.topRight.y);
    expect(mapProjectivePoint(quad, 1, 1).x).toBeCloseTo(quad.bottomRight.x);
    expect(mapProjectivePoint(quad, 1, 1).y).toBeCloseTo(quad.bottomRight.y);
    expect(mapProjectivePoint(quad, 0, 1).x).toBeCloseTo(quad.bottomLeft.x);
    expect(mapProjectivePoint(quad, 0, 1).y).toBeCloseTo(quad.bottomLeft.y);
    const center = mapProjectivePoint(quad, 0.5, 0.5);
    expect(center.x).toBeGreaterThan(150);
    expect(center.x).toBeLessThan(250);
    expect(center.y).toBeGreaterThan(130);
    expect(center.y).toBeLessThan(190);
  });

  it("creates the floating laptop template as a 3:2 canvas with two independent image layers", () => {
    const project = createDefaultProject("نمونهٔ لپ‌تاپ", "laptop-float");
    expect(outputDimensions(1, "laptop-float")).toEqual({ width: 1080, height: 720 });
    expect(outputDimensions(3, "laptop-float")).toEqual({ width: 3240, height: 2160 });
    expect(project.mobile).toBeNull();
    expect(project.back).toMatchObject({ x: 350, y: 205, width: 344, viewportHeight: 194, shadow: { enabled: true } });
    expect(project.front).toMatchObject({ x: 474, y: 55, width: 344, viewportHeight: 194, shadow: { enabled: true } });
    expect(project.technologies).toEqual({ x: 50, y: 642, width: 510 });
  });

  it("keeps screenshot proportions and clamps the content crop to the image", () => {
    const layer = createDefaultLayer("front", "device-showcase");
    const widescreen = viewportImageCrop(layer, { id: "hero", name: "hero.png", mime: "image/png", width: 1920, height: 1080, size: 10 });
    expect(widescreen.sourceHeight).toBe(1080);
    expect(widescreen.displayHeight).toBeCloseTo((1080 / 1920) * layer.width);
    expect(widescreen.displayHeight).toBeLessThan(layer.viewportHeight ?? 0);

    const tallLayer = { ...layer, contentOffsetY: 10_000 };
    const tall = viewportImageCrop(tallLayer, { id: "page", name: "page.png", mime: "image/png", width: 1200, height: 4000, size: 10 });
    expect(tall.sourceY + tall.sourceHeight).toBe(4000);
    expect(tall.displayHeight).toBeCloseTo(layer.viewportHeight ?? 370);
  });

  it("shrinks floating screenshot viewports to the actual image ratio", () => {
    const layer = { ...createDefaultLayer("front", "laptop-float"), width: 318, viewportHeight: 264 };
    const widescreen = { id: "screen", name: "screen.png", mime: "image/png" as const, width: 1920, height: 1080, size: 10 };
    expect(floatingImageViewportHeight(layer, widescreen)).toBeCloseTo(318 * 9 / 16);

    const tall = { ...widescreen, height: 3200 };
    expect(floatingImageViewportHeight(layer, tall)).toBe(264);
    expect(floatingImageViewportHeight({ ...layer, viewportHeight: 120 }, tall)).toBe(120);
  });
});
