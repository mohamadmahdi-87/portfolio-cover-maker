import JSZip from "jszip";
import { loadAsset, saveAsset } from "./database";
import { MAX_ASSET_BYTES, SCHEMA_VERSION, type ArchiveManifest, type AssetMeta, type BrandSettings, type ProjectState } from "./model";
import { inspectImageBlob } from "./file-assets";
import { isAsset, isFiniteNumber, isRecord, validateProject } from "./project-validation";

const MAX_ARCHIVE_BYTES = 150 * 1024 * 1024;
const MAX_ARCHIVE_FILES = 24;
const MAX_ARCHIVE_TOTAL = 150 * 1024 * 1024;

const hasFiniteFields = (value: Record<string, unknown>, fields: string[]) =>
  fields.every((key) => isFiniteNumber(value[key]));
const within = (value: unknown, min: number, max: number) =>
  isFiniteNumber(value) && value >= min && value <= max;
const isHexColor = (value: unknown) => typeof value === "string" && /^#[0-9a-f]{6}$/iu.test(value);

type ArchiveAssetEntry = { id: string; path: string; name: string; mime: AssetMeta["mime"]; size: number };

const isArchiveAssetEntry = (value: unknown): value is ArchiveAssetEntry => {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.path === "string" &&
    typeof value.name === "string" &&
    ["image/png", "image/jpeg", "image/webp"].includes(String(value.mime)) &&
    isFiniteNumber(value.size) &&
    value.size >= 1 &&
    value.size <= MAX_ASSET_BYTES &&
    /^assets\/image-[0-9]{3}\.(png|jpg|webp)$/u.test(value.path)
  );
};

const validateBrand = (value: unknown): value is BrandSettings => {
  if (!isRecord(value) || value.schemaVersion !== SCHEMA_VERSION) return false;
  if (
    !isHexColor(value.background) ||
    !["Vazirmatn", "Inter"].includes(String(value.fontFamily)) ||
    (value.logo !== null && !isAsset(value.logo)) ||
    typeof value.logoVisible !== "boolean" ||
    !isRecord(value.logoBox) ||
    !hasFiniteFields(value.logoBox, ["x", "y", "width", "height"]) ||
    !within(value.logoBox.x, -2160, 2160) || !within(value.logoBox.y, -1696, 1696) ||
    !within(value.logoBox.width, 1, 2160) || !within(value.logoBox.height, 1, 1696) ||
    !within(value.logoOpacity, 0, 1) ||
    !isRecord(value.signature) ||
    typeof value.signature.text !== "string" || value.signature.text.length > 180 ||
    !hasFiniteFields(value.signature, ["x", "y", "fontSize"]) ||
    !within(value.signature.x, -2160, 2160) || !within(value.signature.y, -1696, 1696) ||
    !within(value.signature.fontSize, 12, 80) ||
    !isHexColor(value.signature.color) ||
    !within(value.iconSize, 18, 120) ||
    !within(value.iconGap, 0, 80)
  ) {
    return false;
  }
  return true;
};

export const buildProjectArchive = async (project: ProjectState, brand: BrandSettings): Promise<Blob> => {
  const references = new Map<string, AssetMeta>();
  const add = (asset: AssetMeta | null) => {
    if (asset) references.set(asset.id, asset);
  };
  add(project.front.asset);
  add(project.back.asset);
  add(brand.logo);
  for (const technology of project.customTech) add(technology.asset);

  const zip = new JSZip();
  const manifestAssets: ArchiveManifest["assets"] = [];
  let index = 0;
  for (const [id, meta] of references) {
    const record = await loadAsset(id);
    if (!record) throw new Error("یکی از فایل‌های تصویری پروژه در ذخیره‌سازی محلی پیدا نشد.");
    index += 1;
    const extension = meta.mime === "image/jpeg" ? "jpg" : meta.mime === "image/webp" ? "webp" : "png";
    const path = "assets/image-" + String(index).padStart(3, "0") + "." + extension;
    zip.file(path, record.blob);
    manifestAssets.push({ id, path, name: meta.name, mime: meta.mime, size: meta.size });
  }
  const manifest: ArchiveManifest = {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    project,
    brand,
    assets: manifestAssets,
  };
  zip.file("manifest.json", JSON.stringify(manifest));
  return zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
};

export interface ImportedArchive {
  project: ProjectState;
  brand: BrandSettings;
}

