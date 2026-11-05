import { openDB, type DBSchema } from "idb";
import type { AssetMeta, BrandSettings, ProjectState } from "./model";
import { migrateProject } from "./project-validation";

interface PortfolioCoverDB extends DBSchema {
  projects: { key: string; value: ProjectState };
  assets: { key: string; value: { id: string; blob: Blob; meta: AssetMeta } };
  settings: {
    key: string;
    value: { key: string; brand?: BrandSettings; activeProjectId?: string };
  };
}

const database = openDB<PortfolioCoverDB>("portfolio-cover-studio", 1, {
  upgrade(db) {
    db.createObjectStore("projects", { keyPath: "id" });
    db.createObjectStore("assets", { keyPath: "id" });
    db.createObjectStore("settings", { keyPath: "key" });
  },
}).then(async (db) => {
  const migrationKey = "legacy-webzad-storage-migrated";
  if (await db.get("settings", migrationKey)) return db;

  if (typeof indexedDB.databases === "function") {
    const databases = await indexedDB.databases();
    if (databases.some((item) => item.name === "webzad-cover-studio")) {
      const legacy = await openDB<PortfolioCoverDB>("webzad-cover-studio", 1);
      try {
        for (const project of await legacy.getAll("projects")) {
          if (!(await db.get("projects", project.id))) await db.put("projects", project);
        }
        for (const asset of await legacy.getAll("assets")) {
          if (!(await db.get("assets", asset.id))) await db.put("assets", asset);
        }
        for (const setting of await legacy.getAll("settings")) {
          if (!(await db.get("settings", setting.key))) await db.put("settings", setting);
        }
      } finally {
        legacy.close();
      }
    }
    await db.put("settings", { key: migrationKey });
  }
  return db;
});

export const saveProject = async (project: ProjectState) => {
  const db = await database;
  await db.put("projects", project);
};

export const loadProject = async (id: string): Promise<ProjectState | undefined> => {
  const project: unknown = await (await database).get("projects", id);
  return migrateProject(project) ?? undefined;
};

export const listProjects = async (): Promise<ProjectState[]> => {
  const stored: unknown[] = await (await database).getAll("projects");
  return stored.map(migrateProject).filter((project): project is ProjectState => project !== null);
};

export const removeProject = async (id: string) => {
  const db = await database;
  await db.delete("projects", id);
};

export const saveBrand = async (brand: BrandSettings) => {
  const db = await database;
  await db.put("settings", { key: "brand", brand });
};

export const loadBrand = async () => (await database).get("settings", "brand");

export const saveActiveProjectId = async (activeProjectId: string) => {
  const db = await database;
  const existing = await db.get("settings", "active");
  await db.put("settings", { ...existing, key: "active", activeProjectId });
};

export const loadActiveProjectId = async () =>
  (await database).get("settings", "active").then((value) => value?.activeProjectId);

export const saveAsset = async (meta: AssetMeta, blob: Blob) => {
  const db = await database;
  await db.put("assets", { id: meta.id, blob, meta });
};

export const loadAsset = async (id: string) => (await database).get("assets", id);

export const removeAsset = async (id: string) => (await database).delete("assets", id);

export const collectOrphanAssets = async () => {
  const db = await database;
  const [projects, settings, records] = await Promise.all([
    db.getAll("projects"),
    db.get("settings", "brand"),
    db.getAll("assets"),
  ]);
  const referenced = new Set<string>();
  const add = (meta: AssetMeta | null | undefined) => {
    if (meta?.id) referenced.add(meta.id);
  };
  for (const project of projects) {
    add(project.front.asset);
    add(project.back.asset);
    add(project.mobile?.asset);
    add(project.coverPreview);
    for (const item of project.customTech) add(item.asset);
  }
  add(settings?.brand?.logo);
  for (const record of records) {
    if (!referenced.has(record.id)) await db.delete("assets", record.id);
  }
};
