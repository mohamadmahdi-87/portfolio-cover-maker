import { type BrandSettings, type ProjectState, type RenderResources, type Point } from "./model";
import { clamp, floatingImageViewportHeight, imageClipRect, mapProjectivePoint, naturalImageRect, perspectiveQuad, viewportImageCrop, type PerspectiveQuad } from "./geometry";
import { fitText, textDirection } from "./text-layout";
import { iconForTechnology } from "./technology-icons";
import { FLAT_DEVICE_LAYOUT, getLogoBox, getLogoOpacity, getSignaturePosition, getTechnologyStyle, getTemplateBackground, getTemplateDefinition } from "./templates";

export interface RenderWarning {
  id: string;
  message: string;
}

const imageSource = (source: CanvasImageSource | undefined) => source;

const quadPoints = (quad: PerspectiveQuad): Point[] => [quad.topLeft, quad.topRight, quad.bottomRight, quad.bottomLeft];

const drawQuad = (ctx: CanvasRenderingContext2D, points: Point[], fill: string | CanvasGradient | CanvasPattern, radius = 0) => {
  if (points.length !== 4) return;
  ctx.beginPath();
  if (radius > 0) {
    const centerX = points.reduce((sum, point) => sum + point.x, 0) / 4;
    const centerY = points.reduce((sum, point) => sum + point.y, 0) / 4;
    const inset = points.map((point) => {
      const dx = centerX - point.x;
      const dy = centerY - point.y;
      const length = Math.hypot(dx, dy) || 1;
      return { x: point.x + (dx / length) * radius, y: point.y + (dy / length) * radius };
    });
    ctx.moveTo((inset[0].x + inset[3].x) / 2, (inset[0].y + inset[3].y) / 2);
    for (let index = 0; index < 4; index += 1) {
      const current = inset[index];
      const next = inset[(index + 1) % 4];
      ctx.lineTo((current.x + next.x) / 2, (current.y + next.y) / 2);
      ctx.quadraticCurveTo(next.x, next.y, (next.x + inset[(index + 2) % 4].x) / 2, (next.y + inset[(index + 2) % 4].y) / 2);
    }
  } else {
    ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
};

const affineMatrix = (source: Point[], target: Point[]) => {
  const [p0, p1, p2] = source;
  const [q0, q1, q2] = target;
  const denominator = p0.x * (p1.y - p2.y) + p1.x * (p2.y - p0.y) + p2.x * (p0.y - p1.y);
  if (Math.abs(denominator) < 0.0001) return null;
  const a = (q0.x * (p1.y - p2.y) + q1.x * (p2.y - p0.y) + q2.x * (p0.y - p1.y)) / denominator;
  const c = (q0.x * (p2.x - p1.x) + q1.x * (p0.x - p2.x) + q2.x * (p1.x - p0.x)) / denominator;
  const e = (q0.x * (p1.x * p2.y - p2.x * p1.y) + q1.x * (p2.x * p0.y - p0.x * p2.y) + q2.x * (p0.x * p1.y - p1.x * p0.y)) / denominator;
  const b = (q0.y * (p1.y - p2.y) + q1.y * (p2.y - p0.y) + q2.y * (p0.y - p1.y)) / denominator;
  const d = (q0.y * (p2.x - p1.x) + q1.y * (p0.x - p2.x) + q2.y * (p1.x - p0.x)) / denominator;
  const f = (q0.y * (p1.x * p2.y - p2.x * p1.y) + q1.y * (p2.x * p0.y - p0.x * p2.y) + q2.y * (p0.x * p1.y - p1.x * p0.y)) / denominator;
  return { a, b, c, d, e, f };
};

const drawImageIntoQuad = (ctx: CanvasRenderingContext2D, source: CanvasImageSource, sx: number, sy: number, sw: number, sh: number, quad: PerspectiveQuad) => {
  // Map the image as narrow affine strips inside the caller's single clip.
  // Canvas antialiases separately clipped triangles, which exposed the mesh
  // as a checkerboard on dark pages. Small overlapping strips retain the
  // projective shape without drawing internal clip edges.
  const transformScale = Math.max(1, Math.abs(ctx.getTransform().a));
  const averageWidth = (Math.hypot(quad.topRight.x - quad.topLeft.x, quad.topRight.y - quad.topLeft.y)
    + Math.hypot(quad.bottomRight.x - quad.bottomLeft.x, quad.bottomRight.y - quad.bottomLeft.y)) / 2;
  const averageHeight = (Math.hypot(quad.bottomLeft.x - quad.topLeft.x, quad.bottomLeft.y - quad.topLeft.y)
    + Math.hypot(quad.bottomRight.x - quad.topRight.x, quad.bottomRight.y - quad.topRight.y)) / 2;
  const rows = clamp(Math.ceil(averageHeight * transformScale), 96, 1800);
  const columns = 12;
  const overlapU = 0.7 / Math.max(1, averageWidth * transformScale);
  const overlapV = 0.7 / Math.max(1, averageHeight * transformScale);
  for (let row = 0; row < rows; row += 1) {
    const baseV0 = row / rows;
    const baseV1 = (row + 1) / rows;
    const v0 = Math.max(0, baseV0 - overlapV);
    const v1 = Math.min(1, baseV1 + overlapV);
    for (let column = 0; column < columns; column += 1) {
      const baseU0 = column / columns;
      const baseU1 = (column + 1) / columns;
      const u0 = Math.max(0, baseU0 - overlapU);
      const u1 = Math.min(1, baseU1 + overlapU);
      const sourceX = sx + u0 * sw;
      const sourceY = sy + v0 * sh;
      const cellWidth = (u1 - u0) * sw;
      const cellHeight = (v1 - v0) * sh;
      const matrix = affineMatrix(
        [{ x: 0, y: 0 }, { x: cellWidth, y: 0 }, { x: 0, y: cellHeight }],
        [mapProjectivePoint(quad, u0, v0), mapProjectivePoint(quad, u1, v0), mapProjectivePoint(quad, u0, v1)],
      );
      if (!matrix) continue;
      ctx.save();
      ctx.transform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
      ctx.drawImage(source, sourceX, sourceY, cellWidth, cellHeight, 0, 0, cellWidth, cellHeight);
      ctx.restore();
    }
  }
};

const inflateQuad = (quad: PerspectiveQuad, amount: number): PerspectiveQuad => {
  const centerX = (quad.topLeft.x + quad.topRight.x + quad.bottomRight.x + quad.bottomLeft.x) / 4;
  const centerY = (quad.topLeft.y + quad.topRight.y + quad.bottomRight.y + quad.bottomLeft.y) / 4;
  const grow = (point: Point) => {
    const dx = point.x - centerX;
    const dy = point.y - centerY;
    const length = Math.hypot(dx, dy) || 1;
    return { x: point.x + (dx / length) * amount, y: point.y + (dy / length) * amount };
  };
  return { topLeft: grow(quad.topLeft), topRight: grow(quad.topRight), bottomRight: grow(quad.bottomRight), bottomLeft: grow(quad.bottomLeft) };
};

const quadSlice = (quad: PerspectiveQuad, fraction: number): PerspectiveQuad => {
  const amount = clamp(fraction, 0, 1);
  const interpolate = (top: Point, bottom: Point): Point => ({
    x: top.x + (bottom.x - top.x) * amount,
    y: top.y + (bottom.y - top.y) * amount,
  });
  return {
    topLeft: quad.topLeft,
    topRight: quad.topRight,
    bottomRight: interpolate(quad.topRight, quad.bottomRight),
    bottomLeft: interpolate(quad.topLeft, quad.bottomLeft),
  };
};

const drawPerspectiveScreenshot = (
  ctx: CanvasRenderingContext2D,
  project: ProjectState,
  side: "front" | "back" | "mobile",
  source?: CanvasImageSource,
) => {
  const layer = side === "mobile" ? project.mobile : project[side];
  if (!layer || !source || !layer.asset || !layer.visible) return;
  const viewportHeight = clamp(layer.viewportHeight ?? layer.width * (side === "mobile" ? 2.08 : 0.5625), 1, 10800);
  const quad = perspectiveQuad(layer, viewportHeight);
  const phone = side === "mobile";
  const frame = inflateQuad(quad, phone ? 8 : 3);
  const framePoints = quadPoints(frame);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, getTemplateDefinition(project.templateId).width, getTemplateDefinition(project.templateId).height);
  ctx.clip();
  if (layer.shadow.enabled) {
    ctx.shadowColor = layer.shadow.color + Math.round(clamp(layer.shadow.opacity, 0, 1) * 255).toString(16).padStart(2, "0");
    ctx.shadowOffsetX = clamp(layer.shadow.offsetX, -120, 120);
    ctx.shadowOffsetY = clamp(layer.shadow.offsetY, -120, 120);
    ctx.shadowBlur = clamp(layer.shadow.blur, 0, 120);
  } else {
    ctx.shadowColor = "transparent";
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.shadowBlur = 0;
  }
  drawQuad(ctx, framePoints, phone ? "#171b1d" : "#ffffff", phone ? 12 : 1);
  ctx.restore();

  const points = quadPoints(quad);
  ctx.save();
  ctx.beginPath();
  points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, getTemplateDefinition(project.templateId).width, getTemplateDefinition(project.templateId).height);
  const crop = viewportImageCrop(layer, layer.asset);
  const sliceFraction = crop.displayHeight / viewportHeight;
  drawImageIntoQuad(ctx, source, crop.sourceX, crop.sourceY, crop.sourceWidth, crop.sourceHeight, quadSlice(quad, sliceFraction));
  ctx.restore();
  if (phone) {
    const notch = {
      topLeft: { x: (quad.topLeft.x + quad.topRight.x) / 2 - 16, y: (quad.topLeft.y + quad.topRight.y) / 2 + 3 },
      topRight: { x: (quad.topLeft.x + quad.topRight.x) / 2 + 16, y: (quad.topLeft.y + quad.topRight.y) / 2 + 3 },
      bottomRight: { x: (quad.topLeft.x + quad.topRight.x) / 2 + 16, y: (quad.topLeft.y + quad.topRight.y) / 2 + 10 },
      bottomLeft: { x: (quad.topLeft.x + quad.topRight.x) / 2 - 16, y: (quad.topLeft.y + quad.topRight.y) / 2 + 10 },
    };
    drawQuad(ctx, quadPoints(notch), "#171b1d", 3);
  }
};

