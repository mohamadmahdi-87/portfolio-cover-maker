import { useState, type ChangeEvent, type ReactNode } from "react";
import { ChevronDown, ChevronUp, RotateCcw, Upload } from "lucide-react";

export function SectionPanel({
  title,
  icon,
  children,
  initialOpen = false,
  onReset,
  resetLabel,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  initialOpen?: boolean;
  onReset?: () => void;
  resetLabel?: string;
}) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <section className="section-panel">
      <div className="section-heading">
        <button
          className="section-toggle"
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          <span className="section-icon" aria-hidden="true">{icon}</span>
          <span>{title}</span>
          {open ? <ChevronUp size={17} aria-hidden="true" /> : <ChevronDown size={17} aria-hidden="true" />}
        </button>
        {onReset && (
          <button className="icon-button subtle" type="button" onClick={onReset} aria-label={resetLabel ?? "بازنشانی بخش"}>
            <RotateCcw size={15} aria-hidden="true" />
          </button>
        )}
      </div>
      {open && <div className="section-content">{children}</div>}
    </section>
  );
}

export function NumberField({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const next = Number(event.currentTarget.value);
          if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)));
        }}
      />
    </div>
  );
}

export function RangeField({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="range-field">
      <div className="range-label-row">
        <label htmlFor={id}>{label}</label>
        {editing ? (
          <input
            className="range-value-input"
            aria-label={label + " مقدار عددی"}
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            autoFocus
            onBlur={() => setEditing(false)}
            onChange={(event) => {
              const next = Number(event.currentTarget.value);
              if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)));
            }}
          />
        ) : (
          <button
            className="range-value"
            type="button"
            aria-label={label + "؛ مقدار " + value + (suffix ?? "") + "، برای ویرایش کلیک کنید"}
            onClick={() => setEditing(true)}
          >
            {value}{suffix}
          </button>
        )}
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </div>
  );
}

export function ColorField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="field color-field">
      <label htmlFor={id}>{label}</label>
      <div className="color-input-wrap">
        <input id={id} type="color" value={value} onChange={(event) => onChange(event.currentTarget.value)} />
        <span>{value.toUpperCase()}</span>
      </div>
    </div>
  );
}

export function CheckField({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="check-field" htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.currentTarget.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function UploadButton({
  id,
  label,
  onFile,
  multiple = false,
  accept = "image/png,image/jpeg,image/webp",
}: {
  id: string;
  label: string;
  onFile: (file: File) => void;
  multiple?: boolean;
  accept?: string;
}) {
  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (file) onFile(file);
    event.currentTarget.value = "";
  };
  return (
    <label className="upload-button" htmlFor={id}>
      <Upload size={16} aria-hidden="true" />
      <span>{label}</span>
      <input
        className="visually-hidden"
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={onChange}
      />
    </label>
  );
}

export const formatBytes = (bytes: number) => {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
};

export const formatDimensions = (width: number, height: number) => width + " × " + height + " px";
