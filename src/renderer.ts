import { type BrandSettings, type ProjectState, type RenderResources } from "./model";
import { clamp, imageClipRect, naturalImageRect } from "./geometry";
import { fitText, textDirection } from "./text-layout";
import { iconForTechnology } from "./technology-icons";
import { getLogoBox, getSignaturePosition, getTechnologyStyle, getTemplateDefinition } from "./templates";

export interface RenderWarning {
  id: string;
  message: string;
}

const imageSource = (source: CanvasImageSource | undefined) => source;

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

const drawLogo = (ctx: CanvasRenderingContext2D, project: ProjectState, brand: BrandSettings, source?: CanvasImageSource) => {
  if (!source || !brand.logo || !brand.logoVisible) return;
  const box = getLogoBox(brand, project.templateId);
  const scale = Math.min(box.width / brand.logo.width, box.height / brand.logo.height);
  const width = brand.logo.width * scale;
  const height = brand.logo.height * scale;
  ctx.save();
  ctx.globalAlpha = clamp(brand.logoOpacity, 0, 1);
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
  const techBottom =
    project.technologies.y +
    Math.ceil(
      ((project.selectedTech.length + project.customTech.length) * (iconSize + iconGap)) /
        Math.max(1, project.technologies.width),
    ) *
      (iconSize + iconGap);
  const signaturePosition = getSignaturePosition(brand, project.templateId);
  if (techBottom > signaturePosition.y - 12) {
    warnings.push({ id: "tech-signature-overlap", message: "آیکون‌های فناوری به ناحیهٔ امضا نزدیک شده‌اند؛ تعداد، اندازه یا فاصله را کم کنید." });
  }
  const textMayHitImages = blocks.some((block, index) => {
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
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = brand.background;
  ctx.fillRect(0, 0, width, height);

  drawLogo(ctx, project, brand, resources.logo);
  drawImageLayer(ctx, project, "back", resources.back);
  drawImageLayer(ctx, project, "front", resources.front);

  drawFittedText(ctx, project, brand, "siteName", project.siteName, true);
  drawFittedText(ctx, project, brand, "template", project.templateType, false);
  drawFittedText(ctx, project, brand, "implementation", project.implementation, false);
  drawTechnologies(ctx, project, brand, resources);

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
  return layoutWarnings(project, brand);
};

export const COVER_ASPECT_RATIO = (templateId: ProjectState["templateId"]) => {
  const { width, height } = getTemplateDefinition(templateId);
  return width / height;
};
