import { describe, expect, it } from "vitest";
import { createDefaultBrand, createDefaultProject } from "./defaults";
import { validateProject } from "./project-validation";

describe("project data validation", () => {
  it("round-trips a versioned project through JSON", () => {
    const project = createDefaultProject("نمونهٔ آزمایشی");
    const restored: unknown = JSON.parse(JSON.stringify(project));
    expect(validateProject(restored)).toBe(true);
    expect((restored as typeof project).siteName).toBe("نام وب‌سایت");
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
    expect(brand.logo).toBeNull();
  });
});
