"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { Alert, Button } from "@/src/components/ui";
import { normalizeScannedCode } from "@/src/modules/shop/inventory-code";

// Codigos de fabricante habituales en repuestos, mas Code 128/QR para etiquetas internas.
const SCAN_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "qr_code"] as const;
const SCAN_INTERVAL_MS = 200;
// Los codigos chicos necesitan mas pixeles que los 640x480 que la camara entrega por defecto.
const VIDEO_SIZE = { width: { ideal: 1920 }, height: { ideal: 1080 } };
// Con zoom el celular se sostiene mas lejos, dentro de la distancia minima de enfoque del lente.
const INITIAL_ZOOM = 2;
const CAMERA_STORAGE_KEY = "inventory-scanner-camera";

type Detector = { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> };
type NativeDetectorClass = {
  new (options: { formats: string[] }): Detector;
  getSupportedFormats: () => Promise<string[]>;
};

// Capacidades de Image Capture que TypeScript todavia no declara.
type CameraCapabilities = MediaTrackCapabilities & {
  focusMode?: string[];
  zoom?: { min: number; max: number; step?: number };
  torch?: boolean;
};
type CameraConstraintSet = MediaTrackConstraintSet & {
  focusMode?: string;
  zoom?: number;
  torch?: boolean;
  pointsOfInterest?: Array<{ x: number; y: number }>;
};

type ZoomRange = { min: number; max: number; step: number; value: number };
type CameraControls = { zoom: ZoomRange | null; torch: boolean | null; tapFocus: boolean; canSwitch: boolean };

type ScannerState =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "scanning" }
  | { kind: "detected"; code: string }
  | { kind: "error"; message: string };

const noControls: CameraControls = { zoom: null, torch: null, tapFocus: false, canSwitch: false };

/**
 * Lector de codigos con la camara del celular. Pide permiso recien al tocar el boton,
 * no guarda imagenes y apaga la camara despues de la primera lectura: para leer otro
 * codigo hay que rearmarlo, asi un mismo objeto frente a la camara no se lee dos veces.
 */
export function BarcodeScanner({ onDetected }: { onDetected: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const timerRef = useRef<number | null>(null);
  const cameraIdsRef = useRef<string[]>([]);
  const [state, setState] = useState<ScannerState>({ kind: "idle" });
  const [controls, setControls] = useState<CameraControls>(noControls);

  const stopCamera = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    trackRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  async function start(cameraId: string | null = readStoredCamera()) {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setState({ kind: "error", message: "Este navegador no permite usar la cámara acá. Escribí el código." });
      return;
    }
    setState({ kind: "starting" });
    setControls(noControls);
    try {
      const detector = await createDetector();
      const stream = await openCamera(cameraId);
      streamRef.current = stream;
      const track = stream.getVideoTracks?.()[0] ?? stream.getTracks()[0] ?? null;
      trackRef.current = track;
      const video = videoRef.current;
      if (!video) throw new Error("scanner video element is missing");
      video.srcObject = stream;
      await video.play();
      setState({ kind: "scanning" });
      setControls({ ...(track ? await tuneCamera(track) : noControls), canSwitch: await listCameras(cameraIdsRef) });

      const scan = async () => {
        if (streamRef.current !== stream) return;
        try {
          const code = normalizeScannedCode((await detector.detect(video))[0]?.rawValue);
          if (code) {
            stopCamera();
            setState({ kind: "detected", code });
            onDetected(code);
            return;
          }
        } catch {
          // El cuadro todavia no tiene imagen; se reintenta en el proximo.
        }
        timerRef.current = window.setTimeout(scan, SCAN_INTERVAL_MS);
      };
      void scan();
    } catch (error) {
      stopCamera();
      setState({ kind: "error", message: cameraErrorMessage(error) });
    }
  }

  function cancel() {
    stopCamera();
    setState({ kind: "idle" });
  }

  function switchCamera() {
    const ids = cameraIdsRef.current;
    const current = trackRef.current?.getSettings?.().deviceId;
    const next = ids[(ids.indexOf(current ?? "") + 1) % ids.length];
    if (!next) return;
    storeCamera(next);
    stopCamera();
    void start(next);
  }

  function changeZoom(value: number) {
    setControls((current) => current.zoom ? { ...current, zoom: { ...current.zoom, value } } : current);
    void applyCamera(trackRef.current, { zoom: value });
  }

  function toggleTorch() {
    const on = !controls.torch;
    setControls((current) => ({ ...current, torch: on }));
    void applyCamera(trackRef.current, { torch: on });
  }

  // Enfoca donde se toca, en los navegadores que aceptan un punto de interes.
  function focusAt(event: MouseEvent<HTMLVideoElement>) {
    if (!controls.tapFocus) return;
    const box = event.currentTarget.getBoundingClientRect();
    const point = { x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height };
    void applyCamera(trackRef.current, { pointsOfInterest: [point], focusMode: "continuous" });
  }

  const cameraActive = state.kind === "starting" || state.kind === "scanning";

  return (
    <div className="grid min-w-0 gap-3">
      <div className={cameraActive ? "relative overflow-hidden rounded-2xl border border-white/10 bg-black" : "hidden"}>
        <video ref={videoRef} aria-label="Vista de la cámara" className="aspect-[4/3] w-full object-cover" muted onClick={focusAt} playsInline />
        <div aria-hidden className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-xl border-2 border-apple-400/80" />
      </div>
      <p aria-live="polite" className="text-sm text-zinc-400">
        {state.kind === "starting" ? "Abriendo la cámara…" : null}
        {state.kind === "scanning" ? "Apuntá al código dentro del recuadro. Si es chico, alejá un poco el celular y usá el zoom." : null}
        {state.kind === "detected" ? <>Código leído: <span className="break-all font-mono text-white">{state.code}</span></> : null}
      </p>
      {state.kind === "scanning" && controls.zoom ? (
        <label className="grid gap-2 text-sm text-zinc-300">
          <span>Zoom <span className="text-zinc-500">{controls.zoom.value.toFixed(1)}×</span></span>
          <input
            className="w-full accent-[#8EE000]"
            max={controls.zoom.max}
            min={controls.zoom.min}
            onChange={(event) => changeZoom(Number(event.target.value))}
            step={controls.zoom.step}
            type="range"
            value={controls.zoom.value}
          />
        </label>
      ) : null}
      {state.kind === "error" ? <Alert tone="danger">{state.message}</Alert> : null}
      <div className="flex flex-wrap gap-2">
        {cameraActive ? (
          <>
            {state.kind === "scanning" && controls.torch !== null ? (
              <Button aria-pressed={controls.torch} onClick={toggleTorch} variant="ghost">{controls.torch ? "Apagar linterna" : "Linterna"}</Button>
            ) : null}
            {state.kind === "scanning" && controls.canSwitch ? <Button onClick={switchCamera} variant="ghost">Cambiar cámara</Button> : null}
            <Button onClick={cancel} variant="ghost">Cancelar</Button>
          </>
        ) : (
          <Button onClick={() => void start()} variant="ghost">
            {state.kind === "detected" ? "Escanear otro" : "Escanear con cámara"}
          </Button>
        )}
      </div>
    </div>
  );
}

