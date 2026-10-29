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
  DEFAULT_WEBZAD_LOGO,
  migrateBrandSettings,
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
  saveAsset,
  saveActiveProjectId,
  saveBrand,
  saveProject,
} from "./database";
import { ensureDefaultWebzadLogo, inspectImageBlob, persistImageFile } from "./file-assets";
import {
  deleteSqlProject,
  hydrateSqlAssets,
  loadSqlBootstrap,
  setSqlActiveProject,
  syncProjectToSql,
} from "./sql-api";
import { clamp, naturalImageRect, outputDimensions, safeCanvasPoint } from "./geometry";
import {
  type AssetMeta,
  type BrandSettings,
  type CoverTemplateId,
  type ExportFormat,
  type ExportScale,
  type ImageLayer,
  type ProjectState,
  type RenderResources,
} from "./model";
import { layoutWarnings, renderCover } from "./renderer";
import { technologyCatalog } from "./technology-icons";
import { getLogoBox, getSignaturePosition, getTechnologyStyle, getTemplateDefinition } from "./templates";

type LayerSide = "front" | "back";
type Notice = { kind: "success" | "error"; text: string } | null;
type SaveState = "loading" | "saving" | "saved" | "error";
type ConfirmationDialog = {
  mode: "confirm" | "notice";
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm?: () => void | boolean | Promise<void | boolean>;
};

const migrateBrandLogo = (brand: BrandSettings | null | undefined): BrandSettings => {
  const migrated = migrateBrandSettings(brand);
  return migrated.logoDefaultApplied
    ? migrated
    : { ...migrated, logo: migrated.logo ?? { ...DEFAULT_WEBZAD_LOGO }, logoDefaultApplied: true };
};

