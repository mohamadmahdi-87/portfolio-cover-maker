import { MAX_ASSET_BYTES, type AssetMeta } from "./model";
import { validateImageDimensions } from "./geometry";
import { loadAsset, saveAsset } from "./database";
import { DEFAULT_WEBZAD_LOGO } from "./defaults";

const defaultWebzadLogoUrl = "/brand/webzad-team-logo.png";

export const ensureDefaultWebzadLogo = async () => {
  if (await loadAsset(DEFAULT_WEBZAD_LOGO.id)) return;
  const response = await fetch(defaultWebzadLogoUrl);
  if (!response.ok) throw new Error("فایل لوگوی پیش‌فرض وبزاد پیدا نشد.");
  const blob = await response.blob();
  const details = await inspectImageBlob(blob, "image/png");
  const meta: AssetMeta = { ...DEFAULT_WEBZAD_LOGO, ...details, size: blob.size };
  await saveAsset(meta, blob);
};

const MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export const inspectImageBlob = async (blob: Blob, mime: string) => {
  if (!MIME_TYPES.has(mime)) throw new Error("فقط فایل‌های PNG، JPEG یا WebP پشتیبانی می‌شوند.");
  if (blob.size < 1 || blob.size > MAX_ASSET_BYTES) throw new Error("حجم فایل باید کمتر از ۴۰ مگابایت باشد.");
  const header = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  const isPng = mime === "image/png" && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => header[index] === byte);
  const isJpeg = mime === "image/jpeg" && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  const isWebp =
    mime === "image/webp" &&
    String.fromCharCode(...header.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...header.slice(8, 12)) === "WEBP";
  if (!isPng && !isJpeg && !isWebp) {
    throw new Error("محتوای فایل با فرمت اعلام‌شدهٔ تصویر هم‌خوانی ندارد.");
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    throw new Error("فایل تصویر خراب است یا مرورگر نمی‌تواند آن را باز کند.");
  }
  const { width, height } = bitmap;
  bitmap.close();
  const dimensionError = validateImageDimensions(width, height);
  if (dimensionError) throw new Error(dimensionError);
  return { width, height };
};

export const inspectImageFile = async (file: File): Promise<Omit<AssetMeta, "id">> => {
  const { width, height } = await inspectImageBlob(file, file.type);
  return {
    name: file.name.slice(0, 180),
    mime: file.type as AssetMeta["mime"],
    width,
    height,
    size: file.size,
  };
};

export const persistImageFile = async (file: File): Promise<AssetMeta> => {
  const details = await inspectImageFile(file);
  const meta: AssetMeta = { ...details, id: crypto.randomUUID() };
  await saveAsset(meta, file);
  return meta;
};
