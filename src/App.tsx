import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  Check,
  Download,
  Eye,
  EyeOff,
  FileArchive,
  FolderOpen,
  ImagePlus,
  Layers,
  LoaderCircle,
  Move,
  Palette,
  Plus,
  RotateCcw,
  Save,
  Settings2,
  Trash2,
  Type,
  X,
} from "lucide-react";
import {
  CheckField,
  ColorField,
  NumberField,
  RangeField,
  SectionPanel,
  UploadButton,
  formatBytes,
  formatDimensions,
} from "./components";
import { importProjectArchive, buildProjectArchive } from "./archive";
import {
  createDefaultBrand,
  createDefaultLayer,
  createDefaultProject,
  IMPLEMENTATION_SUGGESTIONS,
  TEMPLATE_SUGGESTIONS,
} from "./defaults";
import {
  collectOrphanAssets,
  listProjects,
  loadActiveProjectId,
  loadAsset,
  loadBrand,
  loadProject,
  removeProject,
  saveActiveProjectId,
  saveBrand,
  saveProject,
} from "./database";
import { persistImageFile } from "./file-assets";
import {
  deleteSqlProject,
  hydrateSqlAssets,
  loadSqlBootstrap,
  setSqlActiveProject,
  syncProjectToSql,
} from "./sql-api";
import { clamp, naturalImageRect, safeCanvasPoint } from "./geometry";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  type AssetMeta,
  type BrandSettings,
  type ExportFormat,
  type ExportScale,
  type ImageLayer,
  type ProjectState,
  type RenderResources,
} from "./model";
import { layoutWarnings, renderCover } from "./renderer";
import { technologyCatalog } from "./technology-icons";

type LayerSide = "front" | "back";
type Notice = { kind: "success" | "error"; text: string } | null;
type SaveState = "loading" | "saving" | "saved" | "error";

function LayerControls({
  side,
  layer,
  selected,
  onSelect,
  onChange,
  onUpload,
  onRemove,
  onReset,
}: {
  side: LayerSide;
  layer: ImageLayer;
  selected: boolean;
  onSelect: () => void;
  onChange: (layer: ImageLayer) => void;
  onUpload: (file: File) => void;
  onRemove: () => void;
  onReset: () => void;
}) {
  const label = side === "front" ? "تصویر جلو" : "تصویر عقب";
  const set = (change: Partial<ImageLayer>) => onChange({ ...layer, ...change });
  const setShadow = (change: Partial<ImageLayer["shadow"]>) =>
    onChange({ ...layer, shadow: { ...layer.shadow, ...change } });

  return (
    <div className={"layer-card" + (selected ? " is-selected" : "")}>
      <div className="layer-card-head">
        <button className="layer-title" type="button" onClick={onSelect} aria-pressed={selected}>
          <span className="layer-dot" />
          <span>{label}</span>
          {selected && <span className="selected-pill">انتخاب‌شده</span>}
        </button>
        <button className="icon-button subtle" type="button" onClick={onReset} aria-label={"بازنشانی تنظیمات " + label}>
          <RotateCcw size={15} aria-hidden="true" />
        </button>
      </div>
      <div className="layer-file-row">
        <UploadButton
          id={"upload-" + side}
          label={layer.asset ? "جایگزینی تصویر" : "بارگذاری تصویر"}
          onFile={onUpload}
        />
        {layer.asset && (
          <button className="icon-button danger" type="button" onClick={onRemove} aria-label={"حذف " + label}>
            <Trash2 size={16} aria-hidden="true" />
          </button>
        )}
        <CheckField
          id={"visible-" + side}
          label="نمایش"
          checked={layer.visible}
          onChange={(visible) => set({ visible })}
        />
      </div>
      {layer.asset ? (
        <div className="asset-meta">
          <span className="asset-name" title={layer.asset.name}>{layer.asset.name}</span>
          <span>{formatDimensions(layer.asset.width, layer.asset.height)}</span>
          <span>{formatBytes(layer.asset.size)}</span>
        </div>
      ) : (
        <p className="field-hint">PNG، JPEG یا WebP؛ تا ۴۰ مگابایت</p>
      )}
      <div className="field-grid three">
        <NumberField id={side + "-x"} label="جایگاه X" value={layer.x} min={-1080} max={2160} onChange={(x) => set({ x })} />
        <NumberField id={side + "-y"} label="جایگاه Y" value={layer.y} min={-848} max={1696} onChange={(y) => set({ y })} />
        <NumberField id={side + "-width"} label="عرض" value={layer.width} min={20} max={2160} onChange={(width) => set({ width })} />
      </div>
      <RangeField
        id={side + "-content"}
        label="جابجایی محتوای تصویر"
        value={layer.contentOffsetY}
        min={0}
        max={layer.asset ? Math.min(layer.asset.height * (layer.width / layer.asset.width), 20000) : 20000}
        step={1}
        suffix=" px"
        onChange={(contentOffsetY) => set({ contentOffsetY })}
      />
      <CheckField
        id={side + "-shadow"}
        label="سایه"
        checked={layer.shadow.enabled}
        onChange={(enabled) => setShadow({ enabled })}
      />
      {layer.shadow.enabled && (
        <div className="field-grid three shadow-grid">
          <NumberField id={side + "-shadow-x"} label="سایه X" value={layer.shadow.offsetX} min={-120} max={120} onChange={(offsetX) => setShadow({ offsetX })} />
          <NumberField id={side + "-shadow-y"} label="سایه Y" value={layer.shadow.offsetY} min={-120} max={120} onChange={(offsetY) => setShadow({ offsetY })} />
          <NumberField id={side + "-shadow-blur"} label="محو" value={layer.shadow.blur} min={0} max={120} onChange={(blur) => setShadow({ blur })} />
          <RangeField
            id={side + "-shadow-opacity"}
            label="شفافیت سایه"
            value={Math.round(layer.shadow.opacity * 100)}
            min={0}
            max={100}
            suffix="٪"
            onChange={(opacity) => setShadow({ opacity: opacity / 100 })}
          />
          <ColorField id={side + "-shadow-color"} label="رنگ سایه" value={layer.shadow.color} onChange={(color) => setShadow({ color })} />
        </div>
      )}
    </div>
  );
}

