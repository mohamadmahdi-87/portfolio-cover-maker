import type { BrandSettings, CoverTemplateId, ImageLayer, ProjectState } from "./model";
import { SCHEMA_VERSION } from "./model";
import { getTemplateDefinition } from "./templates";

export const DEFAULT_SHADOW = {
  enabled: true,
  offsetX: 12,
  offsetY: 16,
  blur: 28,
  opacity: 0.16,
  color: "#555555",
};

export const DEFAULT_WEBZAD_LOGO = {
  id: "webzad-team-logo-default-v1",
  name: "لوگوی تیم وبزاد",
  mime: "image/png" as const,
  width: 595,
  height: 121,
  size: 6534,
};

export const createDefaultLayer = (kind: "front" | "back", templateId: CoverTemplateId = "web-cover"): ImageLayer => ({
  asset: null,
  visible: true,
  x: getTemplateDefinition(templateId).layers[kind].x,
  y: getTemplateDefinition(templateId).layers[kind].y,
  width: getTemplateDefinition(templateId).layers[kind].width,
  contentOffsetY: 0,
  shadow: {
    ...DEFAULT_SHADOW,
    enabled: kind === "front",
  },
});

export const createDefaultBrand = (): BrandSettings => ({
  schemaVersion: SCHEMA_VERSION,
  fontFamily: "Vazirmatn",
  background: "#E4E4E4",
  logo: { ...DEFAULT_WEBZAD_LOGO },
  logoDefaultApplied: true,
  logoVisible: true,
  logoBox: { ...getTemplateDefinition("web-cover").logoBox },
  logoBoxes: {
    "web-cover": { ...getTemplateDefinition("web-cover").logoBox },
    "instagram-feed": { ...getTemplateDefinition("instagram-feed").logoBox },
  },
  logoOpacity: 0.04,
  signature: {
    text: "Designed by Webzad",
    x: 50,
    y: 766,
    fontSize: 27,
    color: "#707070",
    positions: {
      "web-cover": { x: 50, y: 766 },
      "instagram-feed": { x: 50, y: getTemplateDefinition("instagram-feed").height - getTemplateDefinition("instagram-feed").signature.bottom },
    },
  },
  iconSize: 58,
  iconGap: 12,
  iconSizes: { "web-cover": 58, "instagram-feed": 68 },
  iconGaps: { "web-cover": 12, "instagram-feed": 14 },
});

export const migrateBrandSettings = (brand: BrandSettings | null | undefined): BrandSettings => {
  if (!brand) return createDefaultBrand();
  const web = getTemplateDefinition("web-cover");
  const social = getTemplateDefinition("instagram-feed");
  return {
    ...brand,
    schemaVersion: SCHEMA_VERSION,
    iconSizes: {
      ...brand.iconSizes,
      "web-cover": brand.iconSizes?.["web-cover"] ?? brand.iconSize,
      "instagram-feed": brand.iconSizes?.["instagram-feed"] ?? 68,
    },
    iconGaps: {
      ...brand.iconGaps,
      "web-cover": brand.iconGaps?.["web-cover"] ?? brand.iconGap,
      "instagram-feed": brand.iconGaps?.["instagram-feed"] ?? 14,
    },
    logoBoxes: {
      ...brand.logoBoxes,
      "web-cover": brand.logoBoxes?.["web-cover"] ?? brand.logoBox ?? { ...web.logoBox },
      "instagram-feed": brand.logoBoxes?.["instagram-feed"] ?? { ...social.logoBox },
    },
    signature: {
      ...brand.signature,
      positions: {
        ...brand.signature.positions,
        "web-cover": brand.signature.positions?.["web-cover"] ?? { x: brand.signature.x, y: brand.signature.y },
        "instagram-feed": brand.signature.positions?.["instagram-feed"]?.x === 50 && brand.signature.positions?.["instagram-feed"]?.y === 1295
          ? { x: 50, y: social.height - social.signature.bottom }
          : brand.signature.positions?.["instagram-feed"] ?? { x: brand.signature.x, y: social.height - social.signature.bottom },
      },
    },
  };
};

export const createDefaultProject = (name = "پروژهٔ جدید", templateId: CoverTemplateId = "web-cover"): ProjectState => {
  const definition = getTemplateDefinition(templateId);
  return ({
  schemaVersion: SCHEMA_VERSION,
  templateId,
  id: crypto.randomUUID(),
  name,
  siteName: "نام وب‌سایت",
  siteNameUppercase: false,
  templateType: "طراحی اختصاصی",
  implementation: "React Development",
  selectedTech: [],
  customTech: [],
  coverPreview: null,
  front: createDefaultLayer("front", templateId),
  back: createDefaultLayer("back", templateId),
  text: {
    siteName: {
      ...definition.text.siteName,
      color: "#606060",
      direction: "auto",
    },
    template: {
      ...definition.text.template,
      color: "#808080",
      direction: "auto",
    },
    implementation: {
      ...definition.text.implementation,
      color: "#808080",
      direction: "auto",
    },
  },
  technologies: { ...definition.technologies },
  output: { format: "png", scale: 1, quality: 0.92 },
  updatedAt: Date.now(),
  });
};

export const TEMPLATE_SUGGESTIONS = [
  "طراحی اختصاصی",
  "قالب آماده",
  "شخصی‌سازی قالب آماده",
  "Custom Design",
  "Ready-made Theme",
  "Theme Customization",
];

export const IMPLEMENTATION_SUGGESTIONS = [
  "WordPress Theme Development",
  "WordPress Theme Customization",
  "Laravel Development",
  "HTML / CSS / JavaScript",
  "React Development",
  "Next.js Development",
];

export const TECHNOLOGIES = [
  { id: "wordpress", label: "WordPress", icon: "siWordpress" },
  { id: "woocommerce", label: "WooCommerce", icon: "siWoocommerce" },
  { id: "laravel", label: "Laravel", icon: "siLaravel" },
  { id: "php", label: "PHP", icon: "siPhp" },
  { id: "html5", label: "HTML5", icon: "siHtml5" },
  { id: "css3", label: "CSS3", icon: "siCss3" },
  { id: "javascript", label: "JavaScript", icon: "siJavascript" },
  { id: "typescript", label: "TypeScript", icon: "siTypescript" },
  { id: "react", label: "React", icon: "siReact" },
  { id: "nextjs", label: "Next.js", icon: "siNextdotjs" },
  { id: "tailwind", label: "Tailwind CSS", icon: "siTailwindcss" },
  { id: "bootstrap", label: "Bootstrap", icon: "siBootstrap" },
  { id: "figma", label: "Figma", icon: "siFigma" },
  { id: "vue", label: "Vue", icon: "siVuedotjs" },
  { id: "alpine", label: "Alpine.js", icon: "siAlpinedotjs" },
];
