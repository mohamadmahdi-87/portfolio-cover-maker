import type { BrandSettings, CoverTemplateId, Point } from "./model";

export interface TemplateDefinition {
  id: CoverTemplateId;
  title: string;
  subtitle: string;
  width: number;
  height: number;
  layers: {
    front: { x: number; y: number; width: number };
    back: { x: number; y: number; width: number };
  };
  logoBox: { x: number; y: number; width: number; height: number };
  text: {
    siteName: { x: number; y: number; width: number; fontSize: number; minFontSize: number };
    template: { x: number; y: number; width: number; fontSize: number; minFontSize: number };
    implementation: { x: number; y: number; width: number; fontSize: number; minFontSize: number };
  };
  technologies: { x: number; y: number; width: number };
  signature: { x: number; bottom: number };
}

export const TEMPLATE_DEFINITIONS: Record<CoverTemplateId, TemplateDefinition> = {
  "web-cover": {
    id: "web-cover",
    title: "کاور نمونه‌کار وب",
    subtitle: "دو تصویر بلند سایت با چیدمان هم‌پوشان",
    width: 1080,
    height: 848,
    layers: { front: { x: 409, y: 150, width: 484 }, back: { x: 588, y: 0, width: 466 } },
    logoBox: { x: 40, y: 75, width: 335, height: 220 },
    text: {
      siteName: { x: 50, y: 328, width: 340, fontSize: 44, minFontSize: 25 },
      template: { x: 52, y: 397, width: 340, fontSize: 29, minFontSize: 20 },
      implementation: { x: 52, y: 451, width: 340, fontSize: 28, minFontSize: 19 },
    },
    technologies: { x: 50, y: 515, width: 340 },
    signature: { x: 50, bottom: 55 },
  },
  "instagram-feed": {
    id: "instagram-feed",
    title: "کاور شبکه‌های اجتماعی · ۱:۱",
    subtitle: "قالب مربعی با متن در چپ و تصاویر هم‌پوشان در راست",
    width: 1080,
    height: 1080,
    layers: { front: { x: 465, y: 245, width: 425 }, back: { x: 720, y: 45, width: 330 } },
    logoBox: { x: 40, y: 45, width: 350, height: 170 },
    text: {
      siteName: { x: 50, y: 275, width: 395, fontSize: 52, minFontSize: 28 },
      template: { x: 52, y: 370, width: 393, fontSize: 35, minFontSize: 23 },
      implementation: { x: 52, y: 430, width: 393, fontSize: 33, minFontSize: 22 },
    },
    technologies: { x: 50, y: 525, width: 395 },
    signature: { x: 50, bottom: 48 },
  },
};

export const getTemplateDefinition = (id: CoverTemplateId | undefined): TemplateDefinition =>
  TEMPLATE_DEFINITIONS[id ?? "web-cover"] ?? TEMPLATE_DEFINITIONS["web-cover"];

export const getSignaturePosition = (brand: BrandSettings, templateId: CoverTemplateId): Point => {
  const saved = brand.signature.positions?.[templateId];
  if (saved) return saved;
  if (templateId === "web-cover") return { x: brand.signature.x, y: brand.signature.y };
  const definition = getTemplateDefinition(templateId);
  return { x: brand.signature.x, y: definition.height - definition.signature.bottom };
};

export const getLogoBox = (brand: BrandSettings, templateId: CoverTemplateId) =>
  brand.logoBoxes?.[templateId] ?? (templateId === "web-cover" ? brand.logoBox : getTemplateDefinition(templateId).logoBox);

export const getTechnologyStyle = (brand: BrandSettings, templateId: CoverTemplateId) => ({
  size: brand.iconSizes?.[templateId] ?? brand.iconSize,
  gap: brand.iconGaps?.[templateId] ?? brand.iconGap,
});
