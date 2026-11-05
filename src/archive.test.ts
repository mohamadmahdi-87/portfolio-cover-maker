import { describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import { buildProjectArchive, importProjectArchive } from "./archive";
import { createDefaultBrand, createDefaultProject, migrateBrandSettings } from "./defaults";
import { SCHEMA_VERSION } from "./model";
import { migrateProject, validateProject } from "./project-validation";

const { assetRecords } = vi.hoisted(() => ({
  assetRecords: new Map<string, { id: string; blob: Blob; meta: { id: string; name: string; mime: "image/png"; width: number; height: number; size: number } }>(),
}));

vi.mock("./database", () => ({
  loadAsset: vi.fn(async (id: string) => assetRecords.get(id)),
  saveAsset: vi.fn(async () => undefined),
}));

describe("project data validation", () => {
  it("round-trips a versioned project through JSON", () => {
    const project = createDefaultProject("نمونهٔ آزمایشی");
    const restored: unknown = JSON.parse(JSON.stringify(project));
    expect(validateProject(restored)).toBe(true);
    expect((restored as typeof project).siteName).toBe("نام وب‌سایت");
  });

  it("round-trips the floating laptop template in a portable project archive", async () => {
    const project = createDefaultProject("لپ‌تاپ شناور", "laptop-float");
    const brand = { ...createDefaultBrand(), logo: null };
    const archive = await buildProjectArchive(project, brand);
    const file = new File([archive], "laptop-project.zip", { type: "application/zip" });
    const restored = await importProjectArchive(file);
    expect(restored.project.templateId).toBe("laptop-float");
    expect(restored.project.front).toMatchObject({ x: 474, y: 55 });
    expect(restored.project.back).toMatchObject({ x: 350, y: 205 });
    expect(restored.project.mobile).toBeNull();
  });

  it("rejects incompatible or malformed project data", () => {
    const project = createDefaultProject();
    expect(validateProject({ ...project, schemaVersion: 99 })).toBe(false);
    expect(validateProject({ ...project, front: { ...project.front, width: Number.NaN } })).toBe(false);
  });

  it("keeps local brand defaults independent from project content", () => {
    const brand = createDefaultBrand();
    expect(brand.signature.text).toBe("Designed by Webzad");
    expect(createDefaultProject().front.asset).toBeNull();
    expect(brand.logo?.name).toBe("لوگوی تیم وبزاد");
  });

  it("migrates projects created before templates existed without changing their web-cover layout", () => {
    const legacyProject = { ...createDefaultProject("پروژه قدیمی"), schemaVersion: 1, templateId: undefined };
    const migrated = migrateProject(legacyProject);
    expect(migrated?.templateId).toBe("web-cover");
    expect(migrated?.schemaVersion).toBe(SCHEMA_VERSION);
    expect(migrated?.coverPreview).toBeNull();
    expect(migrated?.front.x).toBe(409);
    expect(migrated?.front.y).toBe(150);
    expect(validateProject(migrated)).toBe(true);
  });

  it("creates the social feed project with a square layout and template-specific styling", () => {
    const project = createDefaultProject("پست شبکه اجتماعی", "instagram-feed");
    const brand = createDefaultBrand();
    expect(project.templateId).toBe("instagram-feed");
    expect(project.back).toMatchObject({ x: 720, y: 45, width: 330 });
    expect(project.front).toMatchObject({ x: 465, y: 245, width: 425 });
    expect(brand.signature.positions?.["instagram-feed"]).toEqual({ x: 50, y: 1032 });
    expect(brand.iconSizes?.["instagram-feed"]).toBe(68);
    expect(validateProject(project)).toBe(true);
  });

  it("creates the editorial collage with its own logo, signature, and technology defaults", () => {
    const project = createDefaultProject("کلاژ نمونه‌کار", "editorial-collage");
    const brand = createDefaultBrand();
    expect(project.templateId).toBe("editorial-collage");
    expect(project.back).toMatchObject({ x: 38, y: 0, width: 590 });
    expect(project.front).toMatchObject({ x: 430, y: 340, width: 610 });
    expect(brand.logoBoxes?.["editorial-collage"]).toEqual({ x: 690, y: 24, width: 340, height: 92 });
    expect(brand.logoOpacities?.["editorial-collage"]).toBe(0.9);
    expect(brand.signature.positions?.["editorial-collage"]).toEqual({ x: 50, y: 1298 });
    expect(brand.iconSizes?.["editorial-collage"]).toBe(48);
    expect(validateProject(project)).toBe(true);
  });

  it("migrates older brand data and preserves its shared signature and logo bounds", () => {
    const current = createDefaultBrand();
    const legacyBrand = {
      ...current,
      schemaVersion: 1,
      logoBoxes: undefined,
      logoBox: { x: 12, y: 34, width: 230, height: 110 },
      signature: { ...current.signature, x: 20, y: 760, positions: undefined },
    };
    const migrated = migrateBrandSettings(legacyBrand);
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
    expect(migrated.logoBoxes?.["web-cover"]).toEqual(legacyBrand.logoBox);
    expect(migrated.signature.positions?.["web-cover"]).toEqual({ x: 20, y: 760 });
    expect(migrated.signature.positions?.["instagram-feed"]).toEqual({ x: 20, y: 1032 });
  });

  it("round-trips a social project through its portable archive", async () => {
    const project = createDefaultProject("نمونه پست", "instagram-feed");
    const brand = { ...createDefaultBrand(), logo: null };
    const archive = await buildProjectArchive(project, brand);
    const imported = await importProjectArchive(new File([archive], "social.zip", { type: "application/zip" }));
    expect(imported.project.templateId).toBe("instagram-feed");
    expect(imported.project.schemaVersion).toBe(SCHEMA_VERSION);
    expect(imported.brand.logoBoxes?.["instagram-feed"]).toEqual(brand.logoBoxes?.["instagram-feed"]);
  });

  it("round-trips the editorial template and its per-template logo opacity through ZIP", async () => {
    const project = createDefaultProject("کلاژ", "editorial-collage");
    const brand = { ...createDefaultBrand(), logo: null };
    const archive = await buildProjectArchive(project, brand);
    const imported = await importProjectArchive(new File([archive], "collage.zip", { type: "application/zip" }));
    expect(imported.project.templateId).toBe("editorial-collage");
    expect(imported.brand.logoOpacities?.["editorial-collage"]).toBe(0.9);
  });

  it("includes the latest rendered card preview in the project archive", async () => {
    assetRecords.clear();
    const preview = { id: "preview-1", name: "preview.png", mime: "image/png" as const, width: 540, height: 540, size: 3 };
    assetRecords.set(preview.id, { id: preview.id, meta: preview, blob: new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }) });
    const project = { ...createDefaultProject("پروژهٔ خروجی"), coverPreview: preview };
    const archive = await buildProjectArchive(project, { ...createDefaultBrand(), logo: null });
    const zip = await JSZip.loadAsync(archive);
    const manifest = JSON.parse(await zip.file("manifest.json")!.async("string")) as { assets: Array<{ id: string }> };
    expect(manifest.assets.map((asset) => asset.id)).toEqual([preview.id]);
    expect(await zip.file("assets/image-001.png")?.async("uint8array")).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("migrates version 2 project data by initializing its optional rendered preview", () => {
    const previous = { ...createDefaultProject("نسخهٔ دو"), schemaVersion: 2, coverPreview: undefined };
    const migrated = migrateProject(previous);
    expect(migrated?.schemaVersion).toBe(SCHEMA_VERSION);
    expect(migrated?.coverPreview).toBeNull();
    expect(validateProject(migrated)).toBe(true);
  });

  it("migrates schema version 3 project and brand data into the current schema", () => {
    const oldProject = { ...createDefaultProject("نسخهٔ سه"), schemaVersion: 3 };
    const oldBrand = { ...createDefaultBrand(), schemaVersion: 3, logoOpacities: undefined };
    const project = migrateProject(oldProject);
    const brand = migrateBrandSettings(oldBrand);
    expect(project?.schemaVersion).toBe(SCHEMA_VERSION);
    expect(brand.schemaVersion).toBe(SCHEMA_VERSION);
    expect(brand.logoOpacities?.["editorial-collage"]).toBe(0.9);
  });

  it("adds default horizontal perspective to existing device showcase layers", () => {
    const current = createDefaultProject("قالب دستگاه", "device-showcase");
    const legacy = {
      ...current,
      front: { ...current.front, yaw: undefined },
      back: { ...current.back, yaw: undefined },
      mobile: current.mobile ? { ...current.mobile, yaw: undefined } : null,
    };
    const migrated = migrateProject(legacy);
    expect(migrated?.front.yaw).toBe(12);
    expect(migrated?.back.yaw).toBe(-11);
    expect(migrated?.mobile?.yaw).toBe(5);
    expect(validateProject(migrated)).toBe(true);
  });

  it("moves the old laptop template's default technology row to the lower-left footer", () => {
    const project = createDefaultProject("لپ‌تاپ قدیمی", "laptop-float");
    const legacy = { ...project, technologies: { x: 50, y: 625, width: 350 } };
    const migrated = migrateProject(legacy);
    expect(migrated?.technologies).toEqual({ x: 50, y: 642, width: 510 });
  });

  it("aligns legacy floating screenshot widths with the laptop display while preserving the user's placement", () => {
    const project = createDefaultProject("پروژهٔ لپ‌تاپ", "laptop-float");
    const legacy = {
      ...project,
      front: { ...project.front, x: 478, y: 38, width: 318, viewportHeight: 179, rotation: -10 },
      back: { ...project.back, x: 365, y: 125, width: 324, viewportHeight: 186, rotation: -9 },
    };
    const migrated = migrateProject(legacy);
    expect(migrated?.front).toMatchObject({ x: 478, y: 38, width: 344, rotation: -10 });
    expect(migrated?.front.viewportHeight).toBeCloseTo(179 * 344 / 318);
    expect(migrated?.back).toMatchObject({ x: 365, y: 125, width: 344, rotation: -9 });
    expect(migrated?.back.viewportHeight).toBeCloseTo(186 * 344 / 324);
  });

  it("migrates temporary schema 5 capture metadata into the current schema without losing the image layer", () => {
    const project = createDefaultProject("پروژهٔ دارای تصویر دستی");
    const legacy = {
      ...project,
      schemaVersion: 5,
      front: {
        ...project.front,
        x: 460,
        captureSource: {
          url: "http://localhost:5173/",
          profile: "desktop-full",
          capturedAt: new Date().toISOString(),
          viewportWidth: 1440,
          viewportHeight: 900,
          imageWidth: 1440,
          imageHeight: 2600,
        },
      },
    };
    const migrated = migrateProject(legacy);
    expect(migrated?.schemaVersion).toBe(SCHEMA_VERSION);
    expect(migrated?.front.x).toBe(460);
    expect(migrated?.front).not.toHaveProperty("captureSource");
    expect(migrated?.mobile).toBeNull();
    expect(validateProject(migrated)).toBe(true);
  });

  it("imports archives saved by the removed schema 5 capture feature", async () => {
    const project = createDefaultProject("آرشیو قدیمی");
    const legacyProject = {
      ...project,
      schemaVersion: 5,
      back: {
        ...project.back,
        captureSource: {
          url: "http://project.test/",
          profile: "mobile-full",
          capturedAt: new Date().toISOString(),
          viewportWidth: 390,
          viewportHeight: 844,
          imageWidth: 390,
          imageHeight: 1800,
        },
      },
    };
    const legacyBrand = { ...createDefaultBrand(), schemaVersion: 5, logo: null };
    const zip = new JSZip();
    zip.file("manifest.json", JSON.stringify({
      schemaVersion: 5,
      exportedAt: new Date().toISOString(),
      project: legacyProject,
      brand: legacyBrand,
      assets: [],
    }));
    const archive = await zip.generateAsync({ type: "blob" });
    const imported = await importProjectArchive(new File([archive], "legacy-capture.zip", { type: "application/zip" }));
    expect(imported.project.schemaVersion).toBe(SCHEMA_VERSION);
    expect(imported.project.back).not.toHaveProperty("captureSource");
    expect(imported.brand.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it("updates untouched version 2 social defaults but preserves customized positions", () => {
    const base = createDefaultProject("پست قدیمی", "instagram-feed");
    const previous = {
      ...base,
      schemaVersion: 2,
      coverPreview: undefined,
      front: { ...base.front, x: 545, y: 190, width: 500 },
      back: { ...base.back, x: 650, y: 20, width: 430 },
      text: {
        siteName: { ...base.text.siteName, x: 50, y: 265, width: 405, fontSize: 44, minFontSize: 25 },
        template: { ...base.text.template, x: 52, y: 335, width: 405, fontSize: 29, minFontSize: 20 },
        implementation: { ...base.text.implementation, x: 52, y: 390, width: 405, fontSize: 28, minFontSize: 19 },
      },
      technologies: { x: 50, y: 465, width: 405 },
    };
    const migrated = migrateProject(previous);
    expect(migrated?.front).toMatchObject({ x: 465, y: 245, width: 425 });
    expect(migrated?.back).toMatchObject({ x: 720, y: 45, width: 330 });
    expect(migrated?.text.siteName).toMatchObject({ x: 50, y: 275, width: 395, fontSize: 52 });
    expect(migrated?.technologies).toEqual({ x: 50, y: 525, width: 395 });

    const customized = migrateProject({ ...previous, front: { ...previous.front, x: 510 } });
    expect(customized?.front).toMatchObject({ x: 510, y: 190, width: 500 });
  });

  it("imports a version 1 archive and upgrades its project and brand", async () => {
    const project = { ...createDefaultProject("پروژه قدیمی"), schemaVersion: 1, templateId: undefined };
    const currentBrand = createDefaultBrand();
    const brand = {
      ...currentBrand,
      schemaVersion: 1,
      logo: null,
      logoBoxes: undefined,
      signature: { ...currentBrand.signature, positions: undefined },
    };
    const zip = new JSZip();
    zip.file("manifest.json", JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), project, brand, assets: [] }));
    const file = new File([await zip.generateAsync({ type: "blob" })], "legacy.zip", { type: "application/zip" });
    const imported = await importProjectArchive(file);
    expect(imported.project.templateId).toBe("web-cover");
    expect(imported.project.schemaVersion).toBe(SCHEMA_VERSION);
    expect(imported.brand.schemaVersion).toBe(SCHEMA_VERSION);
    expect(imported.brand.signature.positions?.["instagram-feed"]).toEqual({ x: 50, y: 1032 });
  });
});