const drawTemplateOrnaments = (ctx: CanvasRenderingContext2D, templateId: ProjectState["templateId"]) => {
  const ornaments = getTemplateDefinition(templateId).ornaments;
  if (!ornaments) return;
  ctx.save();
  for (const ring of ornaments.rings) {
    ctx.globalAlpha = ring.alpha;
    ctx.strokeStyle = ornaments.color;
    ctx.lineWidth = ring.width;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const dot of ornaments.dots) {
    ctx.globalAlpha = dot.alpha;
    ctx.fillStyle = ornaments.color;
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const diamond of ornaments.diamonds) {
    ctx.globalAlpha = diamond.alpha;
    ctx.fillStyle = ornaments.color;
    ctx.beginPath();
    ctx.moveTo(diamond.x, diamond.y - diamond.size);
    ctx.lineTo(diamond.x + diamond.size * 0.68, diamond.y);
    ctx.lineTo(diamond.x, diamond.y + diamond.size);
    ctx.lineTo(diamond.x - diamond.size * 0.68, diamond.y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
};

const LAPTOP_DISPLAY: PerspectiveQuad = {
  topLeft: { x: 269, y: 202 }, topRight: { x: 615, y: 147 },
  bottomRight: { x: 664, y: 381 }, bottomLeft: { x: 317, y: 468 },
};

const drawLaptopBase = (ctx: CanvasRenderingContext2D, base?: CanvasImageSource) => {
  if (base) {
    // The provided mockup is 1543x1019; cover-fit its near-3:2 ratio without
    // distorting the laptop or its baked-in floor shadow.
    const width = 1080;
    const height = 720;
    const imageAspect = 1543 / 1019;
    const canvasAspect = width / height;
    const drawWidth = imageAspect > canvasAspect ? height * imageAspect : width;
    const drawHeight = imageAspect > canvasAspect ? height : width / imageAspect;
    ctx.drawImage(base, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
  }
};

const drawLaptopDisplay = (ctx: CanvasRenderingContext2D, project: ProjectState, source?: CanvasImageSource) => {
  if (!source || !project.back.asset || !project.back.visible) return;
  const quad = LAPTOP_DISPLAY;
  const targetWidth = (Math.hypot(quad.topRight.x - quad.topLeft.x, quad.topRight.y - quad.topLeft.y) + Math.hypot(quad.bottomRight.x - quad.bottomLeft.x, quad.bottomRight.y - quad.bottomLeft.y)) / 2;
  const targetHeight = (Math.hypot(quad.bottomLeft.x - quad.topLeft.x, quad.bottomLeft.y - quad.topLeft.y) + Math.hypot(quad.bottomRight.x - quad.topRight.x, quad.bottomRight.y - quad.topRight.y)) / 2;
  const targetAspect = targetWidth / targetHeight;
  const asset = project.back.asset;
  let sx = 0;
  let sy = clamp(project.back.contentOffsetY * (asset.width / Math.max(1, project.back.width)), 0, asset.height - 1);
  let sw = asset.width;
  let sh = asset.height;
  if (asset.width / asset.height > targetAspect) {
    sw = asset.height * targetAspect;
    sx = (asset.width - sw) / 2;
  } else {
    sh = Math.min(asset.height, asset.width / targetAspect);
    sy = clamp(sy, 0, Math.max(0, asset.height - sh));
  }
  ctx.save();
  const points = quadPoints(quad);
  ctx.beginPath();
  points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
  ctx.closePath();
  ctx.clip();
  drawImageIntoQuad(ctx, source, sx, sy, sw, sh, quad);
  ctx.restore();
};

const drawFloatingScreen = (ctx: CanvasRenderingContext2D, project: ProjectState, side: "back" | "front", source: CanvasImageSource | undefined, edgeColor: string) => {
  const layer = project[side];
  if (!source || !layer.asset || !layer.visible) return;
  const viewportHeight = floatingImageViewportHeight(layer, layer.asset);
  const quad = perspectiveQuad(layer, viewportHeight);
  ctx.save();
  ctx.shadowColor = layer.shadow.enabled
    ? layer.shadow.color + Math.round(clamp(layer.shadow.opacity, 0, 1) * 255).toString(16).padStart(2, "0")
    : "transparent";
  ctx.shadowOffsetX = clamp(layer.shadow.offsetX, -120, 120);
  ctx.shadowOffsetY = clamp(layer.shadow.offsetY, -120, 120);
  ctx.shadowBlur = clamp(layer.shadow.blur, 0, 120);
  // Match the mockup backdrop under the screenshot edge so antialiasing does
  // not leave a visible white rim while preserving the floating shadow.
  drawQuad(ctx, quadPoints(quad), edgeColor, 0);
  ctx.restore();

  ctx.save();
  const points = quadPoints(quad);
  ctx.beginPath();
  points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = edgeColor;
  ctx.fillRect(0, 0, 1080, 720);
  const crop = viewportImageCrop({ ...layer, viewportHeight }, layer.asset);
  drawImageIntoQuad(ctx, source, crop.sourceX, crop.sourceY, crop.sourceWidth, crop.sourceHeight, quadSlice(quad, crop.displayHeight / viewportHeight));
  ctx.restore();
};

const drawImageLayer = (
  ctx: CanvasRenderingContext2D,
  project: ProjectState,
  side: "front" | "back",
  source?: CanvasImageSource,
) => {
  const layer = project[side];
  if (!source || !layer.asset || !layer.visible) return;
  const rect = naturalImageRect(layer, layer.asset, project.templateId);
  const clip = imageClipRect(layer, project.templateId);
  ctx.save();
  ctx.beginPath();
  ctx.rect(clip.x, clip.y, clip.width, clip.height);
  ctx.clip();
  if (layer.shadow.enabled) {
    ctx.shadowColor =
      layer.shadow.color +
      Math.round(clamp(layer.shadow.opacity, 0, 1) * 255)
        .toString(16)
        .padStart(2, "0");
    ctx.shadowOffsetX = clamp(layer.shadow.offsetX, -120, 120);
    ctx.shadowOffsetY = clamp(layer.shadow.offsetY, -120, 120);
    ctx.shadowBlur = clamp(layer.shadow.blur, 0, 120);
  }
  ctx.drawImage(imageSource(source)!, rect.x, rect.y, rect.width, rect.height);
  ctx.restore();
};

const drawScreenshotInRect = (
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource | undefined,
  layer: ProjectState["front"],
  rect: { x: number; y: number; width: number; height: number },
  radius = 4,
) => {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.width, rect.height, radius);
  ctx.clip();
  if (source && layer.asset && layer.visible) {
    const targetAspect = rect.width / rect.height;
    let sourceWidth = layer.asset.width;
    let sourceHeight = layer.asset.height;
    let sourceX = 0;
    let sourceY = 0;
    if (sourceWidth / sourceHeight > targetAspect) {
      sourceWidth = sourceHeight * targetAspect;
      sourceX = (layer.asset.width - sourceWidth) / 2;
    } else {
      sourceHeight = sourceWidth / targetAspect;
    }
    sourceY = clamp(layer.contentOffsetY * (layer.asset.width / Math.max(1, layer.width)), 0, Math.max(0, layer.asset.height - sourceHeight));
    ctx.drawImage(source, sourceX, sourceY, sourceWidth, sourceHeight, rect.x, rect.y, rect.width, rect.height);
  }
  ctx.restore();
};

const drawFlatDeviceScene = (ctx: CanvasRenderingContext2D, project: ProjectState, resources: RenderResources) => {
  const { width, height } = getTemplateDefinition("flat-device-showcase");
  if (resources.flatDeviceBackground) ctx.drawImage(resources.flatDeviceBackground, 0, 0, width, height);

  const desktopLayer = { ...project.front, width: FLAT_DEVICE_LAYOUT.monitor.screen.width };
  drawScreenshotInRect(ctx, resources.front, desktopLayer, FLAT_DEVICE_LAYOUT.monitor.screen, 2);
  drawScreenshotInRect(ctx, resources.front, desktopLayer, FLAT_DEVICE_LAYOUT.laptop.screen, 3);

  if (project.mobile) {
    const phoneScreen = FLAT_DEVICE_LAYOUT.phone.screen;
    drawScreenshotInRect(ctx, resources.mobile, { ...project.mobile, width: phoneScreen.width }, phoneScreen, 10);
    // The source photo's phone notch is part of the frame, so restore it over
    // the uploaded screenshot after filling the phone display.
    ctx.save();
    ctx.fillStyle = "#050608";
    ctx.beginPath();
    ctx.roundRect(phoneScreen.x + 34, phoneScreen.y - 6, 47, 12, 6);
    ctx.fill();
    ctx.restore();
  }
};

const drawLogo = (ctx: CanvasRenderingContext2D, project: ProjectState, brand: BrandSettings, source?: CanvasImageSource) => {
  if (!source || !brand.logo || !brand.logoVisible) return;
  const box = getLogoBox(brand, project.templateId);
  const scale = Math.min(box.width / brand.logo.width, box.height / brand.logo.height);
  const width = brand.logo.width * scale;
  const height = brand.logo.height * scale;
  ctx.save();
  ctx.globalAlpha = clamp(getLogoOpacity(brand, project.templateId), 0, 1);
  ctx.drawImage(source, box.x + (box.width - width) / 2, box.y + (box.height - height) / 2, width, height);
  ctx.restore();
};

const drawFittedText = (
  ctx: CanvasRenderingContext2D,
  project: ProjectState,
  brand: BrandSettings,
  key: "siteName" | "template" | "implementation",
  text: string,
  bold: boolean,
): { bottom: number; overflow: boolean } => {
  const layout = project.text[key];
  const value = key === "siteName" && project.siteNameUppercase ? text.toUpperCase() : text;
  const fitted = fitText(ctx, value, layout.width, layout.fontSize, layout.minFontSize, 2, brand.fontFamily);
  const direction = textDirection(value, layout.direction);
  const weight = bold ? 600 : 400;
  ctx.save();
  ctx.direction = direction;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = layout.color;
  ctx.font = weight + " " + fitted.fontSize + "px \"" + brand.fontFamily + "\", \"" + (brand.fontFamily === "Inter" ? "Vazirmatn" : "Inter") + "\", sans-serif";
  fitted.lines.forEach((line, index) => {
    ctx.fillText(line, layout.x, layout.y + index * fitted.fontSize * 1.22, layout.width);
  });
  ctx.restore();
  return { bottom: layout.y + fitted.height, overflow: fitted.overflow };
};

const drawTechnologies = (ctx: CanvasRenderingContext2D, project: ProjectState, brand: BrandSettings, resources: RenderResources) => {
  const { x, y, width } = project.technologies;
  const technologyStyle = getTechnologyStyle(brand, project.templateId);
  const size = clamp(technologyStyle.size, 18, 120);
  const gap = clamp(technologyStyle.gap, 0, 80);
  let cursorX = x;
  let cursorY = y;
  const items = [
    ...project.selectedTech.map((id) => ({ id, custom: false })),
    ...project.customTech.map((item) => ({ id: item.id, custom: true })),
  ];
  for (const item of items) {
    if (cursorX + size > x + width && cursorX > x) {
      cursorX = x;
      cursorY += size + gap;
    }
    if (item.custom) {
      const customImage = resources.techCustom.get(item.id);
      if (customImage) {
        ctx.drawImage(customImage, cursorX, cursorY, size, size);
      }
    } else {
      const icon = iconForTechnology(item.id)?.iconData;
      if (icon) {
        const path = new Path2D(icon.path);
        const scale = size / 24;
        const offsetX = cursorX;
        const offsetY = cursorY;
        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.scale(scale, scale);
        ctx.fillStyle = "#" + icon.hex;
        ctx.fill(path);
        ctx.restore();
      }
    }
    cursorX += size + gap;
  }
  return { bottom: items.length ? cursorY + size : y };
};

const overlaps = (a: { top: number; bottom: number }, b: { top: number; bottom: number }) =>
  a.top < b.bottom && b.top < a.bottom;

export const layoutWarnings = (project: ProjectState, brand: BrandSettings): RenderWarning[] => {
  if (project.templateId === "laptop-float") return [];
  const warnings: RenderWarning[] = [];
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return warnings;
  const titleText = project.siteNameUppercase ? project.siteName.toUpperCase() : project.siteName;
  const fontStack = '"' + brand.fontFamily + '", "' + (brand.fontFamily === "Inter" ? "Vazirmatn" : "Inter") + '", sans-serif';
  ctx.font = "600 " + project.text.siteName.fontSize + "px " + fontStack;
  const title = fitText(ctx, titleText, project.text.siteName.width, project.text.siteName.fontSize, project.text.siteName.minFontSize, 2, brand.fontFamily);
  ctx.font = "600 " + project.text.template.fontSize + "px " + fontStack;
  const template = fitText(ctx, project.templateType, project.text.template.width, project.text.template.fontSize, project.text.template.minFontSize, 2, brand.fontFamily);
  ctx.font = "600 " + project.text.implementation.fontSize + "px " + fontStack;
  const implementation = fitText(ctx, project.implementation, project.text.implementation.width, project.text.implementation.fontSize, project.text.implementation.minFontSize, 2, brand.fontFamily);

  if (title.overflow || template.overflow || implementation.overflow) {
    warnings.push({ id: "text-overflow", message: "یکی از متن‌ها در عرض تعیین‌شده جا نمی‌شود؛ عرض یا اندازهٔ قلم را بیشتر کنید." });
  }
  const blocks = [
    { id: "name", top: project.text.siteName.y, bottom: project.text.siteName.y + title.height },
    { id: "template", top: project.text.template.y, bottom: project.text.template.y + template.height },
    { id: "implementation", top: project.text.implementation.y, bottom: project.text.implementation.y + implementation.height },
  ];
  for (let i = 0; i < blocks.length; i += 1) {
    for (let j = i + 1; j < blocks.length; j += 1) {
      if (overlaps(blocks[i], blocks[j])) {
        warnings.push({ id: "text-overlap", message: "جای متن‌ها با هم برخورد دارد؛ موقعیت عمودی را در تنظیمات پیشرفته جابه‌جا کنید." });
        i = blocks.length;
        break;
      }
    }
  }
  const technologyStyle = getTechnologyStyle(brand, project.templateId);
  const iconSize = clamp(technologyStyle.size, 18, 120);
  const iconGap = clamp(technologyStyle.gap, 0, 80);
  const techCount = project.selectedTech.length + project.customTech.length;
  const iconsPerRow = Math.max(1, Math.floor((project.technologies.width + iconGap) / (iconSize + iconGap)));
  const techRows = techCount ? Math.ceil(techCount / iconsPerRow) : 0;
  const techBottom = project.technologies.y + (techRows ? techRows * iconSize + (techRows - 1) * iconGap : 0);
  const lastRowCount = techCount ? ((techCount - 1) % iconsPerRow) + 1 : 0;
  const techRight = project.technologies.x + lastRowCount * (iconSize + iconGap) - iconGap;
  const signaturePosition = getSignaturePosition(brand, project.templateId);
  ctx.font = "400 " + clamp(brand.signature.fontSize, 12, 80) + "px \"" + brand.fontFamily + "\", sans-serif";
  const signatureRight = signaturePosition.x + ctx.measureText(brand.signature.text).width;
  const signaturesOverlap = project.technologies.x < signatureRight && techRight > signaturePosition.x;
  if (techCount > 0 && signaturesOverlap && techBottom > signaturePosition.y && project.technologies.y < signaturePosition.y + brand.signature.fontSize) {
    warnings.push({ id: "tech-signature-overlap", message: "آیکون‌های فناوری به ناحیهٔ امضا نزدیک شده‌اند؛ تعداد، اندازه یا فاصله را کم کنید." });
  }
  const textMayHitImages = project.templateId !== "device-showcase" && project.templateId !== "flat-device-showcase" && blocks.some((block, index) => {
    const key = ["siteName", "template", "implementation"][index] as keyof ProjectState["text"];
    const text = project.text[key];
    return text.x + text.width > project.front.x && block.bottom > project.front.y;
  });
  if (textMayHitImages) {
    warnings.push({ id: "image-text-overlap", message: "عرض ستون متن ممکن است وارد محدودهٔ تصویر جلو شود." });
  }
  return warnings;
};

export const renderCover = (
  canvas: HTMLCanvasElement,
  project: ProjectState,
  brand: BrandSettings,
  resources: RenderResources,
  scale = 1,
): RenderWarning[] => {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("مرورگر امکان رسم روی Canvas را فراهم نکرد.");
  const { width, height } = getTemplateDefinition(project.templateId);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = getTemplateBackground(brand, project.templateId);
  ctx.fillRect(0, 0, width, height);

  if (project.templateId === "device-showcase") {
    const wash = ctx.createLinearGradient(0, 0, width, height);
    wash.addColorStop(0, "rgba(255,255,255,.82)");
    wash.addColorStop(0.56, "rgba(241,244,243,.34)");
    wash.addColorStop(1, "rgba(226,233,231,.55)");
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, width, height);
    const glow = ctx.createRadialGradient(840, 210, 12, 840, 210, 470);
    glow.addColorStop(0, "rgba(255,255,255,.92)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, 670);
    ctx.save();
    ctx.strokeStyle = "rgba(123,143,140,.055)";
    ctx.lineWidth = 1;
    for (let index = -600; index < 1500; index += 42) {
      ctx.beginPath();
      ctx.moveTo(index, 0);
      ctx.lineTo(index + 810, 810);
      ctx.stroke();
    }
    ctx.restore();
    const footer = ctx.createLinearGradient(0, 750, 0, 810);
    footer.addColorStop(0, "rgba(239,242,241,.15)");
    footer.addColorStop(1, "rgba(225,231,229,.72)");
    ctx.fillStyle = footer;
    ctx.fillRect(0, 750, width, 60);
    ctx.fillStyle = "rgba(81,99,98,.3)";
    ctx.fillRect(0, 750, width, 2);
  }
  if (project.templateId !== "laptop-float") drawTemplateOrnaments(ctx, project.templateId);

  if (project.templateId === "laptop-float") {
    drawLaptopBase(ctx, resources.laptopBase);
    // The mockup includes the laptop and shadow in a single photo, so draw
    // ornaments only in free background areas after it and before the screens.
    drawTemplateOrnaments(ctx, project.templateId);
    drawLaptopDisplay(ctx, project, resources.back);
    drawLogo(ctx, project, brand, resources.logo);
    const edgeColor = getTemplateBackground(brand, project.templateId);
    drawFloatingScreen(ctx, project, "back", resources.back, edgeColor);
    drawFloatingScreen(ctx, project, "front", resources.front, edgeColor);
  } else if (project.templateId === "device-showcase") {
    drawPerspectiveScreenshot(ctx, project, "back", resources.back);
    drawPerspectiveScreenshot(ctx, project, "front", resources.front);
    drawPerspectiveScreenshot(ctx, project, "mobile", resources.mobile);
    drawLogo(ctx, project, brand, resources.logo);
  } else if (project.templateId === "flat-device-showcase") {
    drawFlatDeviceScene(ctx, project, resources);
  } else {
    const layeredLogo = project.templateId === "editorial-collage";
    if (!layeredLogo) drawLogo(ctx, project, brand, resources.logo);
    drawImageLayer(ctx, project, "back", resources.back);
    drawImageLayer(ctx, project, "front", resources.front);
    if (layeredLogo) drawLogo(ctx, project, brand, resources.logo);
  }

  if (project.templateId !== "laptop-float" && project.templateId !== "flat-device-showcase") {
    drawFittedText(ctx, project, brand, "siteName", project.siteName, true);
    drawFittedText(ctx, project, brand, "template", project.templateType, false);
    drawFittedText(ctx, project, brand, "implementation", project.implementation, false);
  }
  if (project.templateId !== "flat-device-showcase") drawTechnologies(ctx, project, brand, resources);

  if (project.templateId !== "flat-device-showcase") {
    const signature = brand.signature;
    const signaturePosition = getSignaturePosition(brand, project.templateId);
    ctx.save();
    ctx.direction = textDirection(signature.text, "auto");
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = signature.color;
    ctx.font = "400 " + clamp(signature.fontSize, 12, 80) + "px \"" + brand.fontFamily + "\", \"" + (brand.fontFamily === "Inter" ? "Vazirmatn" : "Inter") + "\", sans-serif";
    ctx.fillText(signature.text, signaturePosition.x, signaturePosition.y);
    ctx.restore();
  }
  return project.templateId === "laptop-float" || project.templateId === "flat-device-showcase" ? [] : layoutWarnings(project, brand);
};

export const COVER_ASPECT_RATIO = (templateId: ProjectState["templateId"]) => {
  const { width, height } = getTemplateDefinition(templateId);
  return width / height;
};
