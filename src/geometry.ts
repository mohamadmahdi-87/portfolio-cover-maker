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
