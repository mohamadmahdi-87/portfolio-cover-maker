import type { AssetMeta, BrandSettings, ProjectState } from "./model";
import { inspectImageBlob } from "./file-assets";
import { loadAsset, saveAsset } from "./database";
import { migrateProject } from "./project-validation";

export interface SqlBootstrap {
  projects: ProjectState[];
  brand: BrandSettings | null;
  activeProjectId: string | null;
  assetIds: string[];
}

export const sqlStorageEnabled = import.meta.env.VITE_ENABLE_SQL_STORAGE === "true";

const remoteAssets = new Set<string>();

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(path, init);
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
        ? data.error
        : "ارتباط با پایگاه دادهٔ SQL برقرار نشد.";
    throw new Error(message);
  }
  return data as T;
};

export const loadSqlBootstrap = async () => {
  if (!sqlStorageEnabled) {
    return { projects: [], brand: null, activeProjectId: null, assetIds: [] } satisfies SqlBootstrap;
  }
  const data = await request<SqlBootstrap>("/api/bootstrap");
  if (!Array.isArray(data.projects) || !Array.isArray(data.assetIds)) {
    throw new Error("پاسخ پایگاه دادهٔ SQL معتبر نیست.");
  }
  const projects = data.projects.map(migrateProject);
  if (projects.some((project) => project === null)) {
    throw new Error("SQL contains a project with an unsupported structure.");
  }
  remoteAssets.clear();
  data.assetIds.forEach((id) => remoteAssets.add(id));
  return { ...data, projects: projects.filter((project): project is ProjectState => project !== null) };
};

const collectAssets = (project: ProjectState, brand: BrandSettings) => {
  const assets = [
    project.front.asset,
    project.back.asset,
    project.mobile?.asset ?? null,
    project.coverPreview,
    brand.logo,
    ...project.customTech.map((item) => item.asset),
  ];
  return [...new Map(assets.filter((asset): asset is AssetMeta => Boolean(asset)).map((asset) => [asset.id, asset])).values()];
};

const uploadAsset = async (meta: AssetMeta) => {
  const record = await loadAsset(meta.id);
  if (!record) throw new Error("فایل «" + meta.name + "» در حافظهٔ محلی پیدا نشد.");
  const query = new URLSearchParams({ meta: JSON.stringify(meta) });
  await request<{ ok: true }>("/api/assets/" + encodeURIComponent(meta.id) + "?" + query, {
    method: "PUT",
    headers: { "Content-Type": meta.mime },
    body: record.blob,
  });
  remoteAssets.add(meta.id);
};

export const syncProjectToSql = async (project: ProjectState, brand: BrandSettings, activeProjectId = project.id) => {
  if (!sqlStorageEnabled) return;
  for (const asset of collectAssets(project, brand)) {
    if (!remoteAssets.has(asset.id)) await uploadAsset(asset);
  }
  await request<{ ok: true }>("/api/sync", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project, brand, activeProjectId }),
  });
};

export const hydrateSqlAssets = async (projects: ProjectState[], brand: BrandSettings) => {
  if (!sqlStorageEnabled) return;
  const assets = new Map<string, AssetMeta>();
  for (const project of projects) {
    collectAssets(project, brand).forEach((asset) => assets.set(asset.id, asset));
  }
  for (const meta of assets.values()) {
    if (await loadAsset(meta.id)) continue;
    const response = await fetch("/api/assets/" + encodeURIComponent(meta.id));
    if (!response.ok) throw new Error("تصویر «" + meta.name + "» در SQL در دسترس نیست.");
    const blob = await response.blob();
    const dimensions = await inspectImageBlob(blob, meta.mime);
    if (blob.size !== meta.size || dimensions.width !== meta.width || dimensions.height !== meta.height) {
      throw new Error("فایل «" + meta.name + "» در SQL با اطلاعات پروژه هم‌خوانی ندارد.");
    }
    await saveAsset(meta, blob);
  }
};

export const setSqlActiveProject = async (id: string) => {
  if (!sqlStorageEnabled) return;
  await request<{ ok: true }>("/api/active", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
};

export const deleteSqlProject = async (id: string) => {
  if (!sqlStorageEnabled) return;
  await request<{ ok: true }>("/api/projects/" + encodeURIComponent(id), { method: "DELETE" });
};
