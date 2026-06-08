const MIN_SCALE = 0.05;
const MAX_SCALE = 20;
const STANDARD_DPI = 72;

const dropZone = document.getElementById("drop-zone") as HTMLDivElement;
const app = document.getElementById("app") as HTMLDivElement;
const viewport = document.getElementById("viewport") as HTMLDivElement;
const wrapper = document.getElementById("image-wrapper") as HTMLDivElement;
const gridCanvas = document.getElementById("grid-canvas") as HTMLCanvasElement;
const gridCtx = gridCanvas.getContext("2d")!;
const rulerTop = document.getElementById("ruler-top") as HTMLCanvasElement;
const rulerLeft = document.getElementById("ruler-left") as HTMLCanvasElement;
const rulerTopCtx = rulerTop.getContext("2d")!;
const rulerLeftCtx = rulerLeft.getContext("2d")!;
const gridWidthInput = document.getElementById("grid-width") as HTMLInputElement;
const gridHeightInput = document.getElementById("grid-height") as HTMLInputElement;
const coordinates = document.getElementById("coordinates") as HTMLDivElement;

let currentImage: HTMLImageElement | null = null;
let scale = 1;
let dpiScale = 1;

function imgW(): number {
  return currentImage ? currentImage.naturalWidth / dpiScale : 0;
}

function imgH(): number {
  return currentImage ? currentImage.naturalHeight / dpiScale : 0;
}

function cellW(): number {
  return parseInt(gridWidthInput.value, 10) || 25;
}

function cellH(): number {
  return parseInt(gridHeightInput.value, 10) || 25;
}

function parsePngDpiScale(buffer: ArrayBuffer): number {
  const view = new DataView(buffer);
  if (buffer.byteLength < 8 || view.getUint32(0) !== 0x89504e47) return 1;

  let offset = 8;
  while (offset + 12 <= buffer.byteLength) {
    const length = view.getUint32(offset);
    const type = view.getUint32(offset + 4);

    // pHYs = 0x70485973
    if (type === 0x70485973 && length === 9 && offset + 21 <= buffer.byteLength) {
      const pxPerUnitX = view.getUint32(offset + 8);
      const unit = view.getUint8(offset + 16);
      if (unit === 1 && pxPerUnitX > 0) {
        const dpi = pxPerUnitX * 0.0254;
        if (dpi > STANDARD_DPI + 1) return dpi / STANDARD_DPI;
      }
      return 1;
    }

    offset += 12 + length;
  }
  return 1;
}

function applyLayout() {
  if (!currentImage) return;
  const w = imgW();
  const h = imgH();
  const displayW = w * scale;
  const displayH = h * scale;

  currentImage.style.width = `${displayW}px`;
  currentImage.style.height = `${displayH}px`;
  updateMarkerPosition();

  gridCanvas.width = currentImage.naturalWidth;
  gridCanvas.height = currentImage.naturalHeight;
  gridCanvas.style.width = `${displayW}px`;
  gridCanvas.style.height = `${displayH}px`;
}

function drawGrid() {
  if (!currentImage) return;
  applyLayout();

  const natW = currentImage.naturalWidth;
  const natH = currentImage.naturalHeight;
  const cw = cellW();
  const ch = cellH();
  const w = imgW();
  const h = imgH();

  gridCtx.clearRect(0, 0, natW, natH);
  gridCtx.strokeStyle = "rgba(255, 0, 0, 0.4)";
  gridCtx.lineWidth = 1;

  gridCtx.beginPath();
  for (let lx = 0; lx <= w; lx += cw) {
    const px = lx * dpiScale;
    gridCtx.moveTo(px + 0.5, 0);
    gridCtx.lineTo(px + 0.5, natH);
  }
  for (let ly = 0; ly <= h; ly += ch) {
    const py = ly * dpiScale;
    gridCtx.moveTo(0, py + 0.5);
    gridCtx.lineTo(natW, py + 0.5);
  }
  gridCtx.stroke();

  drawRulers();
}

