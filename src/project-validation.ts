import {
  MAX_ASSET_BYTES,
  MAX_IMAGE_DIMENSION,
  MAX_IMAGE_PIXELS,
  SCHEMA_VERSION,
  type AssetMeta,
  type ProjectState,
} from "./model";
import type { CoverTemplateId } from "./model";
import { getTemplateDefinition, TEMPLATE_DEFINITIONS } from "./templates";

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const within = (value: unknown, min: number, max: number): value is number =>
  isFiniteNumber(value) && value >= min && value <= max;

export const isAsset = (value: unknown): value is AssetMeta => {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    value.id.length <= 120 &&
    typeof value.name === "string" &&
    value.name.length <= 180 &&
    ["image/png", "image/jpeg", "image/webp"].includes(String(value.mime)) &&
    isFiniteNumber(value.width) && Number.isInteger(value.width) &&
    isFiniteNumber(value.height) && Number.isInteger(value.height) &&
    value.width > 0 &&
    value.height > 0 &&
    value.width <= MAX_IMAGE_DIMENSION &&
    value.height <= MAX_IMAGE_DIMENSION &&
    value.width * value.height <= MAX_IMAGE_PIXELS &&
    isFiniteNumber(value.size) &&
    value.size > 0 &&
    value.size <= MAX_ASSET_BYTES
  );
};

const finiteFields = (record: Record<string, unknown>, fields: string[]) =>
  fields.every((field) => isFiniteNumber(record[field]));

const validLayer = (value: unknown) => {
  if (!isRecord(value) || !isRecord(value.shadow)) return false;
  const shadow = value.shadow;
  return (
    (value.asset === null || isAsset(value.asset)) &&
    typeof value.visible === "boolean" &&
    finiteFields(value, ["x", "y", "width", "contentOffsetY"]) &&
    within(value.x, -4000, 4000) &&
    within(value.y, -4000, 4000) &&
    within(value.width, 1, 2160) &&
    within(value.contentOffsetY, 0, MAX_IMAGE_DIMENSION) &&
    (value.viewportHeight === undefined || within(value.viewportHeight, 1, 10800)) &&
    (value.rotation === undefined || within(value.rotation, -45, 45)) &&
    (value.perspective === undefined || within(value.perspective, -45, 45)) &&
    (value.tilt === undefined || within(value.tilt, -45, 45)) &&
    (value.yaw === undefined || within(value.yaw, -45, 45)) &&
    typeof shadow.enabled === "boolean" &&
    finiteFields(shadow, ["offsetX", "offsetY", "blur", "opacity"]) &&
    typeof shadow.color === "string"
  );
};

const validTextItem = (value: unknown) =>
  isRecord(value) &&
  finiteFields(value, ["x", "y", "width", "fontSize", "minFontSize"]) &&
  within(value.x, -2160, 2160) &&
  within(value.y, -2700, 5400) &&
  within(value.width, 1, 1080) &&
  within(value.fontSize, 8, 240) &&
  within(value.minFontSize, 8, 240) &&
  typeof value.color === "string" &&
  ["auto", "rtl", "ltr"].includes(String(value.direction));

export const validateProject = (value: unknown): value is ProjectState => {
  if (!isRecord(value) || value.schemaVersion !== SCHEMA_VERSION) return false;
  if (
    !(Object.keys(TEMPLATE_DEFINITIONS) as CoverTemplateId[]).includes(String(value.templateId) as CoverTemplateId) ||
    typeof value.id !== "string" || value.id.length > 120 ||
    typeof value.name !== "string" || value.name.length > 180 ||
    typeof value.siteName !== "string" || value.siteName.length > 500 ||
    typeof value.templateType !== "string" || value.templateType.length > 500 ||
    typeof value.implementation !== "string" || value.implementation.length > 500 ||
    typeof value.siteNameUppercase !== "boolean" ||
    !Array.isArray(value.selectedTech) || value.selectedTech.length > 15 ||
    !value.selectedTech.every((entry) => typeof entry === "string" && entry.length <= 80) ||
    !Array.isArray(value.customTech) || value.customTech.length > 8 ||
    !value.customTech.every((entry) => isRecord(entry) && typeof entry.id === "string" && typeof entry.label === "string" && isAsset(entry.asset)) ||
    !(value.coverPreview === null || isAsset(value.coverPreview)) ||
    !validLayer(value.front) || !validLayer(value.back) ||
    !(value.mobile === undefined || value.mobile === null || validLayer(value.mobile)) ||
    !isRecord(value.text) ||
    !validTextItem(value.text.siteName) || !validTextItem(value.text.template) || !validTextItem(value.text.implementation) ||
    !isRecord(value.technologies) ||
    !finiteFields(value.technologies, ["x", "y", "width"]) ||
    !within(value.technologies.x, -1080, 2160) ||
    !within(value.technologies.y, -2700, 5400) ||
    !within(value.technologies.width, 1, 1080) ||
    !isRecord(value.output) ||
    !["png", "webp"].includes(String(value.output.format)) ||
    ![1, 2, 3].includes(Number(value.output.scale)) ||
    !within(value.output.quality, 0.5, 1) ||
    !isFiniteNumber(value.updatedAt)
  ) return false;
  return true;
};

