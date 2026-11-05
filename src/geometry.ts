import {
  MAX_IMAGE_DIMENSION,
  MAX_IMAGE_PIXELS,
  type AssetMeta,
  type ExportScale,
  type ImageLayer,
  type Point,
  type Rect,
  type CoverTemplateId,
} from "./model";
import { getTemplateDefinition } from "./templates";

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

export type PerspectiveQuad = { topLeft: Point; topRight: Point; bottomRight: Point; bottomLeft: Point };

export interface ProjectiveTransform {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
  g: number;
  h: number;
}

/** Solves the homography that maps the unit square onto a four-corner plane. */
export const projectiveTransform = (quad: PerspectiveQuad): ProjectiveTransform => {
  const [p0, p1, p2, p3] = [quad.topLeft, quad.topRight, quad.bottomRight, quad.bottomLeft];
  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const dy3 = p0.y - p1.y + p2.y - p3.y;
  const denominator = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(denominator) < 0.000001) {
    return { a: p1.x - p0.x, b: p3.x - p0.x, c: p0.x, d: p1.y - p0.y, e: p3.y - p0.y, f: p0.y, g: 0, h: 0 };
  }
  const g = (dx3 * dy2 - dx2 * dy3) / denominator;
  const h = (dx1 * dy3 - dx3 * dy1) / denominator;
  return {
    a: p1.x - p0.x + g * p1.x,
    b: p3.x - p0.x + h * p3.x,
    c: p0.x,
    d: p1.y - p0.y + g * p1.y,
    e: p3.y - p0.y + h * p3.y,
    f: p0.y,
    g,
    h,
  };
};

/** Maps normalized source coordinates (0..1) through a four-corner projective transform. */
export const mapProjectivePoint = (quad: PerspectiveQuad, u: number, v: number): Point => {
  const transform = projectiveTransform(quad);
  const denominator = transform.g * u + transform.h * v + 1;
  if (Math.abs(denominator) < 0.000001) return quad.topLeft;
  return {
    x: (transform.a * u + transform.b * v + transform.c) / denominator,
    y: (transform.d * u + transform.e * v + transform.f) / denominator,
  };
};

export interface ViewportImageCrop {
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
  displayHeight: number;
}

/** Returns the source crop needed to fit an image to a layer width without stretching it. */
export const viewportImageCrop = (layer: ImageLayer, asset: AssetMeta): ViewportImageCrop => {
  const sourceWidth = Math.max(1, asset.width);
  const viewportHeight = clamp(layer.viewportHeight ?? layer.width * 0.72, 1, 10800);
  const targetSourceHeight = Math.min(asset.height, (viewportHeight / Math.max(1, layer.width)) * sourceWidth);
  const sourceY = clamp(
    layer.contentOffsetY * (sourceWidth / Math.max(1, layer.width)),
    0,
    Math.max(0, asset.height - targetSourceHeight),
  );
  const sourceHeight = Math.max(1, Math.min(targetSourceHeight, asset.height - sourceY));
  return {
    sourceX: 0,
    sourceY,
    sourceWidth,
    sourceHeight,
    displayHeight: (sourceHeight / sourceWidth) * layer.width,
  };
};

/** Keeps a floating screenshot at its image ratio when its saved viewport is taller than the file. */
export const floatingImageViewportHeight = (layer: ImageLayer, asset: AssetMeta): number => {
  const naturalHeight = (Math.max(1, asset.height) / Math.max(1, asset.width)) * Math.max(1, layer.width);
  return clamp(Math.min(layer.viewportHeight ?? naturalHeight, naturalHeight), 1, 10800);
};

export const perspectiveQuad = (layer: ImageLayer, height: number): PerspectiveQuad => {
  const width = clamp(layer.width, 1, 2160);
  const safeHeight = clamp(height, 1, 10800);
  const tilt = (clamp(layer.tilt ?? 0, -45, 45) * Math.PI) / 180;
  const perspective = (clamp(layer.perspective ?? 0, -45, 45) * Math.PI) / 180;
  const yaw = (clamp(layer.yaw ?? 0, -45, 45) * Math.PI) / 180;
  const horizontalSkew = Math.tan(tilt) * safeHeight * 0.2;
  const verticalSkew = Math.tan(perspective) * width * 0.12;
  const raw: Point[] = [
    { x: layer.x - horizontalSkew / 2, y: layer.y - verticalSkew / 2 },
    { x: layer.x + width + horizontalSkew / 2, y: layer.y + verticalSkew / 2 },
    { x: layer.x + width - horizontalSkew / 2, y: layer.y + safeHeight + verticalSkew / 2 },
    { x: layer.x + horizontalSkew / 2, y: layer.y + safeHeight - verticalSkew / 2 },
  ];
  const rotation = ((clamp(layer.rotation ?? 0, -45, 45) * Math.PI) / 180);
  const centerX = layer.x + width / 2;
  const centerY = layer.y + safeHeight / 2;
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  const [topLeft, topRight, bottomRight, bottomLeft] = raw.map((point) => {
    const dx = point.x - centerX;
    const dy = point.y - centerY;
    // Rotate the screenshot plane around its vertical axis, then project the
    // resulting near/far depth. A positive yaw makes the right edge recede.
    const depth = (dx / width) * Math.sin(yaw) * width;
    const scale = 1 / (1 + depth / (width * 1.55));
    const projectedX = dx * Math.cos(yaw) * scale;
    const projectedY = dy * scale;
    return { x: centerX + projectedX * cosine - projectedY * sine, y: centerY + projectedX * sine + projectedY * cosine };
  });
  return { topLeft, topRight, bottomRight, bottomLeft };
};

export const safeCanvasPoint = (
  clientX: number,
  clientY: number,
  rect: DOMRect,
  templateId: CoverTemplateId = "web-cover",
): Point => {
  const { width, height } = getTemplateDefinition(templateId);
  return {
    x: clamp(((clientX - rect.left) / Math.max(rect.width, 1)) * width, 0, width),
    y: clamp(((clientY - rect.top) / Math.max(rect.height, 1)) * height, 0, height),
  };
};

export const outputDimensions = (scale: ExportScale, templateId: CoverTemplateId = "web-cover") => {
  const { width, height } = getTemplateDefinition(templateId);
  return { width: width * scale, height: height * scale };
};

export const naturalImageRect = (layer: ImageLayer, asset: AssetMeta, templateId: CoverTemplateId = "web-cover"): Rect => {
  const { width } = getTemplateDefinition(templateId);
  const layerWidth = clamp(layer.width, 1, width * 2);
  return {
    x: layer.x,
    y: layer.y - clamp(layer.contentOffsetY, 0, MAX_IMAGE_DIMENSION),
    width: layerWidth,
    height: (asset.height / asset.width) * layerWidth,
  };
};

export const imageClipRect = (layer: ImageLayer, templateId: CoverTemplateId = "web-cover"): Rect => {
  const { width, height } = getTemplateDefinition(templateId);
  return {
    x: -width,
    y: clamp(layer.y, 0, height),
    width: width * 3,
    height: height - clamp(layer.y, 0, height),
  };
};

export const validateImageDimensions = (width: number, height: number): string | null => {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    return "ابعاد فایل تصویری معتبر نیست.";
  }
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    return "ابعاد تصویر از حد پشتیبانی‌شدهٔ مرورگر بیشتر است؛ تصویر را کوچک‌تر کنید.";
  }
  if (width * height > MAX_IMAGE_PIXELS) {
    return "این تصویر برای پردازش مرورگر بیش از حد بزرگ است؛ پیش از بارگذاری ابعاد آن را کاهش دهید.";
  }
  return null;
};