function labelStep(cellSize: number): number {
  const screenCell = cellSize * scale;
  if (screenCell < 8) return Math.ceil(40 / screenCell);
  if (screenCell < 20) return Math.ceil(24 / screenCell);
  return 1;
}

function setupCanvas(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  rect: DOMRect,
  dpr: number,
) {
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, rect.width, rect.height);
  ctx.fillStyle = "#bbb";
  ctx.font = "10px system-ui, sans-serif";
  ctx.strokeStyle = "#555";
  ctx.lineWidth = 1;
}

function drawRulers() {
  if (!currentImage) return;
  const dpr = window.devicePixelRatio || 1;

  const topRect = rulerTop.getBoundingClientRect();
  setupCanvas(rulerTop, rulerTopCtx, topRect, dpr);
  rulerTopCtx.textAlign = "center";
  rulerTopCtx.textBaseline = "top";

  const leftRect = rulerLeft.getBoundingClientRect();
  setupCanvas(rulerLeft, rulerLeftCtx, leftRect, dpr);
  rulerLeftCtx.textAlign = "right";
  rulerLeftCtx.textBaseline = "middle";

  const scrollX = viewport.scrollLeft;
  const scrollY = viewport.scrollTop;
  const cw = cellW();
  const ch = cellH();
  const w = imgW();
  const h = imgH();
  const stepH = labelStep(cw);
  const stepV = labelStep(ch);

  for (let i = 0; i * cw <= w; i++) {
    const lx = i * cw;
    const screenX = lx * scale - scrollX;
    if (screenX < -50 || screenX > topRect.width + 50) continue;
    rulerTopCtx.beginPath();
    rulerTopCtx.moveTo(screenX + 0.5, topRect.height - 6);
    rulerTopCtx.lineTo(screenX + 0.5, topRect.height);
    rulerTopCtx.stroke();
    if (i % stepH === 0) {
      rulerTopCtx.fillStyle = "#bbb";
      rulerTopCtx.fillText(String(lx), screenX, 2);
    }
  }

  for (let i = 0; i * ch <= h; i++) {
    const ly = i * ch;
    const screenY = ly * scale - scrollY;
    if (screenY < -20 || screenY > leftRect.height + 20) continue;
    rulerLeftCtx.beginPath();
    rulerLeftCtx.moveTo(leftRect.width - 6, screenY + 0.5);
    rulerLeftCtx.lineTo(leftRect.width, screenY + 0.5);
    rulerLeftCtx.stroke();
    if (i % stepV === 0) {
      rulerLeftCtx.fillStyle = "#bbb";
      rulerLeftCtx.fillText(String(ly), leftRect.width - 10, screenY);
    }
  }
}

function fitToScreen() {
  if (!currentImage) return;
  const vw = viewport.clientWidth;
  const vh = viewport.clientHeight;
  scale = Math.min(vw / imgW(), vh / imgH());
  drawGrid();
}

function loadImage(file: File) {
  if (!file.type.startsWith("image/")) return;

  const reader = new FileReader();
  reader.onload = () => {
    const buffer = reader.result as ArrayBuffer;
    dpiScale = parsePngDpiScale(buffer);

    const blob = new Blob([buffer], { type: file.type });
    const url = URL.createObjectURL(blob);

    const existing = wrapper.querySelector("img");
    if (existing) existing.remove();

    const img = new Image();
    img.onload = () => {
      currentImage = img;
      dropZone.style.display = "none";
      app.style.display = "grid";
      wrapper.insertBefore(img, gridCanvas);
      viewport.scrollLeft = 0;
      viewport.scrollTop = 0;
      fitToScreen();
    };
    img.src = url;
  };
  reader.readAsArrayBuffer(file);
}

function handleDrop(e: DragEvent) {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  const file = e.dataTransfer?.files[0];
  if (file) loadImage(file);
}

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", handleDrop);

app.addEventListener("dragover", (e) => e.preventDefault());
app.addEventListener("drop", handleDrop);

