import type { BrandSettings, CoverTemplateId, Point } from "./model";

export interface TemplateDefinition {
  id: CoverTemplateId;
  title: string;
  subtitle: string;
  width: number;
  height: number;
  layers: {
    front: LayerPreset;
    back: LayerPreset;
    mobile?: LayerPreset;
  };
  logoBox: { x: number; y: number; width: number; height: number };
  text: {
    siteName: { x: number; y: number; width: number; fontSize: number; minFontSize: number };
    template: { x: number; y: number; width: number; fontSize: number; minFontSize: number };
    implementation: { x: number; y: number; width: number; fontSize: number; minFontSize: number };
  };
  technologies: { x: number; y: number; width: number };
  signature: { x: number; bottom: number };
  ornaments?: {
    color: string;
    rings: Array<{ x: number; y: number; radius: number; width: number; alpha: number }>;
    dots: Array<{ x: number; y: number; radius: number; alpha: number }>;
    diamonds: Array<{ x: number; y: number; size: number; alpha: number }>;
  };
}

export interface LayerPreset {
  x: number;
  y: number;
  width: number;
  viewportHeight?: number;
  rotation?: number;
  perspective?: number;
  tilt?: number;
  yaw?: number;
}

export const FLAT_DEVICE_LAYOUT = {
  monitor: { screen: { x: 306, y: 222, width: 694, height: 408 } },
  laptop: { screen: { x: 997, y: 509, width: 386, height: 244 } },
  phone: { screen: { x: 144, y: 570, width: 114, height: 235 } },
};

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
  "editorial-collage": {
    id: "editorial-collage",
    title: "کلاژ نمونه‌کار",
    subtitle: "دو تصویر بلند با چیدمان نامتقارن و تزئینات وبزاد",
    width: 1080,
    height: 1350,
    layers: { back: { x: 38, y: 0, width: 590 }, front: { x: 430, y: 340, width: 610 } },
    logoBox: { x: 690, y: 24, width: 340, height: 92 },
    text: {
      siteName: { x: 690, y: 138, width: 350, fontSize: 40, minFontSize: 26 },
      template: { x: 692, y: 201, width: 348, fontSize: 25, minFontSize: 18 },
      implementation: { x: 692, y: 248, width: 348, fontSize: 22, minFontSize: 16 },
    },
    technologies: { x: 690, y: 282, width: 350 },
    signature: { x: 50, bottom: 52 },
    ornaments: {
      color: "#ef705a",
      rings: [
        { x: 18, y: 1140, radius: 142, width: 4, alpha: 0.86 },
      ],
      dots: [
        { x: 178, y: 1058, radius: 7, alpha: 0.9 },
        { x: 330, y: 1200, radius: 5, alpha: 0.8 },
        { x: 1052, y: 139, radius: 5, alpha: 0.8 },
        { x: 1057, y: 176, radius: 4, alpha: 0.7 },
        { x: 1048, y: 214, radius: 3, alpha: 0.7 },
      ],
      diamonds: [
        { x: 85, y: 1004, size: 23, alpha: 0.11 },
        { x: 984, y: 115, size: 19, alpha: 0.12 },
        { x: 370, y: 1280, size: 15, alpha: 0.13 },
      ],
    },
  },
  "device-showcase": {
    id: "device-showcase",
    title: "نمایش سایت در دسکتاپ و موبایل",
    subtitle: "سه اسکرین‌شات روی صفحه‌های پرسپکتیو با پس‌زمینهٔ روشن",
    width: 1080,
    height: 810,
    layers: {
      back: { x: 110, y: 175, width: 480, viewportHeight: 355, rotation: -1.2, perspective: 26, tilt: -13, yaw: -11 },
      front: { x: 430, y: 165, width: 500, viewportHeight: 370, rotation: 1.4, perspective: 22, tilt: 16, yaw: 12 },
      mobile: { x: 862, y: 337, width: 148, viewportHeight: 326, rotation: -5, perspective: 7, tilt: 0, yaw: 5 },
    },
    logoBox: { x: 52, y: 32, width: 250, height: 62 },
    text: {
      siteName: { x: 58, y: 692, width: 410, fontSize: 34, minFontSize: 23 },
      template: { x: 60, y: 738, width: 410, fontSize: 19, minFontSize: 15 },
      implementation: { x: 60, y: 766, width: 410, fontSize: 17, minFontSize: 14 },
    },
    technologies: { x: 520, y: 738, width: 360 },
    signature: { x: 828, bottom: 31 },
    ornaments: {
      color: "#dd745e",
      rings: [
        { x: 1034, y: 42, radius: 80, width: 2, alpha: 0.18 },
        { x: 34, y: 668, radius: 88, width: 2, alpha: 0.2 },
      ],
      dots: [
        { x: 1000, y: 145, radius: 3, alpha: 0.28 },
        { x: 1017, y: 165, radius: 2, alpha: 0.2 },
        { x: 75, y: 115, radius: 3, alpha: 0.2 },
      ],
      diamonds: [
        { x: 1008, y: 217, size: 11, alpha: 0.1 },
        { x: 111, y: 626, size: 13, alpha: 0.1 },
      ],
    },
  },
  "flat-device-showcase": {
    id: "flat-device-showcase",
    title: "نمایش تخت دسکتاپ و موبایل",
    subtitle: "یک تصویر روی مانیتور و لپ‌تاپ و یک تصویر روی موبایل، بدون پرسپکتیو",
    width: 1536,
    height: 1024,
    layers: {
      back: { x: 0, y: 0, width: 1 },
      front: { x: 306, y: 222, width: 694, viewportHeight: 408 },
      mobile: { x: 144, y: 570, width: 114, viewportHeight: 235 },
    },
    logoBox: { x: 52, y: 26, width: 220, height: 48 },
    text: {
      siteName: { x: 52, y: 82, width: 370, fontSize: 31, minFontSize: 21 },
      template: { x: 54, y: 123, width: 365, fontSize: 18, minFontSize: 15 },
      implementation: { x: 54, y: 150, width: 365, fontSize: 16, minFontSize: 13 },
    },
    technologies: { x: 500, y: 742, width: 340 },
    signature: { x: 842, bottom: 28 },
  },
  "laptop-float": {
    id: "laptop-float",
    title: "لپ‌تاپ و صفحه‌های شناور",
    subtitle: "دو اسکرین‌شات روی نمایشگر لپ‌تاپ با پرسپکتیو واقعی و سایهٔ شناور",
    width: 1080,
    height: 720,
    layers: {
      back: { x: 350, y: 205, width: 344, viewportHeight: 194, rotation: 0.5, perspective: -23, tilt: -1, yaw: 4 },
      front: { x: 474, y: 55, width: 344, viewportHeight: 194, rotation: 0.6, perspective: -22, tilt: -1, yaw: 4 },
    },
    logoBox: { x: 52, y: 24, width: 220, height: 54 },
    text: {
      siteName: { x: 52, y: 654, width: 380, fontSize: 31, minFontSize: 20 },
      template: { x: 54, y: 685, width: 380, fontSize: 18, minFontSize: 14 },
      implementation: { x: 54, y: 705, width: 380, fontSize: 16, minFontSize: 13 },
    },
    technologies: { x: 50, y: 642, width: 510 },
    signature: { x: 820, bottom: 50 },
    ornaments: {
      color: "#db644f",
      rings: [{ x: 72, y: 629, radius: 80, width: 2, alpha: 0.16 }, { x: 1012, y: 78, radius: 106, width: 2, alpha: 0.1 }],
      dots: [{ x: 922, y: 86, radius: 4, alpha: 0.18 }, { x: 882, y: 616, radius: 3, alpha: 0.14 }, { x: 145, y: 106, radius: 3, alpha: 0.14 }],
      diamonds: [{ x: 957, y: 174, size: 14, alpha: 0.08 }, { x: 146, y: 547, size: 16, alpha: 0.07 }],
    },
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

export const getLogoOpacity = (brand: BrandSettings, templateId: CoverTemplateId) =>
  brand.logoOpacities?.[templateId] ?? (templateId === "editorial-collage" || templateId === "device-showcase" || templateId === "flat-device-showcase" ? 0.9 : templateId === "laptop-float" ? 0.12 : brand.logoOpacity);

export const getTechnologyStyle = (brand: BrandSettings, templateId: CoverTemplateId) => ({
  size: brand.iconSizes?.[templateId] ?? (templateId === "device-showcase" || templateId === "flat-device-showcase" ? 34 : templateId === "laptop-float" ? 26 : brand.iconSize),
  gap: brand.iconGaps?.[templateId] ?? (templateId === "device-showcase" || templateId === "flat-device-showcase" ? 10 : templateId === "laptop-float" ? 8 : brand.iconGap),
});

export const getTemplateBackground = (brand: BrandSettings, templateId: CoverTemplateId) =>
  brand.backgrounds?.[templateId] ?? (templateId === "device-showcase" ? "#f8f9f8" : templateId === "laptop-float" ? "#d2d2d2" : templateId === "flat-device-showcase" ? "#476fa7" : brand.background);

export const usesPerspectiveLayers = (templateId: CoverTemplateId) => templateId === "device-showcase" || templateId === "laptop-float";