/** Migrates older projects and adds an empty cached render where none was stored. */
export const migrateProject = (value: unknown): ProjectState | null => {
  if (!isRecord(value)) return null;
  if (value.schemaVersion !== 1 && value.schemaVersion !== 2 && value.schemaVersion !== 3 && value.schemaVersion !== 4 && value.schemaVersion !== 5 && value.schemaVersion !== 6 && value.schemaVersion !== 7 && value.schemaVersion !== 8) return null;
  const isOldSocialProject = value.schemaVersion < 3 && value.templateId === "instagram-feed";
  const social = getTemplateDefinition("instagram-feed");
  const previousDefaults = {
    front: { x: 545, y: 190, width: 500 },
    back: { x: 650, y: 20, width: 430 },
    siteName: { x: 50, y: 265, width: 405, fontSize: 44, minFontSize: 25 },
    template: { x: 52, y: 335, width: 405, fontSize: 29, minFontSize: 20 },
    implementation: { x: 52, y: 390, width: 405, fontSize: 28, minFontSize: 19 },
    technologies: { x: 50, y: 465, width: 405 },
  };
  const matches = (candidate: unknown, baseline: Record<string, number>) =>
    isRecord(candidate) && Object.entries(baseline).every(([key, expected]) => candidate[key] === expected);
  const migratedFront = isOldSocialProject && isRecord(value.front) && matches(value.front, previousDefaults.front)
    ? { ...value.front, ...social.layers.front }
    : value.front;
  const migratedBack = isOldSocialProject && isRecord(value.back) && matches(value.back, previousDefaults.back)
    ? { ...value.back, ...social.layers.back }
    : value.back;
  const showcaseLayers = getTemplateDefinition("device-showcase").layers;
  const laptopFloat = getTemplateDefinition("laptop-float");
  const resizeLaptopDefaultLayer = (layer: unknown) => {
    if (value.templateId !== "laptop-float" || !isRecord(layer) || (layer.width !== 318 && layer.width !== 324)) return layer;
    const factor = laptopFloat.layers.front.width / layer.width;
    return {
      ...layer,
      width: laptopFloat.layers.front.width,
      ...(isFiniteNumber(layer.viewportHeight) ? { viewportHeight: layer.viewportHeight * factor } : {}),
    };
  };
  const withShowcaseYaw = (layer: unknown, side: "front" | "back" | "mobile") => {
    if (value.templateId !== "device-showcase" || !isRecord(layer)) return layer;
    return { ...layer, yaw: isFiniteNumber(layer.yaw) ? layer.yaw : showcaseLayers[side]?.yaw ?? 0 };
  };
  const migratedText = isRecord(value.text) ? { ...value.text } : null;
  if (isOldSocialProject && isRecord(migratedText)) {
    for (const key of ["siteName", "template", "implementation"] as const) {
      if (isRecord(migratedText[key]) && matches(migratedText[key], previousDefaults[key])) {
        migratedText[key] = { ...migratedText[key], ...social.text[key] };
      }
    }
  }
  const oldLaptopTechPosition = { x: 50, y: 625, width: 350 };
  const migrated = {
    ...value,
    schemaVersion: SCHEMA_VERSION,
    templateId: value.templateId ?? "web-cover",
    coverPreview: value.coverPreview ?? null,
    front: withoutCaptureSource(withShowcaseYaw(resizeLaptopDefaultLayer(migratedFront), "front")),
    back: withoutCaptureSource(withShowcaseYaw(resizeLaptopDefaultLayer(migratedBack), "back")),
    mobile: value.mobile === undefined || value.mobile === null ? null : withoutCaptureSource(withShowcaseYaw(value.mobile, "mobile")),
    output: value.schemaVersion === 7 && value.templateId === "flat-device-showcase" && isRecord(value.output) && value.output.scale === 1
      ? { ...value.output, scale: 3 }
      : value.output,
    text: migratedText ?? value.text,
    technologies: isOldSocialProject && isRecord(value.technologies) && matches(value.technologies, previousDefaults.technologies)
      ? { ...value.technologies, ...social.technologies }
      : value.templateId === "laptop-float" && isRecord(value.technologies) && matches(value.technologies, oldLaptopTechPosition)
        ? { ...value.technologies, ...laptopFloat.technologies }
        : value.technologies,
  };
  return validateProject(migrated) ? migrated : null;
};

const withoutCaptureSource = (value: unknown) => {
  if (!isRecord(value)) return value;
  const { captureSource: _removedCaptureSource, ...layer } = value;
  return layer;
};
