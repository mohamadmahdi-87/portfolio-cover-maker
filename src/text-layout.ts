export interface FittedText {
  lines: string[];
  fontSize: number;
  overflow: boolean;
  height: number;
}

const lineWidth = (ctx: CanvasRenderingContext2D, text: string) => ctx.measureText(text).width;

const wrapWords = (
  ctx: CanvasRenderingContext2D,
  text: string,
  width: number,
): { lines: string[]; overflow: boolean } => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { lines: [], overflow: false };
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? line + " " + word : word;
    if (line && lineWidth(ctx, candidate) > width) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return {
    lines,
    overflow: lines.some((item) => lineWidth(ctx, item) > width),
  };
};

export const fitText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  width: number,
  preferredSize: number,
  minimumSize: number,
  maxLines = 2,
  fontFamily = "Inter",
): FittedText => {
  const safeWidth = Math.max(1, width);
  const safePreferred = Math.min(240, Math.max(8, Number.isFinite(preferredSize) ? preferredSize : 44));
  const safeMinimum = Math.min(safePreferred, Math.max(8, Number.isFinite(minimumSize) ? minimumSize : 18));
  const minSize = safeMinimum;
  let fontSize = Math.max(minSize, safePreferred);
  let result = { lines: [text], overflow: false };

  while (fontSize > minSize) {
    ctx.font = "600 " + fontSize + "px \"" + fontFamily + "\", \"" + (fontFamily === "Inter" ? "Vazirmatn" : "Inter") + "\", sans-serif";
    result = wrapWords(ctx, text, safeWidth);
    if (!result.overflow && result.lines.length === 1) break;
    fontSize -= 1;
  }
  ctx.font = "600 " + fontSize + "px \"" + fontFamily + "\", \"" + (fontFamily === "Inter" ? "Vazirmatn" : "Inter") + "\", sans-serif";
  result = wrapWords(ctx, text, safeWidth);
  const overflow = result.overflow || result.lines.length > maxLines;
  const lines = result.lines.slice(0, maxLines);
  return {
    lines,
    fontSize,
    overflow,
    height: lines.length * fontSize * 1.22,
  };
};

export const textDirection = (text: string, requested: "auto" | "rtl" | "ltr"): "rtl" | "ltr" => {
  if (requested !== "auto") return requested;
  return /[\u0590-\u08ff]/u.test(text) ? "rtl" : "ltr";
};