export const importProjectArchive = async (file: File): Promise<ImportedArchive> => {
  if (file.size < 1 || file.size > MAX_ARCHIVE_BYTES) {
    throw new Error("فایل پشتیبان باید کوچک‌تر از ۱۵۰ مگابایت باشد.");
  }
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file, { checkCRC32: true });
  } catch {
    throw new Error("فایل انتخاب‌شده ZIP معتبر نیست یا خراب شده است.");
  }
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  if (entries.length < 1 || entries.length > MAX_ARCHIVE_FILES) {
    throw new Error("تعداد فایل‌های داخل پشتیبان از حد مجاز بیشتر است.");
  }
  const manifestEntry = zip.file("manifest.json");
  if (!manifestEntry) throw new Error("فایل manifest.json در پشتیبان پیدا نشد.");
  let manifest: unknown;
  try {
    const text = await manifestEntry.async("string");
    if (text.length > 1_000_000) throw new Error("manifest too large");
    manifest = JSON.parse(text) as unknown;
  } catch {
    throw new Error("ساختار manifest پشتیبان قابل‌خواندن نیست.");
  }
  if (
    !isRecord(manifest) ||
    manifest.schemaVersion !== SCHEMA_VERSION ||
    !validateProject(manifest.project) ||
    !validateBrand(manifest.brand) ||
    !Array.isArray(manifest.assets) ||
    manifest.assets.length > MAX_ARCHIVE_FILES - 1
  ) {
    throw new Error("نسخه یا ساختار فایل پشتیبان پشتیبانی نمی‌شود.");
  }

  const project = manifest.project;
  const brand = manifest.brand;
  const assetEntries: ArchiveAssetEntry[] = [];
  for (const value of manifest.assets) {
    if (!isArchiveAssetEntry(value)) {
      throw new Error("مشخصات یکی از فایل‌های تصویری پشتیبان معتبر نیست.");
    }
    assetEntries.push({
      id: value.id,
      path: value.path,
      name: value.name,
      mime: value.mime,
      size: value.size,
    });
  }
  const listedIds = new Set(assetEntries.map((asset) => asset.id));
  if (listedIds.size !== assetEntries.length) throw new Error("فایل‌های تکراری در manifest پشتیبان پیدا شد.");
  const referencedAssets = [project.front.asset, project.back.asset, brand.logo, ...project.customTech.map((item) => item.asset)]
    .filter((asset): asset is AssetMeta => Boolean(asset));
  const referencedById = new Map<string, AssetMeta>();
  for (const meta of referencedAssets) {
    const previous = referencedById.get(meta.id);
    if (previous && (previous.mime !== meta.mime || previous.width !== meta.width || previous.height !== meta.height)) {
      throw new Error("مشخصات فایل تکراری پروژه با هم سازگار نیست.");
    }
    referencedById.set(meta.id, meta);
  }
  if (referencedById.size !== listedIds.size || [...referencedById.keys()].some((id) => !listedIds.has(id))) {
    throw new Error("فهرست فایل‌های لازم پروژه با manifest پشتیبان سازگار نیست.");
  }

  let totalBytes = 0;
  const pendingAssets: Array<{ meta: AssetMeta; blob: Blob }> = [];
  for (const asset of assetEntries) {
    const expected = referencedById.get(asset.id);
    if (!expected || expected.mime !== asset.mime) throw new Error("نوع فایل پشتیبان با پروژه سازگار نیست.");
    const expectedExtension = asset.mime === "image/jpeg" ? "jpg" : asset.mime === "image/webp" ? "webp" : "png";
    if (!asset.path.endsWith("." + expectedExtension)) throw new Error("پسوند فایل با نوع تصویر پشتیبان سازگار نیست.");
    const entry = zip.file(asset.path);
    if (!entry) throw new Error("یکی از فایل‌های تصویری داخل ZIP پیدا نشد.");
    const blob = await entry.async("blob");
    totalBytes += blob.size;
    if (blob.size !== asset.size || totalBytes > MAX_ARCHIVE_TOTAL) {
      throw new Error("حجم داده‌های بازشده با اطلاعات پشتیبان سازگار نیست.");
    }
    const dimensions = await inspectImageBlob(blob, asset.mime);
    if (dimensions.width !== expected.width || dimensions.height !== expected.height) {
      throw new Error("ابعاد تصویر پشتیبان با اطلاعات پروژه سازگار نیست.");
    }
    pendingAssets.push({ meta: { ...expected, name: asset.name.slice(0, 180), size: blob.size }, blob });
  }
  await Promise.all(pendingAssets.map(({ meta, blob }) => saveAsset(meta, blob)));
  return { project, brand };
};
