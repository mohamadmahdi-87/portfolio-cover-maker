import {
  MAX_ASSET_BYTES,
  MAX_IMAGE_DIMENSION,
  MAX_IMAGE_PIXELS,
  SCHEMA_VERSION,
  type AssetMeta,
  type ProjectState,
} from "./model";

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
    typeof shadow.enabled === "boolean" &&
    finiteFields(shadow, ["offsetX", "offsetY", "blur", "opacity"]) &&
    typeof shadow.color === "string"
  );
};

const validTextItem = (value: unknown) =>
  isRecord(value) &&
  finiteFields(value, ["x", "y", "width", "fontSize", "minFontSize"]) &&
  within(value.x, -2160, 2160) &&
  within(value.y, -1696, 1696) &&
  within(value.width, 1, 1080) &&
  within(value.fontSize, 8, 240) &&
  within(value.minFontSize, 8, 240) &&
  typeof value.color === "string" &&
  ["auto", "rtl", "ltr"].includes(String(value.direction));

export const validateProject = (value: unknown): value is ProjectState => {
  if (!isRecord(value) || value.schemaVersion !== SCHEMA_VERSION) return false;
  if (
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
    !validLayer(value.front) || !validLayer(value.back) ||
    !isRecord(value.text) ||
    !validTextItem(value.text.siteName) || !validTextItem(value.text.template) || !validTextItem(value.text.implementation) ||
    !isRecord(value.technologies) ||
    !finiteFields(value.technologies, ["x", "y", "width"]) ||
    !within(value.technologies.x, -1080, 2160) ||
    !within(value.technologies.y, -848, 1696) ||
    !within(value.technologies.width, 1, 1080) ||
    !isRecord(value.output) ||
    !["png", "webp"].includes(String(value.output.format)) ||
    ![1, 2, 3].includes(Number(value.output.scale)) ||
    !within(value.output.quality, 0.5, 1) ||
    !isFiniteNumber(value.updatedAt)
  ) return false;
  return true;
};