function App() {
  const [project, setProject] = useState<ProjectState>(() => createDefaultProject());
  const [brand, setBrand] = useState<BrandSettings>(() => createDefaultBrand());
  const [booted, setBooted] = useState(false);
  const [projects, setProjects] = useState<ProjectState[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [notice, setNotice] = useState<Notice>(null);
  const [fontsReady, setFontsReady] = useState(false);
  const [resources, setResources] = useState<RenderResources>({ techCustom: new Map() });
  const [resourcesReady, setResourcesReady] = useState(false);
  const [activeLayer, setActiveLayer] = useState<LayerSide | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ side: LayerSide; point: { x: number; y: number } } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const showNotice = useCallback((kind: "success" | "error", text: string) => {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), 4500);
  }, []);

  const refreshProjects = useCallback(async () => {
    setProjects((await listProjects()).sort((a, b) => b.updatedAt - a.updatedAt));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const initialize = async () => {
      try {
        const [storedBrand, storedProjects, activeId] = await Promise.all([
          loadBrand(),
          listProjects(),
          loadActiveProjectId(),
        ]);
        const localProjects = storedProjects.sort((a, b) => b.updatedAt - a.updatedAt);
        const localBrand = storedBrand?.brand ?? createDefaultBrand();
        let initialProjects = localProjects.length ? localProjects : [createDefaultProject()];
        let initialBrand = localBrand;
        let activeProject = initialProjects.find((item) => item.id === activeId) ?? initialProjects[0];
        let sqlOnline = false;
        try {
          const remote = await loadSqlBootstrap();
          sqlOnline = true;
          if (remote.projects.length === 0 && !remote.brand) {
            for (const item of initialProjects) {
              await syncProjectToSql(item, initialBrand, activeProject.id);
            }
          } else {
            initialProjects = remote.projects.length ? remote.projects : [createDefaultProject()];
            initialBrand = remote.brand ?? createDefaultBrand();
            activeProject = initialProjects.find((item) => item.id === remote.activeProjectId) ?? initialProjects[0];
            await hydrateSqlAssets(initialProjects, initialBrand);
            await syncProjectToSql(activeProject, initialBrand, activeProject.id);
          }
          await Promise.all(initialProjects.map((item) => saveProject(item)));
          await saveBrand(initialBrand);
          await saveActiveProjectId(activeProject.id);
        } catch (error) {
          sqlOnline = false;
          showNotice(
            "error",
            "SQL در دسترس نیست؛ پروژه در مرورگر باز شد و برای همگام‌سازی بعدی نگه داشته می‌شود. " +
              (error instanceof Error ? error.message : "اتصال MySQL را بررسی کنید."),
          );
        }
        if (cancelled) return;
        setBrand(initialBrand);
        setProject(activeProject);
        setProjects(initialProjects);
        if (!sqlOnline) setSaveState("error");
        setBooted(true);
      } catch {
        if (cancelled) return;
        setBooted(true);
        setSaveState("error");
        showNotice("error", "ذخیره‌سازی محلی در این مرورگر در دسترس نیست.");
      }
    };
    void initialize();
    return () => {
      cancelled = true;
    };
  }, [showNotice]);

  useEffect(() => {
    let cancelled = false;
    const loadFonts = async () => {
      try {
        await Promise.all([
          document.fonts.load('600 44px "Vazirmatn"', "وبزاد فارسی نیم‌فاصله"),
          document.fonts.load("600 44px Inter", "Webzad Studio"),
          document.fonts.ready,
        ]);
      } finally {
        if (!cancelled) setFontsReady(true);
      }
    };
    void loadFonts();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!booted) return;
    setSaveState("saving");
    const timer = window.setTimeout(async () => {
      try {
        const snapshot = { ...project, updatedAt: Date.now() };
        await Promise.all([
          saveProject(snapshot),
          saveBrand(brand),
          saveActiveProjectId(project.id),
        ]);
        await syncProjectToSql(snapshot, brand, project.id);
        await collectOrphanAssets();
        await refreshProjects();
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, 650);
    return () => window.clearTimeout(timer);
  }, [booted, project, brand, refreshProjects]);

  const assetKey = [
    brand.logo?.id ?? "",
    project.front.asset?.id ?? "",
    project.back.asset?.id ?? "",
    ...project.customTech.map((item) => item.asset.id),
  ].join("|");

  useEffect(() => {
    let cancelled = false;
    const bitmaps: ImageBitmap[] = [];
    const loadResources = async () => {
      setResourcesReady(false);
      const ids = [
        brand.logo?.id,
        project.front.asset?.id,
        project.back.asset?.id,
        ...project.customTech.map((item) => item.asset.id),
      ].filter((id): id is string => Boolean(id));
      const uniqueIds = [...new Set(ids)];
      try {
        const entries = await Promise.all(
          uniqueIds.map(async (id) => {
            const record = await loadAsset(id);
            if (!record) throw new Error("فایل تصویری در ذخیره‌سازی محلی پیدا نشد.");
            const bitmap = await createImageBitmap(record.blob);
            bitmaps.push(bitmap);
            return [id, bitmap] as const;
          }),
        );
        if (cancelled) {
          bitmaps.forEach((bitmap) => bitmap.close());
          return;
        }
        const map = new Map(entries);
        const techCustom = new Map<string, CanvasImageSource>();
        for (const item of project.customTech) {
          const image = map.get(item.asset.id);
          if (image) techCustom.set(item.id, image);
        }
        setResources({
          logo: brand.logo ? map.get(brand.logo.id) : undefined,
          front: project.front.asset ? map.get(project.front.asset.id) : undefined,
          back: project.back.asset ? map.get(project.back.asset.id) : undefined,
          techCustom,
        });
        setResourcesReady(true);
      } catch (error) {
        if (!cancelled) {
          setResources({ techCustom: new Map() });
          setResourcesReady(false);
          showNotice("error", error instanceof Error ? error.message : "تصویر بارگذاری نشد.");
        }
      }
    };
    void loadResources();
    return () => {
      cancelled = true;
      bitmaps.forEach((bitmap) => bitmap.close());
    };
  }, [assetKey, brand.logo, project.customTech, project.front.asset, project.back.asset, showNotice]);

  const updateProject = useCallback((change: (current: ProjectState) => ProjectState) => {
    setProject((current) => change(current));
  }, []);

  const setLayer = useCallback((side: LayerSide, layer: ImageLayer) => {
    updateProject((current) => ({ ...current, [side]: layer }));
  }, [updateProject]);

  const saveNow = async () => {
    setSaveState("saving");
    try {
      const snapshot = { ...project, updatedAt: Date.now() };
      await Promise.all([saveProject(snapshot), saveBrand(brand), saveActiveProjectId(project.id)]);
      await syncProjectToSql(snapshot, brand, project.id);
      await collectOrphanAssets();
      await refreshProjects();
      setSaveState("saved");
      showNotice("success", "پروژه و تنظیمات برند در MySQL و حافظهٔ محلی ذخیره شد.");
    } catch {
      setSaveState("error");
      showNotice("error", "ذخیره انجام نشد؛ اتصال MySQL و فضای IndexedDB را بررسی کنید.");
    }
  };

  const uploadLayer = async (side: LayerSide, file: File) => {
    try {
      const asset = await persistImageFile(file);
      setProject((current) => ({ ...current, [side]: { ...current[side], asset } }));
      setActiveLayer(side);
      showNotice("success", "تصویر در مرورگر آماده شد.");
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "بارگذاری تصویر انجام نشد.");
    }
  };

  const uploadLogo = async (file: File) => {
    try {
      const logo = await persistImageFile(file);
      setBrand((current) => ({ ...current, logo, logoVisible: true }));
      showNotice("success", "لوگو در مرورگر ذخیره شد.");
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "بارگذاری لوگو انجام نشد.");
    }
  };

  const addCustomTech = async (file: File) => {
    if (project.customTech.length >= 8) {
      showNotice("error", "حداکثر ۸ آیکون اختصاصی می‌توان افزود.");
      return;
    }
    try {
      const asset = await persistImageFile(file);
      const id = crypto.randomUUID();
      setProject((current) => ({
        ...current,
        customTech: [...current.customTech, { id, label: file.name.replace(/\.[^.]+$/u, ""), asset }],
      }));
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "بارگذاری آیکون انجام نشد.");
    }
  };

  const removeAssetFromCurrent = async (asset: AssetMeta | null) => {
    if (!asset) return;
    await collectOrphanAssets();
  };

  const createProject = async () => {
    const next = createDefaultProject("پروژهٔ جدید");
    setProject(next);
    setActiveLayer(null);
    await saveActiveProjectId(next.id);
    try {
      await setSqlActiveProject(next.id);
      showNotice("success", "پروژهٔ تازه ساخته شد؛ تنظیمات برند حفظ شده است.");
    } catch (error) {
      setSaveState("error");
      showNotice("error", error instanceof Error ? error.message : "پروژه در SQL فعال نشد.");
    }
  };

  const loadNamedProject = async (id: string) => {
    const next = await loadProject(id);
    if (!next) {
      showNotice("error", "پروژهٔ انتخاب‌شده پیدا نشد.");
      return;
    }
    setProject(next);
    setActiveLayer(null);
    await saveActiveProjectId(next.id);
    try {
      await setSqlActiveProject(next.id);
    } catch (error) {
      setSaveState("error");
      showNotice("error", error instanceof Error ? error.message : "پروژه در SQL فعال نشد.");
    }
  };

  const deleteCurrentProject = async () => {
    if (!window.confirm("پروژهٔ «" + project.name + "» حذف شود؟ این کار قابل بازگشت نیست.")) return;
    try {
      await deleteSqlProject(project.id);
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "حذف پروژه از SQL انجام نشد.");
      return;
    }
    await removeProject(project.id);
    const remaining = (await listProjects()).sort((a, b) => b.updatedAt - a.updatedAt);
    const next = remaining[0] ?? createDefaultProject();
    setProjects(remaining);
    setProject(next);
    await saveActiveProjectId(next.id);
    try {
      await setSqlActiveProject(next.id);
    } catch (error) {
      setSaveState("error");
      showNotice("error", error instanceof Error ? error.message : "پروژهٔ فعال در SQL به‌روزرسانی نشد.");
    }
    await collectOrphanAssets();
  };

  const resetEverything = () => {
    if (!window.confirm("همهٔ اطلاعات و چیدمان پروژه به مقدارهای اولیه برگردد؟")) return;
    setProject(createDefaultProject());
    setBrand(createDefaultBrand());
    setActiveLayer(null);
    showNotice("success", "چیدمان و تنظیمات برند بازنشانی شد.");
  };

  const resetProjectFields = () => {
    setProject((current) => {
      const defaults = createDefaultProject(current.name);
      return {
        ...current,
        siteName: defaults.siteName,
        siteNameUppercase: defaults.siteNameUppercase,
        templateType: defaults.templateType,
        implementation: defaults.implementation,
        text: defaults.text,
      };
    });
  };

  const resetBrand = () => setBrand(createDefaultBrand());

  const swapLayers = () => {
    setProject((current) => ({ ...current, front: current.back, back: current.front }));
    setActiveLayer((current) => (current === "front" ? "back" : current === "back" ? "front" : null));
  };

  const toggleTechnology = (id: string) => {
    setProject((current) => ({
      ...current,
      selectedTech: current.selectedTech.includes(id)
        ? current.selectedTech.filter((item) => item !== id)
        : [...current.selectedTech, id],
    }));
  };

  const reorderCustomTech = (index: number, delta: -1 | 1) => {
    setProject((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.customTech.length) return current;
      const customTech = [...current.customTech];
      [customTech[index], customTech[target]] = [customTech[target], customTech[index]];
      return { ...current, customTech };
    });
  };

  const reorderSelectedTech = (index: number, delta: -1 | 1) => {
    setProject((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.selectedTech.length) return current;
      const selectedTech = [...current.selectedTech];
      [selectedTech[index], selectedTech[target]] = [selectedTech[target], selectedTech[index]];
      return { ...current, selectedTech };
    });
  };

  const updateText = (key: keyof ProjectState["text"], change: Partial<ProjectState["text"]["siteName"]>) => {
    setProject((current) => ({ ...current, text: { ...current.text, [key]: { ...current.text[key], ...change } } }));
  };

  const warnings = useMemo(() => {
    if (!booted) return [];
    return layoutWarnings(project, brand);
  }, [booted, project, brand]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !booted) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(CANVAS_WIDTH * ratio);
    canvas.height = Math.round(CANVAS_HEIGHT * ratio);
    try {
      renderCover(canvas, project, brand, resources, ratio);
    } catch {
      return;
    }
  }, [booted, project, brand, resources, fontsReady]);

  const downloadImage = async () => {
    if (!fontsReady || !resourcesReady || isExporting) return;
    setIsExporting(true);
    try {
      await document.fonts.ready;
      const canvas = document.createElement("canvas");
      const scale = project.output.scale;
      canvas.width = CANVAS_WIDTH * scale;
      canvas.height = CANVAS_HEIGHT * scale;
      renderCover(canvas, project, brand, resources, scale);
      const mime = project.output.format === "png" ? "image/png" : "image/webp";
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((value) => (value ? resolve(value) : reject(new Error("ساخت تصویر خروجی ناموفق بود."))), mime, project.output.quality);
      });
      if (blob.type !== mime) throw new Error("مرورگر از خروجی " + project.output.format.toUpperCase() + " پشتیبانی نمی‌کند.");
      const safeName =
        project.siteName
          .trim()
          .replace(/[^\p{L}\p{N}-]+/gu, "-")
          .replace(/^-+|-+$/gu, "")
          .slice(0, 80) || "webzad-cover";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = safeName + "-" + scale + "x." + project.output.format;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      showNotice("success", "تصویر " + CANVAS_WIDTH * scale + " × " + CANVAS_HEIGHT * scale + " پیکسل دانلود شد.");
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "خروجی تصویر آماده نشد.");
    } finally {
      setIsExporting(false);
    }
  };

  const exportProject = async () => {
    try {
      const blob = await buildProjectArchive(project, brand);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = (project.name.replace(/[^\p{L}\p{N}-]+/gu, "-").slice(0, 80) || "webzad-project") + ".zip";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      showNotice("success", "فایل پشتیبان ZIP ساخته شد.");
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "ساخت پشتیبان انجام نشد.");
    }
  };

  const importProject = async (file: File) => {
    setIsImporting(true);
    try {
      const imported = await importProjectArchive(file);
      setProject(imported.project);
      const importedBrand = imported.brand;
      setBrand(importedBrand);
      await saveProject(imported.project);
      await saveBrand(importedBrand);
      await saveActiveProjectId(imported.project.id);
      await syncProjectToSql(imported.project, importedBrand, imported.project.id);
      await refreshProjects();
      showNotice("success", "پروژه و فایل‌های آن بازیابی شدند.");
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "بازیابی پشتیبان انجام نشد.");
    } finally {
      setIsImporting(false);
    }
  };

  const onCanvasPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const point = safeCanvasPoint(event.clientX, event.clientY, canvas.getBoundingClientRect());
    const hits = (["front", "back"] as const).filter((side) => {
      const layer = project[side];
      return layer.asset && layer.visible && point.x >= layer.x && point.x <= layer.x + layer.width && point.y >= layer.y;
    });
    const side = hits.includes("front") ? "front" : hits[0];
    if (!side) return;
    setActiveLayer(side);
    dragRef.current = { side, point };
    canvas.setPointerCapture(event.pointerId);
  };

  const onCanvasPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    const canvas = event.currentTarget;
    const point = safeCanvasPoint(event.clientX, event.clientY, canvas.getBoundingClientRect());
    const { side, point: previous } = dragRef.current;
    const layer = project[side];
    setLayer(side, { ...layer, x: clamp(layer.x + point.x - previous.x, -1080, 2160), y: clamp(layer.y + point.y - previous.y, -848, 1696) });
    dragRef.current = { side, point };
  };

  const layerOutline = (side: LayerSide) => {
    const layer = project[side];
    if (!activeLayer || activeLayer !== side || !layer.asset || !layer.visible) return null;
    const natural = naturalImageRect(layer, layer.asset);
    const height = Math.max(1, Math.min(CANVAS_HEIGHT - layer.y, natural.y + natural.height - layer.y));
    return (
      <div
        className="drag-outline"
        aria-hidden="true"
        style={{
          left: (layer.x / CANVAS_WIDTH) * 100 + "%",
          top: (layer.y / CANVAS_HEIGHT) * 100 + "%",
          width: (layer.width / CANVAS_WIDTH) * 100 + "%",
          height: (height / CANVAS_HEIGHT) * 100 + "%",
        }}
      >
        {side === "front" ? "تصویر جلو" : "تصویر عقب"}
      </div>
    );
  };

  const downloadReady = fontsReady && resourcesReady && !isExporting;

  return (
    <div className="app-shell min-h-screen" dir="rtl">
      <header className="topbar">
        <div className="brand-heading">
          <span className="brand-mark" aria-hidden="true"><Layers size={20} /></span>
          <div>
            <p className="eyebrow">WEBZAD STUDIO</p>
            <h1>سازندهٔ کاور نمونه‌کار</h1>
          </div>
        </div>
        <div className="topbar-actions">
          <div className={"save-indicator " + saveState} title={saveState === "saved" ? "پروژه در MySQL محلی و IndexedDB ذخیره شده است." : undefined}>
            {saveState === "saving" || saveState === "loading" ? <LoaderCircle size={15} className="spin" /> : saveState === "saved" ? <Check size={15} /> : <AlertTriangle size={15} />}
            <span>{saveState === "saving" ? "در حال ذخیره" : saveState === "loading" ? "آماده‌سازی" : saveState === "saved" ? "ذخیره شد" : "ذخیره ناموفق"}</span>
          </div>
          <button className="button button-secondary" type="button" onClick={() => void createProject()}>
            <Plus size={16} aria-hidden="true" /> پروژهٔ تازه
          </button>
          <button className="button button-primary" type="button" onClick={() => void saveNow()}>
            <Save size={16} aria-hidden="true" /> ذخیره
          </button>
        </div>
      </header>

      <main className="workspace">
        <aside className="editor-panel" aria-label="تنظیمات کاور">
          <div className="project-picker">
            <label htmlFor="project-picker">پروژهٔ فعال</label>
            <select id="project-picker" value={project.id} onChange={(event) => void loadNamedProject(event.currentTarget.value)}>
              {projects.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
              {!projects.some((item) => item.id === project.id) && <option value={project.id}>{project.name}</option>}
            </select>
            <button className="icon-button danger" type="button" aria-label="حذف پروژهٔ فعلی" onClick={() => void deleteCurrentProject()}>
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="field project-name-field">
            <label htmlFor="project-name">نام پروژه برای فهرست ذخیره‌ها</label>
            <input id="project-name" value={project.name} maxLength={80} onChange={(event) => { const name = event.currentTarget.value; setProject((current) => ({ ...current, name })); }} />
          </div>

          <SectionPanel title="اطلاعات پروژه" icon={<Type size={17} />} initialOpen onReset={resetProjectFields} resetLabel="بازنشانی اطلاعات پروژه">
            <div className="field">
              <label htmlFor="site-name">نام سایت</label>
              <input id="site-name" value={project.siteName} maxLength={160} onChange={(event) => { const siteName = event.currentTarget.value; setProject((current) => ({ ...current, siteName })); }} />
            </div>
            <CheckField id="site-uppercase" label="نمایش انگلیسی با حروف بزرگ" checked={project.siteNameUppercase} onChange={(siteNameUppercase) => setProject((current) => ({ ...current, siteNameUppercase }))} />
            <div className="field">
              <label htmlFor="template-type">نوع قالب</label>
              <input id="template-type" list="template-suggestions" value={project.templateType} onChange={(event) => { const templateType = event.currentTarget.value; setProject((current) => ({ ...current, templateType })); }} />
              <datalist id="template-suggestions">{TEMPLATE_SUGGESTIONS.map((value) => <option key={value} value={value} />)}</datalist>
            </div>
            <div className="field">
              <label htmlFor="implementation">نوع پیاده‌سازی یا کدنویسی</label>
              <input id="implementation" list="implementation-suggestions" value={project.implementation} onChange={(event) => { const implementation = event.currentTarget.value; setProject((current) => ({ ...current, implementation })); }} />
              <datalist id="implementation-suggestions">{IMPLEMENTATION_SUGGESTIONS.map((value) => <option key={value} value={value} />)}</datalist>
            </div>
          </SectionPanel>

          <SectionPanel title="تصاویر سایت" icon={<ImagePlus size={17} />} initialOpen onReset={() => {
            setProject((current) => ({ ...current, front: { ...createDefaultLayer("front"), asset: current.front.asset }, back: { ...createDefaultLayer("back"), asset: current.back.asset } }));
          }} resetLabel="بازنشانی جایگاه دو تصویر">
            <div className="swap-row">
              <span>دو تصویر با هم‌پوشانی نمایش داده می‌شوند</span>
              <button className="button button-quiet" type="button" onClick={swapLayers}><ArrowLeftRight size={15} aria-hidden="true" /> جابه‌جایی جلو و عقب</button>
            </div>
            <LayerControls
              side="front"
              layer={project.front}
              selected={activeLayer === "front"}
              onSelect={() => setActiveLayer("front")}
              onChange={(layer) => setLayer("front", layer)}
              onUpload={(file) => void uploadLayer("front", file)}
              onRemove={() => {
                const old = project.front.asset;
                setLayer("front", { ...project.front, asset: null });
                void removeAssetFromCurrent(old);
              }}
              onReset={() => setLayer("front", { ...createDefaultLayer("front"), asset: project.front.asset, visible: project.front.visible })}
            />
            <LayerControls
              side="back"
              layer={project.back}
              selected={activeLayer === "back"}
              onSelect={() => setActiveLayer("back")}
              onChange={(layer) => setLayer("back", layer)}
              onUpload={(file) => void uploadLayer("back", file)}
              onRemove={() => {
                const old = project.back.asset;
                setLayer("back", { ...project.back, asset: null });
                void removeAssetFromCurrent(old);
              }}
              onReset={() => setLayer("back", { ...createDefaultLayer("back"), asset: project.back.asset, visible: project.back.visible })}
            />
          </SectionPanel>

          <SectionPanel title="لوگوی برند" icon={<Palette size={17} />} onReset={resetBrand} resetLabel="بازنشانی تنظیمات برند">
            <p className="field-hint">لوگوی اصلی را بارگذاری کنید؛ تا پیش از آن در کاور فقط نشانهٔ راهنمای پنل دیده می‌شود.</p>
            <div className="layer-file-row">
              <UploadButton id="upload-logo" label={brand.logo ? "جایگزینی لوگو" : "بارگذاری لوگو"} onFile={(file) => void uploadLogo(file)} />
              {brand.logo && <button className="icon-button danger" type="button" aria-label="حذف لوگو" onClick={() => setBrand((current) => ({ ...current, logo: null }))}><Trash2 size={16} /></button>}
              <CheckField id="logo-visible" label="نمایش" checked={brand.logoVisible} onChange={(logoVisible) => setBrand((current) => ({ ...current, logoVisible }))} />
            </div>
            {brand.logo && <div className="asset-meta"><span className="asset-name">{brand.logo.name}</span><span>{formatDimensions(brand.logo.width, brand.logo.height)}</span><span>{formatBytes(brand.logo.size)}</span></div>}
            <div className="field-grid two">
              <NumberField id="logo-x" label="جایگاه X" value={brand.logoBox.x} min={-1080} max={2160} onChange={(x) => setBrand((current) => ({ ...current, logoBox: { ...current.logoBox, x } }))} />
              <NumberField id="logo-y" label="جایگاه Y" value={brand.logoBox.y} min={-848} max={1696} onChange={(y) => setBrand((current) => ({ ...current, logoBox: { ...current.logoBox, y } }))} />
              <NumberField id="logo-width" label="عرض محدوده" value={brand.logoBox.width} min={1} max={2160} onChange={(width) => setBrand((current) => ({ ...current, logoBox: { ...current.logoBox, width } }))} />
              <NumberField id="logo-height" label="ارتفاع محدوده" value={brand.logoBox.height} min={1} max={1696} onChange={(height) => setBrand((current) => ({ ...current, logoBox: { ...current.logoBox, height } }))} />
            </div>
            <RangeField id="logo-opacity" label="شفافیت لوگو" value={Math.round(brand.logoOpacity * 100)} min={0} max={100} suffix="٪" onChange={(logoOpacity) => setBrand((current) => ({ ...current, logoOpacity: logoOpacity / 100 }))} />
            <div className="subsection-label">امضای پایین کاور</div>
            <div className="field">
              <label htmlFor="signature">متن امضا</label>
              <input id="signature" value={brand.signature.text} maxLength={80} onChange={(event) => { const text = event.currentTarget.value; setBrand((current) => ({ ...current, signature: { ...current.signature, text } })); }} />
            </div>
            <div className="field-grid two">
              <NumberField id="signature-x" label="جایگاه X" value={brand.signature.x} min={-1080} max={2160} onChange={(x) => setBrand((current) => ({ ...current, signature: { ...current.signature, x } }))} />
              <NumberField id="signature-y" label="جایگاه Y" value={brand.signature.y} min={-848} max={1696} onChange={(y) => setBrand((current) => ({ ...current, signature: { ...current.signature, y } }))} />
              <NumberField id="signature-size" label="اندازهٔ قلم" value={brand.signature.fontSize} min={12} max={80} onChange={(fontSize) => setBrand((current) => ({ ...current, signature: { ...current.signature, fontSize } }))} />
              <ColorField id="signature-color" label="رنگ امضا" value={brand.signature.color} onChange={(color) => setBrand((current) => ({ ...current, signature: { ...current.signature, color } }))} />
            </div>
          </SectionPanel>

          <SectionPanel title="تکنولوژی‌ها" icon={<Layers size={17} />} onReset={() => setProject((current) => ({ ...current, selectedTech: [], customTech: [] }))} resetLabel="پاک‌کردن فهرست تکنولوژی‌ها">
            <p className="field-hint">نشان‌های رسمی محلی و بدون متن روی کاور رسم می‌شوند.</p>
            <div className="technology-grid">
              {technologyCatalog.map((technology) => (
                <label className={"technology-option" + (project.selectedTech.includes(technology.id) ? " checked" : "")} key={technology.id} htmlFor={"tech-" + technology.id}>
                  <input id={"tech-" + technology.id} type="checkbox" checked={project.selectedTech.includes(technology.id)} onChange={() => toggleTechnology(technology.id)} />
                  <span className="technology-swatch" style={{ color: "#" + technology.iconData.hex }} aria-hidden="true">●</span>
                  <span>{technology.label}</span>
                </label>
              ))}
            </div>
            {project.selectedTech.length > 0 && (
              <div className="custom-tech-list" aria-label="ترتیب فناوری‌های انتخاب‌شده">
                {project.selectedTech.map((id, index) => (
                  <div className="custom-tech-row" key={id}>
                    <span>{technologyCatalog.find((item) => item.id === id)?.label ?? id}</span>
                    <div>
                      <button className="icon-button subtle" type="button" aria-label="جابجایی فناوری به بالا" onClick={() => reorderSelectedTech(index, -1)} disabled={index === 0}><ArrowUp size={15} /></button>
                      <button className="icon-button subtle" type="button" aria-label="جابجایی فناوری به پایین" onClick={() => reorderSelectedTech(index, 1)} disabled={index === project.selectedTech.length - 1}><ArrowDown size={15} /></button>
                      <button className="icon-button danger" type="button" aria-label="حذف فناوری" onClick={() => toggleTechnology(id)}><X size={15} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="subsection-label">آیکون اختصاصی</div>
            <UploadButton id="upload-custom-tech" label="افزودن تصویر آیکون" onFile={(file) => void addCustomTech(file)} />
            {project.customTech.length > 0 && (
              <div className="custom-tech-list">
                {project.customTech.map((item, index) => (
                  <div className="custom-tech-row" key={item.id}>
                    <span>{item.label}</span>
                    <div>
                      <button className="icon-button subtle" type="button" aria-label="جابجایی به بالا" onClick={() => reorderCustomTech(index, -1)} disabled={index === 0}><ArrowUp size={15} /></button>
                      <button className="icon-button subtle" type="button" aria-label="جابجایی به پایین" onClick={() => reorderCustomTech(index, 1)} disabled={index === project.customTech.length - 1}><ArrowDown size={15} /></button>
                      <button className="icon-button danger" type="button" aria-label="حذف آیکون اختصاصی" onClick={() => setProject((current) => ({ ...current, customTech: current.customTech.filter((tech) => tech.id !== item.id) }))}><X size={15} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="field-grid two">
              <NumberField id="tech-size" label="اندازهٔ آیکون" value={brand.iconSize} min={18} max={120} onChange={(iconSize) => setBrand((current) => ({ ...current, iconSize }))} />
              <NumberField id="tech-gap" label="فاصله" value={brand.iconGap} min={0} max={80} onChange={(iconGap) => setBrand((current) => ({ ...current, iconGap }))} />
            </div>
          </SectionPanel>

          <SectionPanel title="ظاهر و چیدمان پیشرفته" icon={<Settings2 size={17} />}>
            <ColorField id="background" label="رنگ پس‌زمینه" value={brand.background} onChange={(background) => setBrand((current) => ({ ...current, background }))} />
            <div className="field">
              <label htmlFor="font-family">فونت محلی کاور</label>
              <select id="font-family" value={brand.fontFamily} onChange={(event) => { const fontFamily = event.currentTarget.value === "Inter" ? "Inter" : "Vazirmatn"; setBrand((current) => ({ ...current, fontFamily })); }}>
                <option value="Vazirmatn">Vazirmatn · مناسب فارسی</option>
                <option value="Inter">Inter · مناسب لاتین</option>
              </select>
            </div>
            <div className="subsection-label">نام سایت</div>
            <TextFields item={project.text.siteName} id="site" onChange={(change) => updateText("siteName", change)} />
            <div className="subsection-label">نوع قالب</div>
            <TextFields item={project.text.template} id="template" onChange={(change) => updateText("template", change)} />
            <div className="subsection-label">پیاده‌سازی</div>
            <TextFields item={project.text.implementation} id="implementation-text" onChange={(change) => updateText("implementation", change)} />
            <div className="subsection-label">موقعیت ردیف تکنولوژی‌ها</div>
            <div className="field-grid three">
              <NumberField id="tech-x" label="جایگاه X" value={project.technologies.x} min={-1080} max={2160} onChange={(x) => setProject((current) => ({ ...current, technologies: { ...current.technologies, x } }))} />
              <NumberField id="tech-y" label="جایگاه Y" value={project.technologies.y} min={-848} max={1696} onChange={(y) => setProject((current) => ({ ...current, technologies: { ...current.technologies, y } }))} />
              <NumberField id="tech-width" label="عرض ردیف" value={project.technologies.width} min={1} max={1080} onChange={(width) => setProject((current) => ({ ...current, technologies: { ...current.technologies, width } }))} />
            </div>
            <p className="field-hint">تنظیمات متن ابتدا اندازه را کوچک می‌کنند، سپس تا دو خط می‌شکنند؛ متن بلند حذف نمی‌شود.</p>
          </SectionPanel>

          <SectionPanel title="ذخیره و بازیابی" icon={<FolderOpen size={17} />}>
            <div className="storage-actions">
              <button className="button button-secondary full" type="button" onClick={() => void saveNow()}><Save size={16} /> ذخیرهٔ همین پروژه</button>
              <button className="button button-secondary full" type="button" onClick={() => void exportProject()}><FileArchive size={16} /> دریافت پشتیبان ZIP</button>
              <button className="button button-secondary full" type="button" onClick={() => importRef.current?.click()} disabled={isImporting}>
                {isImporting ? <LoaderCircle size={16} className="spin" /> : <FolderOpen size={16} />} بازیابی از ZIP
              </button>
              <input ref={importRef} className="visually-hidden" type="file" accept=".zip,application/zip" aria-label="انتخاب فایل پشتیبان ZIP" onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) void importProject(file);
                event.currentTarget.value = "";
              }} />
              <button className="button button-danger full" type="button" onClick={resetEverything}><RotateCcw size={16} /> بازنشانی همهٔ تنظیمات</button>
            </div>
            <p className="field-hint">ذخیرهٔ خودکار محلی با مکث کوتاه انجام می‌شود. تصاویر به سرور ارسال نمی‌شوند.</p>
          </SectionPanel>

          <SectionPanel title="خروجی تصویر" icon={<Download size={17} />} initialOpen>
            <div className="field">
              <label htmlFor="export-format">قالب فایل</label>
              <select id="export-format" value={project.output.format} onChange={(event) => { const format = event.currentTarget.value as ExportFormat; setProject((current) => ({ ...current, output: { ...current.output, format } })); }}>
                <option value="png">PNG · بدون افت کیفیت</option>
                <option value="webp">WebP · حجم کمتر</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="export-scale">اندازهٔ خروجی</label>
              <select id="export-scale" value={project.output.scale} onChange={(event) => { const scale = Number(event.currentTarget.value) as ExportScale; setProject((current) => ({ ...current, output: { ...current.output, scale } })); }}>
                <option value={1}>1× · 1080 × 848</option>
                <option value={2}>2× · 2160 × 1696</option>
                <option value={3}>3× · 3240 × 2544</option>
              </select>
            </div>
            {project.output.format === "webp" && <RangeField id="export-quality" label="کیفیت WebP" value={Math.round(project.output.quality * 100)} min={50} max={100} suffix="٪" onChange={(quality) => setProject((current) => ({ ...current, output: { ...current.output, quality: quality / 100 } }))} />}
            <button className="button button-primary full download-button" type="button" disabled={!downloadReady} onClick={() => void downloadImage()}>
              {isExporting ? <LoaderCircle size={18} className="spin" /> : <Download size={18} />}
              {isExporting ? "در حال ساخت تصویر…" : "دانلود کاور"}
            </button>
            {!downloadReady && <p className="field-hint">پس از آماده‌شدن قلم‌ها و تصاویر، دانلود فعال می‌شود.</p>}
          </SectionPanel>
        </aside>

        <section className="preview-panel" aria-label="پیش‌نمایش کاور">
          <div className="preview-toolbar">
            <div>
              <div className="preview-title">پیش‌نمایش زنده</div>
              <div className="preview-subtitle">بوم اصلی · 1080 × 848 پیکسل</div>
            </div>
            <div className="preview-toolbar-actions">
              <span className="drag-hint"><Move size={14} aria-hidden="true" /> برای جابجایی روی تصویر بکشید</span>
              <button className="icon-button subtle" type="button" aria-label="پاک‌کردن انتخاب لایه" onClick={() => setActiveLayer(null)}><EyeOff size={16} /></button>
            </div>
          </div>
          <div className="preview-stage-wrap">
            <div className="cover-stage">
              <canvas
                ref={canvasRef}
                aria-label="پیش‌نمایش تصویر کاور نهایی"
                onPointerDown={onCanvasPointerDown}
                onPointerMove={onCanvasPointerMove}
                onPointerUp={() => { dragRef.current = null; }}
                onPointerCancel={() => { dragRef.current = null; }}
              />
              {layerOutline("back")}
              {layerOutline("front")}
              {!brand.logo && <div className="logo-placeholder">لوگو پس از بارگذاری در این بخش نمایش داده می‌شود</div>}
              {!project.front.asset && !project.back.asset && (
                <div className="preview-placeholder">
                  <ImagePlus size={22} aria-hidden="true" />
                  <span>برای تکمیل کاور، دو اسکرین‌شات بلند را بارگذاری کنید</span>
                  <small>پیش‌نمایش راهنما در خروجی نهایی وجود ندارد</small>
                </div>
              )}
            </div>
          </div>
          <div className="preview-footer">
            <span><Eye size={14} aria-hidden="true" /> پیش‌نمایش و دانلود از موتور رسم مشترک استفاده می‌کنند.</span>
            <span>فایل‌ها در همین مرورگر نگهداری می‌شوند.</span>
          </div>
          {warnings.length > 0 && (
            <div className="warning-list" role="status">
              {warnings.map((warning) => <div className="warning-item" key={warning.id}><AlertTriangle size={15} aria-hidden="true" /><span>{warning.message}</span></div>)}
            </div>
          )}
        </section>
      </main>
      <footer className="app-footer">
        <span>Webzad Cover Studio</span>
        <span>پردازش تصویر و ذخیره‌سازی محلی در مرورگر</span>
      </footer>
      {notice && <div className={"toast " + notice.kind} role={notice.kind === "error" ? "alert" : "status"}>{notice.kind === "success" ? <Check size={17} /> : <AlertTriangle size={17} />}<span>{notice.text}</span><button type="button" aria-label="بستن پیام" onClick={() => setNotice(null)}><X size={15} /></button></div>}
    </div>
  );
}

function TextFields({
  item,
  id,
  onChange,
}: {
  item: ProjectState["text"]["siteName"];
  id: string;
  onChange: (change: Partial<ProjectState["text"]["siteName"]>) => void;
}) {
  return (
    <>
      <div className="field-grid three">
        <NumberField id={id + "-x"} label="جایگاه X" value={item.x} min={-1080} max={2160} onChange={(x) => onChange({ x })} />
        <NumberField id={id + "-y"} label="جایگاه Y" value={item.y} min={-848} max={1696} onChange={(y) => onChange({ y })} />
        <NumberField id={id + "-width"} label="عرض متن" value={item.width} min={1} max={1080} onChange={(width) => onChange({ width })} />
        <NumberField id={id + "-size"} label="اندازهٔ قلم" value={item.fontSize} min={8} max={120} onChange={(fontSize) => onChange({ fontSize })} />
        <NumberField id={id + "-min-size"} label="کمترین اندازه" value={item.minFontSize} min={8} max={100} onChange={(minFontSize) => onChange({ minFontSize })} />
        <ColorField id={id + "-color"} label="رنگ متن" value={item.color} onChange={(color) => onChange({ color })} />
      </div>
      <div className="field">
        <label htmlFor={id + "-direction"}>جهت متن</label>
        <select id={id + "-direction"} value={item.direction} onChange={(event) => onChange({ direction: event.currentTarget.value as ProjectState["text"]["siteName"]["direction"] })}>
          <option value="auto">تشخیص خودکار</option>
          <option value="rtl">راست‌به‌چپ</option>
          <option value="ltr">چپ‌به‌راست</option>
        </select>
      </div>
    </>
  );
}

export default App;