async function openCamera(cameraId: string | null): Promise<MediaStream> {
  const rearCamera = { video: { facingMode: { ideal: "environment" }, ...VIDEO_SIZE }, audio: false };
  if (!cameraId) return navigator.mediaDevices.getUserMedia(rearCamera);
  try {
    return await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: cameraId }, ...VIDEO_SIZE }, audio: false });
  } catch (error) {
    // La camara guardada ya no existe (otro equipo o permisos reiniciados): se usa la trasera.
    if (error instanceof Error && (error.name === "OverconstrainedError" || error.name === "NotFoundError")) {
      storeCamera(null);
      return navigator.mediaDevices.getUserMedia(rearCamera);
    }
    throw error;
  }
}

/** Activa foco continuo y zoom inicial cuando el equipo los ofrece; si no, deja la camara como esta. */
async function tuneCamera(track: MediaStreamTrack): Promise<CameraControls> {
  const capabilities = (track.getCapabilities?.() ?? {}) as CameraCapabilities;
  const settings: CameraConstraintSet = {};
  if (capabilities.focusMode?.includes("continuous")) settings.focusMode = "continuous";

  let zoom: ZoomRange | null = null;
  if (capabilities.zoom && capabilities.zoom.max > capabilities.zoom.min) {
    const { min, max } = capabilities.zoom;
    const value = Math.min(Math.max(INITIAL_ZOOM, min), max);
    settings.zoom = value;
    zoom = { min, max, step: capabilities.zoom.step || 0.1, value };
  }
  if (Object.keys(settings).length > 0) await applyCamera(track, settings);

  return {
    zoom,
    torch: capabilities.torch ? false : null,
    tapFocus: Boolean(capabilities.focusMode?.length),
    canSwitch: false,
  };
}

async function applyCamera(track: MediaStreamTrack | null, settings: CameraConstraintSet) {
  // Cada equipo acepta un subconjunto distinto; un ajuste rechazado no debe cortar la lectura.
  await track?.applyConstraints({ advanced: [settings] }).catch(() => undefined);
}

/** Guarda las camaras disponibles; los celulares con varios lentes no siempre abren el que enfoca de cerca. */
async function listCameras(target: { current: string[] }): Promise<boolean> {
  const devices = await navigator.mediaDevices.enumerateDevices?.().catch(() => []) ?? [];
  target.current = devices.filter((device) => device.kind === "videoinput" && device.deviceId).map((device) => device.deviceId);
  return target.current.length > 1;
}

function readStoredCamera(): string | null {
  try {
    return window.localStorage.getItem(CAMERA_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeCamera(cameraId: string | null) {
  try {
    if (cameraId) window.localStorage.setItem(CAMERA_STORAGE_KEY, cameraId);
    else window.localStorage.removeItem(CAMERA_STORAGE_KEY);
  } catch {
    // Sin almacenamiento (modo privado): la eleccion vale solo para esta lectura.
  }
}

async function createDetector(): Promise<Detector> {
  const Native = (globalThis as { BarcodeDetector?: NativeDetectorClass }).BarcodeDetector;
  if (Native) {
    const supported = await Native.getSupportedFormats();
    const formats = SCAN_FORMATS.filter((format) => supported.includes(format));
    if (formats.length > 0) return new Native({ formats });
  }
  // iPhone y navegadores sin lector nativo: ZXing en WASM, servido desde /vendor.
  const { BarcodeDetector, ZXING_WASM_VERSION, setZXingModuleOverrides } = await import("barcode-detector/ponyfill");
  setZXingModuleOverrides({
    locateFile: (path: string, prefix: string) => path.endsWith(".wasm") ? `/vendor/zxing_reader-${ZXING_WASM_VERSION}.wasm` : prefix + path,
  });
  return new BarcodeDetector({ formats: [...SCAN_FORMATS] });
}

function cameraErrorMessage(error: unknown): string {
  const name = error instanceof DOMException || error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "No hay permiso para usar la cámara. Habilitalo en el navegador o escribí el código.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No encontramos una cámara disponible. Escribí el código.";
  if (name === "NotReadableError") return "La cámara está siendo usada por otra app. Cerrala o escribí el código.";
  return "No se pudo iniciar la cámara. Escribí el código.";
}
