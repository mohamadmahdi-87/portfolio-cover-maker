import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_ASSET_BYTES } from "./model";
import { inspectImageBlob } from "./file-assets";

vi.mock("./database", () => ({ saveAsset: vi.fn() }));

const signatures = {
  "image/png": [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0],
  "image/jpeg": [255, 216, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  "image/webp": [82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80],
} as const;

const imageBlob = (mime: keyof typeof signatures = "image/png") =>
  new Blob([new Uint8Array(signatures[mime])], { type: mime });

const decodedImage = (width = 480, height = 1800) => ({ width, height, close: vi.fn() });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("image upload validation", () => {
  it.each(Object.keys(signatures) as Array<keyof typeof signatures>)("accepts a decodable %s image", async (mime) => {
    const bitmap = decodedImage();
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));

    await expect(inspectImageBlob(imageBlob(mime), mime)).resolves.toEqual({ width: 480, height: 1800 });
    expect(bitmap.close).toHaveBeenCalledOnce();
  });

  it("rejects unsupported media types before decoding", async () => {
    const decode = vi.fn();
    vi.stubGlobal("createImageBitmap", decode);

    await expect(inspectImageBlob(new Blob(["not an image"]), "image/svg+xml")).rejects.toThrow();
    expect(decode).not.toHaveBeenCalled();
  });

  it("rejects a file whose bytes do not match its declared image type", async () => {
    const decode = vi.fn();
    vi.stubGlobal("createImageBitmap", decode);

    await expect(inspectImageBlob(new Blob(["not a PNG"]), "image/png")).rejects.toThrow();
    expect(decode).not.toHaveBeenCalled();
  });

  it("rejects a broken image when the browser decoder cannot open it", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("decode failed")));

    await expect(inspectImageBlob(imageBlob(), "image/png")).rejects.toThrow();
  });

  it("rejects files above the size limit before reading their contents", async () => {
    const oversized = { size: MAX_ASSET_BYTES + 1, slice: vi.fn() } as unknown as Blob;

    await expect(inspectImageBlob(oversized, "image/png")).rejects.toThrow();
    expect(oversized.slice).not.toHaveBeenCalled();
  });

  it.each([
    [32_769, 1],
    [6_000, 6_000],
  ])("rejects unsafe decoded dimensions %i × %i", async (width, height) => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(decodedImage(width, height)));

    await expect(inspectImageBlob(imageBlob(), "image/png")).rejects.toThrow();
  });
});
