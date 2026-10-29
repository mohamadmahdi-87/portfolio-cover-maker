import type { BrandSettings, ImageLayer, ProjectState } from "./model";
import { SCHEMA_VERSION } from "./model";

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

export const createDefaultLayer = (kind: "front" | "back"): ImageLayer => ({
  asset: null,
  visible: true,
  x: kind === "front" ? 409 : 588,
  y: kind === "front" ? 150 : 0,
  width: kind === "front" ? 484 : 466,
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
  logoBox: { x: 40, y: 75, width: 335, height: 220 },
  logoOpacity: 0.04,
  signature: {
    text: "Designed by Webzad",
    x: 50,
    y: 766,
    fontSize: 27,
    color: "#707070",
  },
  iconSize: 58,
  iconGap: 12,
});

export const createDefaultProject = (name = "پروژهٔ جدید"): ProjectState => ({
  schemaVersion: SCHEMA_VERSION,
  id: crypto.randomUUID(),
  name,
  siteName: "نام وب‌سایت",
  siteNameUppercase: false,
  templateType: "طراحی اختصاصی",
  implementation: "React Development",
  selectedTech: [],
  customTech: [],
  front: createDefaultLayer("front"),
  back: createDefaultLayer("back"),
  text: {
    siteName: {
      x: 50,
      y: 328,
      width: 340,
      fontSize: 44,
      minFontSize: 25,
      color: "#606060",
      direction: "auto",
    },
    template: {
      x: 52,
      y: 397,
      width: 340,
      fontSize: 29,
      minFontSize: 20,
      color: "#808080",
      direction: "auto",
    },
    implementation: {
      x: 52,
      y: 451,
      width: 340,
      fontSize: 28,
      minFontSize: 19,
      color: "#808080",
      direction: "auto",
    },
  },
  technologies: { x: 50, y: 515, width: 340 },
  output: { format: "png", scale: 1, quality: 0.92 },
  updatedAt: Date.now(),
});

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
