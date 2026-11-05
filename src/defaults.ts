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

export const createDefaultLayer = (kind: "front" | "back", templateId: CoverTemplateId = "web-cover"): ImageLayer => ({
  asset: null,
  visible: true,
  x: getTemplateDefinition(templateId).layers[kind].x,
  y: getTemplateDefinition(templateId).layers[kind].y,
  width: getTemplateDefinition(templateId).layers[kind].width,
  viewportHeight: getTemplateDefinition(templateId).layers[kind].viewportHeight,
  rotation: getTemplateDefinition(templateId).layers[kind].rotation,
  perspective: getTemplateDefinition(templateId).layers[kind].perspective,
  tilt: getTemplateDefinition(templateId).layers[kind].tilt,
  yaw: getTemplateDefinition(templateId).layers[kind].yaw,
  contentOffsetY: 0,
  shadow: {
    ...DEFAULT_SHADOW,
    enabled: templateId === "laptop-float" || kind === "front",
    ...(templateId === "laptop-float" ? { offsetX: 2, offsetY: 18, blur: 26, opacity: 0.23, color: "#343434" } : {}),
  },
});

export const createDefaultMobileLayer = (templateId: CoverTemplateId = "device-showcase"): ImageLayer => {
  const preset = getTemplateDefinition(templateId).layers.mobile ?? getTemplateDefinition("device-showcase").layers.mobile!;
  return {
    asset: null, visible: true, x: preset.x, y: preset.y, width: preset.width,
    viewportHeight: preset.viewportHeight, rotation: preset.rotation,
    perspective: preset.perspective, tilt: preset.tilt, yaw: preset.yaw, contentOffsetY: 0,
    shadow: { ...DEFAULT_SHADOW, enabled: true },
  };
};

export const createDefaultBrand = (): BrandSettings => ({
  schemaVersion: SCHEMA_VERSION,
  fontFamily: "Vazirmatn",
  background: "#E4E4E4",
  backgrounds: { "device-showcase": "#f8f9f8", "laptop-float": "#d2d2d2", "flat-device-showcase": "#476fa7" },
  logo: null,
  logoVisible: true,
  logoBox: { ...getTemplateDefinition("web-cover").logoBox },
  logoBoxes: {
    "web-cover": { ...getTemplateDefinition("web-cover").logoBox },
    "instagram-feed": { ...getTemplateDefinition("instagram-feed").logoBox },
    "editorial-collage": { ...getTemplateDefinition("editorial-collage").logoBox },
    "device-showcase": { ...getTemplateDefinition("device-showcase").logoBox },
    "laptop-float": { ...getTemplateDefinition("laptop-float").logoBox },
    "flat-device-showcase": { ...getTemplateDefinition("flat-device-showcase").logoBox },
  },
  logoOpacity: 1,
  logoOpacities: { "web-cover": 1, "instagram-feed": 1, "editorial-collage": 1, "device-showcase": 1, "laptop-float": 1, "flat-device-showcase": 1 },
  signature: {
    text: "",
    x: 50,
    y: 766,
    fontSize: 27,
    color: "#707070",
    positions: {
      "web-cover": { x: 50, y: 766 },
      "instagram-feed": { x: 50, y: getTemplateDefinition("instagram-feed").height - getTemplateDefinition("instagram-feed").signature.bottom },
      "editorial-collage": { x: 50, y: getTemplateDefinition("editorial-collage").height - getTemplateDefinition("editorial-collage").signature.bottom },
      "device-showcase": { x: 830, y: getTemplateDefinition("device-showcase").height - getTemplateDefinition("device-showcase").signature.bottom },
      "laptop-float": { x: getTemplateDefinition("laptop-float").signature.x, y: getTemplateDefinition("laptop-float").height - getTemplateDefinition("laptop-float").signature.bottom },
      "flat-device-showcase": { x: getTemplateDefinition("flat-device-showcase").signature.x, y: getTemplateDefinition("flat-device-showcase").height - getTemplateDefinition("flat-device-showcase").signature.bottom },
    },
  },
  iconSize: 58,
  iconGap: 12,
  iconSizes: { "web-cover": 58, "instagram-feed": 68, "editorial-collage": 48, "device-showcase": 34, "laptop-float": 26, "flat-device-showcase": 34 },
  iconGaps: { "web-cover": 12, "instagram-feed": 14, "editorial-collage": 10, "device-showcase": 10, "laptop-float": 8, "flat-device-showcase": 10 },
});

