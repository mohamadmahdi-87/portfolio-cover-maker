import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  MAX_IMAGE_DIMENSION,
  MAX_IMAGE_PIXELS,
  type AssetMeta,
  type ExportScale,
  type ImageLayer,
  type Point,
  type Rect,
} from "./model";

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

export const safeCanvasPoint = (clientX: number, clientY: number, rect: DOMRect): Point => ({
  x: clamp(((clientX - rect.left) / Math.max(rect.width, 1)) * CANVAS_WIDTH, 0, CANVAS_WIDTH),
  y: clamp(((clientY - rect.top) / Math.max(rect.height, 1)) * CANVAS_HEIGHT, 0, CANVAS_HEIGHT),
});

export const outputDimensions = (scale: ExportScale) => ({
  width: CANVAS_WIDTH * scale,
  height: CANVAS_HEIGHT * scale,
});

export const naturalImageRect = (layer: ImageLayer, asset: AssetMeta): Rect => ({
  x: layer.x,
  y: layer.y - clamp(layer.contentOffsetY, 0, MAX_IMAGE_DIMENSION),
  width: clamp(layer.width, 1, CANVAS_WIDTH * 2),
  height:
    (asset.height / asset.width) *
    clamp(layer.width, 1, CANVAS_WIDTH * 2),
});

export const imageClipRect = (layer: ImageLayer): Rect => ({
  x: -CANVAS_WIDTH,
  y: clamp(layer.y, 0, CANVAS_HEIGHT),
  width: CANVAS_WIDTH * 3,
  height: CANVAS_HEIGHT - clamp(layer.y, 0, CANVAS_HEIGHT),
});

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