function LayerControls({
  side,
  layer,
  canvasHeight,
  selected,
  onSelect,
  onChange,
  onUpload,
  onRemove,
  onReset,
}: {
  side: LayerSide;
  layer: ImageLayer;
  canvasHeight: number;
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
        <NumberField id={side + "-y"} label="جایگاه Y" value={layer.y} min={-canvasHeight} max={canvasHeight * 2} onChange={(y) => set({ y })} />
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

function ProjectCoverThumb({ project, background }: { project: ProjectState; background: string }) {
  const template = getTemplateDefinition(project.templateId);
  const [images, setImages] = useState<{ front?: string; back?: string; exported?: string }>({});
  const frontId = project.front.visible ? project.front.asset?.id : undefined;
  const backId = project.back.visible ? project.back.asset?.id : undefined;
  const exportedId = project.coverPreview?.id;

  useEffect(() => {
    let cancelled = false;
    const objectUrls: string[] = [];

    const load = async () => {
      const entries = await Promise.all(
        [frontId, backId, exportedId].map(async (id) => {
          if (!id) return undefined;
          const record = await loadAsset(id);
          if (!record) return undefined;
          const url = URL.createObjectURL(record.blob);
          objectUrls.push(url);
          return [id, url] as const;
        }),
      );
      if (cancelled) {
        objectUrls.forEach((url) => URL.revokeObjectURL(url));
        return;
      }
      const urls = new Map(entries.filter((entry): entry is readonly [string, string] => Boolean(entry)));
      setImages({
        front: frontId ? urls.get(frontId) : undefined,
        back: backId ? urls.get(backId) : undefined,
        exported: exportedId ? urls.get(exportedId) : undefined,
      });
    };

    void load().catch(() => {
      if (!cancelled) setImages({});
    });
    return () => {
      cancelled = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [frontId, backId, exportedId]);

  return (
    <div className="project-art" style={{ backgroundColor: background, aspectRatio: template.width + " / " + template.height }} aria-hidden="true">
      {images.exported ? <img className="project-art-exported" src={images.exported} alt="" loading="lazy" /> : <>
      {images.back && <img className="project-art-shot project-art-back" style={{ left: (project.back.x / template.width) * 100 + "%", top: (project.back.y / template.height) * 100 + "%", width: (project.back.width / template.width) * 100 + "%" }} src={images.back} alt="" loading="lazy" />}
      {images.front && <img className="project-art-shot project-art-front" style={{ left: (project.front.x / template.width) * 100 + "%", top: (project.front.y / template.height) * 100 + "%", width: (project.front.width / template.width) * 100 + "%" }} src={images.front} alt="" loading="lazy" />}
      {images.front || images.back ? (
        <div className="project-art-copy" style={{ top: (project.text.siteName.y / template.height) * 100 + "%", width: (project.text.siteName.width / template.width) * 100 + "%" }}>
          <span>{project.templateType || "کاور نمونه‌کار"}</span>
          <strong dir="auto">{project.siteName || "نام سایت"}</strong>
          <small dir="auto">{project.implementation}</small>
        </div>
      ) : (
        <div className="project-art-empty">
          <ImagePlus size={24} aria-hidden="true" />
          <span>هنوز تصویری ندارد</span>
        </div>
      )}
      <span className="project-art-signature" style={{ bottom: (template.signature.bottom / template.height) * 100 + "%" }}>Designed by Webzad</span>
      </>}
    </div>
  );
}

function LauncherHome({
  projects,
  activeProjectId,
  background,
  onOpen,
  onCreate,
  onDelete,
}: {
  projects: ProjectState[];
  activeProjectId: string;
  background: string;
  onOpen: (id: string) => void;
  onCreate: (templateId?: CoverTemplateId) => void;
  onDelete: (project: ProjectState) => void;
}) {
  return (
    <div className="launcher-shell min-h-screen" dir="rtl">
      <header className="launcher-header">
        <div className="launcher-brand" aria-label="وبزاد استودیو">
          <img src="/favicon-webzad.png" alt="" />
          <span><b>WEBZAD STUDIO</b><small>فضای کار طراحی</small></span>
        </div>
        <button className="button button-primary" type="button" onClick={() => onCreate()}>
          <Plus size={17} aria-hidden="true" /> پروژهٔ تازه
        </button>
      </header>

      <main className="launcher-main">
        <section className="launcher-welcome" aria-labelledby="launcher-title">
          <div className="launcher-welcome-copy">
            <span className="launcher-kicker"><Layers size={15} aria-hidden="true" /> WEBZAD COVER STUDIO</span>
            <h1 id="launcher-title">از آخرین کار ادامه بده،<br />یا از نو شروع کن.</h1>
            <p>پروژه‌های ذخیره‌شده را باز کن یا برای یک کاور تازه از تمپلیت آماده شروع کن.</p>
            <button className="button button-light" type="button" onClick={() => onCreate()}>
              ساخت پروژهٔ جدید <Plus size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="launcher-welcome-art" aria-hidden="true">
            <div className="welcome-sheet welcome-sheet-back" />
            <div className="welcome-sheet welcome-sheet-front"><span>WZ</span><i /><i /><i /></div>
            <span className="welcome-glow" />
          </div>
        </section>

        <section className="launcher-section" aria-labelledby="projects-heading">
          <div className="launcher-section-head">
            <div>
              <p className="launcher-kicker">ادامهٔ کار</p>
              <h2 id="projects-heading">پروژه‌های شما</h2>
            </div>
            <span className="project-count">{projects.length.toLocaleString("fa-IR")} پروژه</span>
          </div>
          {projects.length ? (
            <div className="saved-project-grid">
              {projects.map((item) => (
                <article className="saved-project-card" key={item.id}>
                  <button className="project-card-open" type="button" onClick={() => onOpen(item.id)} aria-label={`باز کردن پروژهٔ ${item.name || "بدون نام"}`}>
                    <ProjectCoverThumb key={`${item.id}-${item.front.asset?.id ?? ""}-${item.back.asset?.id ?? ""}`} project={item} background={background} />
                    <span className="project-card-details">
                      <span className="project-card-title-row">
                        <strong>{item.name || "پروژهٔ بدون نام"}</strong>
                        {item.id === activeProjectId && <span className="project-active-badge">فعال</span>}
                      </span>
                      <span className="project-card-site" dir="auto">{item.siteName || "نام سایت وارد نشده"}</span>
                      <span className="project-card-updated">
                        {Number.isFinite(item.updatedAt) ? new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(item.updatedAt) : "پروژهٔ ذخیره‌شده"}
                      </span>
                    </span>
                  </button>
                  <button className="project-card-delete" type="button" aria-label={`حذف پروژهٔ ${item.name || "بدون نام"}`} onClick={() => onDelete(item)}>
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="launcher-empty">
              <FolderOpen size={26} aria-hidden="true" />
              <strong>هنوز پروژه‌ای ذخیره نشده</strong>
              <span>یک پروژهٔ تازه بساز تا از اینجا سریع به آن برگردی.</span>
              <button className="button button-secondary" type="button" onClick={() => onCreate()}><Plus size={16} aria-hidden="true" /> ساخت پروژه</button>
            </div>
          )}
        </section>

        <section className="launcher-section templates-section" aria-labelledby="templates-heading">
          <div className="launcher-section-head">
            <div>
              <p className="launcher-kicker">شروع سریع</p>
              <h2 id="templates-heading">انتخاب تمپلیت</h2>
            </div>
            <span className="section-caption">تمپلیت‌های بیشتر به‌زودی اضافه می‌شوند</span>
          </div>
          <div className="template-grid">
            <button className="template-card template-card-ready" type="button" onClick={() => onCreate()}>
              <span className="template-art template-art-cover" aria-hidden="true"><Layers size={24} /><i /><i /></span>
              <span className="template-card-copy"><strong>کاور نمونه‌کار وب</strong><small>دو تصویر سایت، اطلاعات پروژه و خروجی آمادهٔ انتشار</small></span>
              <span className="template-card-action">شروع با این تمپلیت <Plus size={15} aria-hidden="true" /></span>
            </button>
            <button className="template-card template-card-ready template-card-social" type="button" onClick={() => onCreate("instagram-feed")}>
              <span className="template-art template-art-social" aria-hidden="true"><ImagePlus size={23} /><i /><i /></span>
              <span className="template-card-copy"><strong>کاور شبکه‌های اجتماعی</strong><small>چیدمان مربعی ۱:۱ با متن در چپ و تصاویر هم‌پوشان در راست</small></span>
              <span className="template-card-action">شروع با قالب ۱:۱ <Plus size={15} aria-hidden="true" /></span>
            </button>
            <div className="template-card template-card-disabled" aria-disabled="true">
              <span className="template-art template-art-project" aria-hidden="true"><Palette size={23} /><i /><i /></span>
              <span className="template-card-copy"><strong>معرفی پروژه</strong><small>چیدمان تصویری برای نمایش جزئیات و روند کار</small></span>
              <span className="template-coming">به‌زودی</span>
            </div>
          </div>
        </section>
      </main>
      <footer className="launcher-footer"><span>WEBZAD STUDIO</span><span>ذخیره‌سازی روی MySQL محلی و همین مرورگر</span></footer>
    </div>
  );
}

function ConfirmationModal({ dialog, onClose }: { dialog: ConfirmationDialog; onClose: () => void }) {
  const modalRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);

  const handleConfirm = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const result = await dialog.onConfirm?.();
      if (result !== false) onClose();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [dialog, onClose]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    confirmRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!busyRef.current) onClose();
      } else if (event.key === "Enter") {
        event.preventDefault();
        if (!busyRef.current) void handleConfirm();
      } else if (event.key === "Tab") {
        const focusable = modalRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled)");
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [dialog, handleConfirm, onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <div className="confirm-modal" ref={modalRef} role="alertdialog" aria-modal="true" aria-labelledby="confirm-modal-title" aria-describedby="confirm-modal-message" dir="rtl">
        <button className="modal-close" type="button" aria-label="بستن پنجره" onClick={onClose} disabled={busy}><X size={18} aria-hidden="true" /></button>
        <span className={"modal-icon" + (dialog.destructive ? " modal-icon-danger" : "")}>
          {dialog.destructive ? <Trash2 size={20} aria-hidden="true" /> : <AlertTriangle size={20} aria-hidden="true" />}
        </span>
        <h2 id="confirm-modal-title">{dialog.title}</h2>
        <p id="confirm-modal-message">{dialog.message}</p>
        <div className="modal-actions">
          {dialog.mode === "confirm" && <button className="button button-secondary" type="button" onClick={onClose} disabled={busy}>انصراف <kbd>Esc</kbd></button>}
          <button ref={confirmRef} className={"button " + (dialog.destructive ? "button-danger" : "button-primary")} type="button" onClick={() => void handleConfirm()} disabled={busy}>
            {busy && <LoaderCircle size={15} className="spin" aria-hidden="true" />}
            {busy ? "در حال انجام" : dialog.confirmLabel}
            {!busy && <kbd>Enter</kbd>}
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [project, setProject] = useState<ProjectState>(() => createDefaultProject());
  const [brand, setBrand] = useState<BrandSettings>(() => createDefaultBrand());
  const [view, setView] = useState<"launcher" | "editor">("launcher");
  const [booted, setBooted] = useState(false);
  const [projects, setProjects] = useState<ProjectState[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [notice, setNotice] = useState<Notice>(null);
  const [dialog, setDialog] = useState<ConfirmationDialog | null>(null);
  const [fontsReady, setFontsReady] = useState(false);
  const [resources, setResources] = useState<RenderResources>({ techCustom: new Map() });
  const [resourcesReady, setResourcesReady] = useState(false);
  const [activeLayer, setActiveLayer] = useState<LayerSide | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ side: LayerSide; point: { x: number; y: number } } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const templateDefinition = getTemplateDefinition(project.templateId);
  const activeLogoBox = getLogoBox(brand, project.templateId);
  const activeSignaturePosition = getSignaturePosition(brand, project.templateId);
  const activeTechnologyStyle = getTechnologyStyle(brand, project.templateId);

  const updateLogoBox = (change: Partial<BrandSettings["logoBox"]>) => setBrand((current) => {
    const box = getLogoBox(current, project.templateId);
    return {
      ...current,
      logoBoxes: { ...current.logoBoxes, [project.templateId]: { ...box, ...change } },
      ...(project.templateId === "web-cover" ? { logoBox: { ...current.logoBox, ...change } } : {}),
    };
  });

  const updateSignaturePosition = (change: Partial<{ x: number; y: number }>) => setBrand((current) => {
    const position = getSignaturePosition(current, project.templateId);
    const next = { ...position, ...change };
    return {
      ...current,
      signature: {
        ...current.signature,
        positions: { ...current.signature.positions, [project.templateId]: next },
        ...(project.templateId === "web-cover" ? next : {}),
      },
    };
  });

  const closeDialog = useCallback(() => setDialog(null), []);

  const showNotice = useCallback((kind: "success" | "error", text: string) => {
    if (kind === "error") {
      setNotice(null);
      setDialog({ mode: "notice", title: "عملیات انجام نشد", message: text, confirmLabel: "متوجه شدم" });
      return;
    }
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
        await ensureDefaultWebzadLogo();
        const [storedBrand, storedProjects, activeId] = await Promise.all([
          loadBrand(),
          listProjects(),
          loadActiveProjectId(),
        ]);
        const localProjects = storedProjects.sort((a, b) => b.updatedAt - a.updatedAt);
        const localBrand = migrateBrandLogo(storedBrand?.brand);
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
            initialBrand = migrateBrandLogo(remote.brand);
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

  const createProject = async (templateId: CoverTemplateId = "web-cover") => {
    const next = createDefaultProject(templateId === "instagram-feed" ? "پروژهٔ شبکهٔ اجتماعی" : "پروژهٔ جدید", templateId);
    setProject(next);
    setActiveLayer(null);
    setView("editor");
    try {
      await Promise.all([saveProject(next), saveActiveProjectId(next.id)]);
      await refreshProjects();
      await syncProjectToSql(next, brand, next.id);
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
    setView("editor");
    await saveActiveProjectId(next.id);
    try {
      await setSqlActiveProject(next.id);
    } catch (error) {
      setSaveState("error");
      showNotice("error", error instanceof Error ? error.message : "پروژه در SQL فعال نشد.");
    }
  };

  const deleteSavedProject = async (target: ProjectState) => {
    try {
      await deleteSqlProject(target.id);
      await removeProject(target.id);
      const remaining = (await listProjects()).sort((a, b) => b.updatedAt - a.updatedAt);
      if (target.id === project.id) {
        const next = remaining[0] ?? createDefaultProject();
        if (remaining.length === 0) {
          await saveProject(next);
          remaining.push(next);
        }
        setProject(next);
        setActiveLayer(null);
        await saveActiveProjectId(next.id);
        try {
          await syncProjectToSql(next, brand, next.id);
          await setSqlActiveProject(next.id);
        } catch (error) {
          setSaveState("error");
          setProjects(remaining);
          showNotice("error", error instanceof Error ? error.message : "پروژهٔ فعال در SQL به‌روزرسانی نشد.");
          return false;
        }
      }
      setProjects(remaining);
      await collectOrphanAssets();
      return true;
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "حذف پروژه انجام نشد.");
      return false;
    }
  };

  const confirmDeleteProject = (target: ProjectState) => {
    setDialog({
      mode: "confirm",
      title: "حذف پروژه؟",
      message: `پروژهٔ «${target.name || "بدون نام"}» برای همیشه از فهرست محلی و SQL حذف می‌شود.`,
      confirmLabel: "حذف پروژه",
      destructive: true,
      onConfirm: () => deleteSavedProject(target),
    });
  };

  const confirmResetEverything = () => {
    setDialog({
      mode: "confirm",
      title: "بازنشانی کامل پروژه؟",
      message: "اطلاعات و چیدمان پروژهٔ فعلی و تنظیمات برند به مقدارهای اولیه برمی‌گردد.",
      confirmLabel: "بازنشانی",
      destructive: true,
      onConfirm: () => {
        setProject(createDefaultProject());
        setBrand(createDefaultBrand());
        setActiveLayer(null);
        showNotice("success", "چیدمان و تنظیمات برند بازنشانی شد.");
      },
    });
  };

  const resetProjectFields = () => {
    setProject((current) => {
      const defaults = createDefaultProject(current.name, current.templateId);
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

  const resetBrand = async () => {
    try {
      await ensureDefaultWebzadLogo();
      setBrand(createDefaultBrand());
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "لوگوی پیش‌فرض بارگذاری نشد.");
    }
  };

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
    canvas.width = Math.round(templateDefinition.width * ratio);
    canvas.height = Math.round(templateDefinition.height * ratio);
    try {
      renderCover(canvas, project, brand, resources, ratio);
    } catch {
      return;
    }
  }, [booted, project, brand, resources, fontsReady, templateDefinition.height, templateDefinition.width]);

  const downloadImage = async () => {
    if (!fontsReady || !resourcesReady || isExporting) return;
    setIsExporting(true);
    try {
      await document.fonts.ready;
      const canvas = document.createElement("canvas");
      const scale = project.output.scale;
      const dimensions = outputDimensions(scale, project.templateId);
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
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
      try {
        const previewScale = 0.5;
        const previewCanvas = document.createElement("canvas");
        previewCanvas.width = Math.round(templateDefinition.width * previewScale);
        previewCanvas.height = Math.round(templateDefinition.height * previewScale);
        const previewContext = previewCanvas.getContext("2d");
        if (!previewContext) throw new Error("Preview image could not be created.");
        previewContext.imageSmoothingQuality = "high";
        previewContext.drawImage(canvas, 0, 0, previewCanvas.width, previewCanvas.height);
        const previewBlob = await new Promise<Blob>((resolve, reject) => {
          previewCanvas.toBlob((value) => (value ? resolve(value) : reject(new Error("Preview image could not be created."))), "image/png");
        });
        const previewDimensions = await inspectImageBlob(previewBlob, "image/png");
        const coverPreview: AssetMeta = {
          id: crypto.randomUUID(),
          name: safeName + "-preview.png",
          mime: "image/png",
          ...previewDimensions,
          size: previewBlob.size,
        };
        await saveAsset(coverPreview, previewBlob);
        const updatedProject = { ...project, coverPreview, updatedAt: Date.now() };
        setProject(updatedProject);
        await saveProject(updatedProject);
        try {
          await syncProjectToSql(updatedProject, brand, updatedProject.id);
        } catch {
          setSaveState("error");
        }
        await collectOrphanAssets();
        await refreshProjects();
      } catch {
        setSaveState("error");
        showNotice("error", "The image was downloaded, but its project card preview could not be saved.");
        return;
      }
      showNotice("success", "تصویر " + dimensions.width + " × " + dimensions.height + " پیکسل دانلود شد.");
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
      const importedBrand = imported.brand.logoDefaultApplied
        ? imported.brand
        : {
            ...imported.brand,
            logo: imported.brand.logo ?? { ...DEFAULT_WEBZAD_LOGO },
            logoDefaultApplied: true,
          };
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
    const point = safeCanvasPoint(event.clientX, event.clientY, canvas.getBoundingClientRect(), project.templateId);
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
    const point = safeCanvasPoint(event.clientX, event.clientY, canvas.getBoundingClientRect(), project.templateId);
    const { side, point: previous } = dragRef.current;
    const layer = project[side];
    setLayer(side, { ...layer, x: clamp(layer.x + point.x - previous.x, -templateDefinition.width, templateDefinition.width * 2), y: clamp(layer.y + point.y - previous.y, -templateDefinition.height, templateDefinition.height * 2) });
    dragRef.current = { side, point };
  };

  const layerOutline = (side: LayerSide) => {
    const layer = project[side];
    if (!activeLayer || activeLayer !== side || !layer.asset || !layer.visible) return null;
    const natural = naturalImageRect(layer, layer.asset, project.templateId);
    const height = Math.max(1, Math.min(templateDefinition.height - layer.y, natural.y + natural.height - layer.y));
    return (
      <div
        className="drag-outline"
        aria-hidden="true"
        style={{
          left: (layer.x / templateDefinition.width) * 100 + "%",
          top: (layer.y / templateDefinition.height) * 100 + "%",
          width: (layer.width / templateDefinition.width) * 100 + "%",
          height: (height / templateDefinition.height) * 100 + "%",
        }}
      >
        {side === "front" ? "تصویر جلو" : "تصویر عقب"}
      </div>
    );
  };

  const downloadReady = fontsReady && resourcesReady && !isExporting;

  const noticeToast = notice && (
    <div className="toast" role="status">
      <Check size={17} aria-hidden="true" />
      <span>{notice.text}</span>
      <button type="button" aria-label="بستن پیام" onClick={() => setNotice(null)}><X size={15} aria-hidden="true" /></button>
    </div>
  );

  if (!booted) {
    return <div className="app-loading" dir="rtl"><LoaderCircle size={22} className="spin" aria-hidden="true" /><span>در حال آماده‌سازی پروژه‌ها…</span></div>;
  }

  if (view === "launcher") {
    return (
      <>
        <LauncherHome
          projects={projects}
          activeProjectId={project.id}
          background={brand.background}
          onOpen={(id) => { void loadNamedProject(id); }}
          onCreate={(templateId) => { void createProject(templateId); }}
          onDelete={confirmDeleteProject}
        />
        {noticeToast}
        {dialog && <ConfirmationModal dialog={dialog} onClose={closeDialog} />}
      </>
    );
  }

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
          <button className="button button-secondary" type="button" onClick={() => setView("launcher")}>
            <FolderOpen size={16} aria-hidden="true" /> همهٔ پروژه‌ها
          </button>
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
            <button className="icon-button danger" type="button" aria-label="حذف پروژهٔ فعلی" onClick={() => confirmDeleteProject(project)}>
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
            setProject((current) => ({ ...current, front: { ...createDefaultLayer("front", current.templateId), asset: current.front.asset }, back: { ...createDefaultLayer("back", current.templateId), asset: current.back.asset } }));
          }} resetLabel="بازنشانی جایگاه دو تصویر">
            <div className="swap-row">
              <span>دو تصویر با هم‌پوشانی نمایش داده می‌شوند</span>
              <button className="button button-quiet" type="button" onClick={swapLayers}><ArrowLeftRight size={15} aria-hidden="true" /> جابه‌جایی جلو و عقب</button>
            </div>
            <LayerControls
              side="front"
              layer={project.front}
              canvasHeight={templateDefinition.height}
              selected={activeLayer === "front"}
              onSelect={() => setActiveLayer("front")}
              onChange={(layer) => setLayer("front", layer)}
              onUpload={(file) => void uploadLayer("front", file)}
              onRemove={() => {
                const old = project.front.asset;
                setLayer("front", { ...project.front, asset: null });
                void removeAssetFromCurrent(old);
              }}
              onReset={() => setLayer("front", { ...createDefaultLayer("front", project.templateId), asset: project.front.asset, visible: project.front.visible })}
            />
            <LayerControls
              side="back"
              layer={project.back}
              canvasHeight={templateDefinition.height}
              selected={activeLayer === "back"}
              onSelect={() => setActiveLayer("back")}
              onChange={(layer) => setLayer("back", layer)}
              onUpload={(file) => void uploadLayer("back", file)}
              onRemove={() => {
                const old = project.back.asset;
                setLayer("back", { ...project.back, asset: null });
                void removeAssetFromCurrent(old);
              }}
              onReset={() => setLayer("back", { ...createDefaultLayer("back", project.templateId), asset: project.back.asset, visible: project.back.visible })}
            />
          </SectionPanel>

          <SectionPanel title="لوگوی برند" icon={<Palette size={17} />} onReset={resetBrand} resetLabel="بازنشانی تنظیمات برند">
            <p className="field-hint">لوگوی تیم وبزاد به‌صورت پیش‌فرض استفاده می‌شود؛ در صورت نیاز می‌توانید آن را جایگزین یا حذف کنید.</p>
            <div className="layer-file-row">
              <UploadButton id="upload-logo" label={brand.logo ? "جایگزینی لوگو" : "بارگذاری لوگو"} onFile={(file) => void uploadLogo(file)} />
              {brand.logo && <button className="icon-button danger" type="button" aria-label="حذف لوگو" onClick={() => setBrand((current) => ({ ...current, logo: null }))}><Trash2 size={16} /></button>}
              <CheckField id="logo-visible" label="نمایش" checked={brand.logoVisible} onChange={(logoVisible) => setBrand((current) => ({ ...current, logoVisible }))} />
            </div>
            {brand.logo && <div className="asset-meta"><span className="asset-name">{brand.logo.name}</span><span>{formatDimensions(brand.logo.width, brand.logo.height)}</span><span>{formatBytes(brand.logo.size)}</span></div>}
            <div className="field-grid two">
              <NumberField id="logo-x" label="جایگاه X" value={activeLogoBox.x} min={-1080} max={2160} onChange={(x) => updateLogoBox({ x })} />
              <NumberField id="logo-y" label="جایگاه Y" value={activeLogoBox.y} min={-templateDefinition.height} max={templateDefinition.height * 2} onChange={(y) => updateLogoBox({ y })} />
              <NumberField id="logo-width" label="عرض محدوده" value={activeLogoBox.width} min={1} max={2160} onChange={(width) => updateLogoBox({ width })} />
              <NumberField id="logo-height" label="ارتفاع محدوده" value={activeLogoBox.height} min={1} max={templateDefinition.height * 2} onChange={(height) => updateLogoBox({ height })} />
            </div>
            <RangeField id="logo-opacity" label="شفافیت لوگو" value={Math.round(brand.logoOpacity * 100)} min={0} max={100} suffix="٪" onChange={(logoOpacity) => setBrand((current) => ({ ...current, logoOpacity: logoOpacity / 100 }))} />
            <div className="subsection-label">امضای پایین کاور</div>
            <div className="field">
              <label htmlFor="signature">متن امضا</label>
              <input id="signature" value={brand.signature.text} maxLength={80} onChange={(event) => { const text = event.currentTarget.value; setBrand((current) => ({ ...current, signature: { ...current.signature, text } })); }} />
            </div>
            <div className="field-grid two">
              <NumberField id="signature-x" label="جایگاه X" value={activeSignaturePosition.x} min={-1080} max={2160} onChange={(x) => updateSignaturePosition({ x })} />
              <NumberField id="signature-y" label="جایگاه Y" value={activeSignaturePosition.y} min={-templateDefinition.height} max={templateDefinition.height * 2} onChange={(y) => updateSignaturePosition({ y })} />
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
              <NumberField id="tech-size" label="اندازهٔ آیکون" value={activeTechnologyStyle.size} min={18} max={120} onChange={(iconSize) => setBrand((current) => ({ ...current, iconSizes: { ...current.iconSizes, [project.templateId]: iconSize }, ...(project.templateId === "web-cover" ? { iconSize } : {}) }))} />
              <NumberField id="tech-gap" label="فاصله" value={activeTechnologyStyle.gap} min={0} max={80} onChange={(iconGap) => setBrand((current) => ({ ...current, iconGaps: { ...current.iconGaps, [project.templateId]: iconGap }, ...(project.templateId === "web-cover" ? { iconGap } : {}) }))} />
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
            <TextFields item={project.text.siteName} id="site" canvasHeight={templateDefinition.height} onChange={(change) => updateText("siteName", change)} />
            <div className="subsection-label">نوع قالب</div>
            <TextFields item={project.text.template} id="template" canvasHeight={templateDefinition.height} onChange={(change) => updateText("template", change)} />
            <div className="subsection-label">پیاده‌سازی</div>
            <TextFields item={project.text.implementation} id="implementation-text" canvasHeight={templateDefinition.height} onChange={(change) => updateText("implementation", change)} />
            <div className="subsection-label">موقعیت ردیف تکنولوژی‌ها</div>
            <div className="field-grid three">
              <NumberField id="tech-x" label="جایگاه X" value={project.technologies.x} min={-1080} max={2160} onChange={(x) => setProject((current) => ({ ...current, technologies: { ...current.technologies, x } }))} />
              <NumberField id="tech-y" label="جایگاه Y" value={project.technologies.y} min={-templateDefinition.height} max={templateDefinition.height * 2} onChange={(y) => setProject((current) => ({ ...current, technologies: { ...current.technologies, y } }))} />
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
              <button className="button button-danger full" type="button" onClick={confirmResetEverything}><RotateCcw size={16} /> بازنشانی همهٔ تنظیمات</button>
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
                <option value={1}>1× · {outputDimensions(1, project.templateId).width} × {outputDimensions(1, project.templateId).height}</option>
                <option value={2}>2× · {outputDimensions(2, project.templateId).width} × {outputDimensions(2, project.templateId).height}</option>
                <option value={3}>3× · {outputDimensions(3, project.templateId).width} × {outputDimensions(3, project.templateId).height}</option>
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
              <div className="preview-subtitle">{templateDefinition.title} · {templateDefinition.width} × {templateDefinition.height} پیکسل</div>
            </div>
            <div className="preview-toolbar-actions">
              <span className="drag-hint"><Move size={14} aria-hidden="true" /> برای جابجایی روی تصویر بکشید</span>
              <button className="icon-button subtle" type="button" aria-label="پاک‌کردن انتخاب لایه" onClick={() => setActiveLayer(null)}><EyeOff size={16} /></button>
            </div>
          </div>
          <div className="preview-stage-wrap">
            <div className="cover-stage" style={{ aspectRatio: templateDefinition.width + " / " + templateDefinition.height }}>
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
      {noticeToast}
      {dialog && <ConfirmationModal dialog={dialog} onClose={closeDialog} />}
    </div>
  );
}

function TextFields({
  item,
  id,
  canvasHeight,
  onChange,
}: {
  item: ProjectState["text"]["siteName"];
  id: string;
  canvasHeight: number;
  onChange: (change: Partial<ProjectState["text"]["siteName"]>) => void;
}) {
  return (
    <>
      <div className="field-grid three">
        <NumberField id={id + "-x"} label="جایگاه X" value={item.x} min={-1080} max={2160} onChange={(x) => onChange({ x })} />
        <NumberField id={id + "-y"} label="جایگاه Y" value={item.y} min={-canvasHeight} max={canvasHeight * 2} onChange={(y) => onChange({ y })} />
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