viewport.addEventListener(
  "wheel",
  (e) => {
    if (!currentImage) return;
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();

    const rect = viewport.getBoundingClientRect();
    const mouseViewX = e.clientX - rect.left;
    const mouseViewY = e.clientY - rect.top;
    const logX = (viewport.scrollLeft + mouseViewX) / scale;
    const logY = (viewport.scrollTop + mouseViewY) / scale;

    const zoomIntensity = 0.002;
    const factor = Math.exp(-e.deltaY * zoomIntensity);
    scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * factor));

    applyLayout();
    drawGrid();

    viewport.scrollLeft = logX * scale - mouseViewX;
    viewport.scrollTop = logY * scale - mouseViewY;

    drawRulers();
  },
  { passive: false },
);

viewport.addEventListener("scroll", () => {
  drawRulers();
});

function toImageCoords(e: MouseEvent): { x: number; y: number } {
  const rect = viewport.getBoundingClientRect();
  return {
    x: Math.round((e.clientX - rect.left + viewport.scrollLeft) / scale),
    y: Math.round((e.clientY - rect.top + viewport.scrollTop) / scale),
  };
}

const CLICK_MARKER_SVG = `<svg width="24" height="24" viewBox="0 0 1024 1024" fill="red" style="opacity:0.5" xmlns="http://www.w3.org/2000/svg"><path d="M406.055 511.941c0 0.004 0 0.007 0 0.008 0 58.479 47.407 105.886 105.886 105.886 58.478 0 105.886-47.407 105.886-105.886 0-0.004 0-0.008 0-0.008 0-0.003 0-0.007 0-0.007 0-58.478-47.407-105.886-105.886-105.886-58.478 0-105.886 47.407-105.886 105.886 0 0.004 0 0.007 0 0.007zM511.941 859.615c-191.564 0-347.555-155.992-347.555-347.674s155.992-347.555 347.555-347.555 347.555 155.992 347.555 347.555-155.874 347.674-347.555 347.674zM511.941 235.292c-152.565 0-276.65 124.085-276.65 276.65s124.085 276.65 276.65 276.65 276.65-124.085 276.65-276.65-124.085-276.65-276.65-276.65z"/></svg>`;

let clickMarker: HTMLDivElement | null = null;
let markerImgX = 0;
let markerImgY = 0;
let dragging = false;

function updateMarkerPosition() {
  if (!clickMarker) return;
  clickMarker.style.left = `${markerImgX * scale}px`;
  clickMarker.style.top = `${markerImgY * scale}px`;
}

function ensureMarker() {
  if (clickMarker) clickMarker.remove();
  clickMarker = document.createElement("div");
  clickMarker.innerHTML = CLICK_MARKER_SVG;
  clickMarker.style.cssText =
    "position:absolute;pointer-events:none;transform:translate(-50%,-50%)";
  wrapper.appendChild(clickMarker);
}

viewport.addEventListener("pointerdown", (e) => {
  if (!currentImage) return;
  dragging = true;
  viewport.setPointerCapture(e.pointerId);
  const { x, y } = toImageCoords(e);
  markerImgX = x;
  markerImgY = y;
  ensureMarker();
  updateMarkerPosition();
  coordinates.textContent = `x: ${x}, y: ${y}`;
});

viewport.addEventListener("pointermove", (e) => {
  if (!currentImage) return;
  const { x, y } = toImageCoords(e);
  if (dragging) {
    markerImgX = x;
    markerImgY = y;
    updateMarkerPosition();
  }
  coordinates.textContent = `x: ${x}, y: ${y}`;
});

viewport.addEventListener("pointerup", (e) => {
  if (!currentImage || !dragging) return;
  dragging = false;
  viewport.releasePointerCapture(e.pointerId);
  const { x, y } = toImageCoords(e);
  markerImgX = x;
  markerImgY = y;
  updateMarkerPosition();
  navigator.clipboard.writeText(`PPoint(${x}, ${y})`);
  coordinates.textContent = `Copied PPoint(${x}, ${y})`;
});

gridWidthInput.addEventListener("input", drawGrid);
gridHeightInput.addEventListener("input", drawGrid);

window.addEventListener("resize", () => {
  if (currentImage) drawRulers();
});
