export const SCHEMA_VERSION = 1;
export const CANVAS_WIDTH = 1080;
export const CANVAS_HEIGHT = 848;
export const MAX_ASSET_BYTES = 40 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 35_000_000;
export const MAX_IMAGE_DIMENSION = 32_768;

export type Point = { x: number; y: number };
export type Rect = Point & { width: number; height: number };
export type ExportScale = 1 | 2 | 3;
export type ExportFormat = "png" | "webp";
export type TextDirection = "auto" | "rtl" | "ltr";
export type LocalFontFamily = "Vazirmatn" | "Inter";

export interface AssetMeta {
  id: string;
  name: string;
  mime: "image/png" | "image/jpeg" | "image/webp";
  width: number;
  height: number;
  size: number;
}

export interface ShadowSettings {
  enabled: boolean;
  offsetX: number;
  offsetY: number;
  blur: number;
  opacity: number;
  color: string;
}

export interface ImageLayer {
  asset: AssetMeta | null;
  visible: boolean;
  x: number;
  y: number;
  width: number;
  contentOffsetY: number;
  shadow: ShadowSettings;
}

export interface BrandSettings {
  schemaVersion: number;
  fontFamily: LocalFontFamily;
  background: string;
  logo: AssetMeta | null;
  logoVisible: boolean;
  logoBox: Rect;
  logoOpacity: number;
  signature: {
    text: string;
    x: number;
    y: number;
    fontSize: number;
    color: string;
  };
  iconSize: number;
  iconGap: number;
}

export interface TextItem {
  x: number;
  y: number;
  width: number;
  fontSize: number;
  minFontSize: number;
  color: string;
  direction: TextDirection;
}

export interface ProjectState {
  schemaVersion: number;
  id: string;
  name: string;
  siteName: string;
  siteNameUppercase: boolean;
  templateType: string;
  implementation: string;
  selectedTech: string[];
  customTech: Array<{ id: string; label: string; asset: AssetMeta }>;
  front: ImageLayer;
  back: ImageLayer;
  text: {
    siteName: TextItem;
    template: TextItem;
    implementation: TextItem;
  };
  technologies: { x: number; y: number; width: number };
  output: { format: ExportFormat; scale: ExportScale; quality: number };
  updatedAt: number;
}

export interface RenderResources {
  logo?: CanvasImageSource;
  front?: CanvasImageSource;
  back?: CanvasImageSource;
  techCustom: Map<string, CanvasImageSource>;
}

export interface StoredProject {
  project: ProjectState;
}

export interface ArchiveManifest {
  schemaVersion: number;
  exportedAt: string;
  project: ProjectState;
  brand: BrandSettings;
  assets: Array<{ id: string; path: string; name: string; mime: string; size: number }>;
}