export const migrateBrandSettings = (brand: BrandSettings | null | undefined): BrandSettings => {
  if (!brand) return createDefaultBrand();
  const brandWithoutLegacyMarker = Object.fromEntries(
    Object.entries(brand).filter(([key]) => key !== "logoDefaultApplied"),
  ) as BrandSettings;
  const logo = brand.logo?.id === "webzad-team-logo-default-v1" ? null : brand.logo;
  const signatureText = brand.signature.text === "Designed by Webzad" ? "" : brand.signature.text;
  const removedBundledLogo = brand.logo?.id === "webzad-team-logo-default-v1";
  const legacyDefaultApplied = (brand as BrandSettings & { logoDefaultApplied?: boolean }).logoDefaultApplied === true;
  const resetLegacyLogoOpacity = removedBundledLogo || (brand.logo === null && legacyDefaultApplied);
  const logoOpacity = resetLegacyLogoOpacity && brand.logoOpacity === 0.04 ? 1 : brand.logoOpacity;
  const oldLogoOpacities = { "web-cover": 0.04, "instagram-feed": 0.04, "editorial-collage": 0.9, "device-showcase": 0.9, "laptop-float": 0.12, "flat-device-showcase": 0.9 };
  const logoOpacities = Object.fromEntries(
    Object.entries(brand.logoOpacities ?? {}).map(([templateId, opacity]) => [
      templateId,
      resetLegacyLogoOpacity && opacity === oldLogoOpacities[templateId as keyof typeof oldLogoOpacities] ? 1 : opacity,
    ]),
  ) as BrandSettings["logoOpacities"];
  const web = getTemplateDefinition("web-cover");
  const social = getTemplateDefinition("instagram-feed");
  const collage = getTemplateDefinition("editorial-collage");
  const deviceShowcase = getTemplateDefinition("device-showcase");
  const laptopFloat = getTemplateDefinition("laptop-float");
  const flatDeviceShowcase = getTemplateDefinition("flat-device-showcase");
  return {
    ...brandWithoutLegacyMarker,
    logo,
    logoOpacity,
    schemaVersion: SCHEMA_VERSION,
    iconSizes: {
      ...brand.iconSizes,
      "web-cover": brand.iconSizes?.["web-cover"] ?? brand.iconSize,
      "instagram-feed": brand.iconSizes?.["instagram-feed"] ?? 68,
      "editorial-collage": brand.iconSizes?.["editorial-collage"] ?? 48,
      "device-showcase": brand.iconSizes?.["device-showcase"] ?? 34,
      "laptop-float": brand.iconSizes?.["laptop-float"] ?? 26,
      "flat-device-showcase": brand.iconSizes?.["flat-device-showcase"] ?? 34,
    },
    iconGaps: {
      ...brand.iconGaps,
      "web-cover": brand.iconGaps?.["web-cover"] ?? brand.iconGap,
      "instagram-feed": brand.iconGaps?.["instagram-feed"] ?? 14,
      "editorial-collage": brand.iconGaps?.["editorial-collage"] ?? 10,
      "device-showcase": brand.iconGaps?.["device-showcase"] ?? 10,
      "laptop-float": brand.iconGaps?.["laptop-float"] ?? 8,
      "flat-device-showcase": brand.iconGaps?.["flat-device-showcase"] ?? 10,
    },
    logoBoxes: {
      ...brand.logoBoxes,
      "web-cover": brand.logoBoxes?.["web-cover"] ?? brand.logoBox ?? { ...web.logoBox },
      "instagram-feed": brand.logoBoxes?.["instagram-feed"] ?? { ...social.logoBox },
      "editorial-collage": brand.logoBoxes?.["editorial-collage"] ?? { ...collage.logoBox },
      "device-showcase": brand.logoBoxes?.["device-showcase"] ?? { ...deviceShowcase.logoBox },
      "laptop-float": brand.logoBoxes?.["laptop-float"] ?? { ...laptopFloat.logoBox },
      "flat-device-showcase": brand.logoBoxes?.["flat-device-showcase"] ?? { ...flatDeviceShowcase.logoBox },
    },
    logoOpacities: {
      ...logoOpacities,
      "web-cover": logoOpacities?.["web-cover"] ?? logoOpacity,
      "instagram-feed": logoOpacities?.["instagram-feed"] ?? logoOpacity,
      "editorial-collage": logoOpacities?.["editorial-collage"] ?? (resetLegacyLogoOpacity ? 1 : 0.9),
      "device-showcase": logoOpacities?.["device-showcase"] ?? (resetLegacyLogoOpacity ? 1 : 0.9),
      "laptop-float": logoOpacities?.["laptop-float"] ?? (resetLegacyLogoOpacity ? 1 : 0.12),
      "flat-device-showcase": logoOpacities?.["flat-device-showcase"] ?? (resetLegacyLogoOpacity ? 1 : 0.9),
    },
    signature: {
      ...brand.signature,
      text: signatureText,
      positions: {
        ...brand.signature.positions,
        "web-cover": brand.signature.positions?.["web-cover"] ?? { x: brand.signature.x, y: brand.signature.y },
        "instagram-feed": brand.signature.positions?.["instagram-feed"]?.x === 50 && brand.signature.positions?.["instagram-feed"]?.y === 1295
          ? { x: 50, y: social.height - social.signature.bottom }
          : brand.signature.positions?.["instagram-feed"] ?? { x: brand.signature.x, y: social.height - social.signature.bottom },
        "editorial-collage": brand.signature.positions?.["editorial-collage"] ?? { x: brand.signature.x, y: collage.height - collage.signature.bottom },
        "device-showcase": brand.signature.positions?.["device-showcase"] ?? { x: 830, y: deviceShowcase.height - deviceShowcase.signature.bottom },
        "laptop-float": brand.signature.positions?.["laptop-float"] ?? { x: laptopFloat.signature.x, y: laptopFloat.height - laptopFloat.signature.bottom },
        "flat-device-showcase": brand.signature.positions?.["flat-device-showcase"] ?? { x: flatDeviceShowcase.signature.x, y: flatDeviceShowcase.height - flatDeviceShowcase.signature.bottom },
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
  mobile: templateId === "device-showcase" || templateId === "flat-device-showcase" ? createDefaultMobileLayer(templateId) : null,
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
  output: { format: "png", scale: templateId === "flat-device-showcase" ? 3 : 1, quality: 0.92 },
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
