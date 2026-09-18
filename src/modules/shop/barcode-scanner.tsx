"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button } from "@/src/components/ui";
import { normalizeScannedCode } from "@/src/modules/shop/inventory-code";

// Codigos de fabricante habituales en repuestos, mas Code 128/QR para etiquetas internas.
const SCAN_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "qr_code"] as const;
const SCAN_INTERVAL_MS = 200;

type Detector = { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> };
type NativeDetectorClass = {
  new (options: { formats: string[] }): Detector;
  getSupportedFormats: () => Promise<string[]>;
};

type ScannerState =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "scanning" }
  | { kind: "detected"; code: string }
  | { kind: "error"; message: string };

/**
 * Lector de codigos con la camara del celular. Pide permiso recien al tocar el boton,
 * no guarda imagenes y apaga la camara despues de la primera lectura: para leer otro
 * codigo hay que rearmarlo, asi un mismo objeto frente a la camara no se lee dos veces.
 */
export function BarcodeScanner({ onDetected }: { onDetected: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const [state, setState] = useState<ScannerState>({ kind: "idle" });

  const stopCamera = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  async function start() {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setState({ kind: "error", message: "Este navegador no permite usar la cámara acá. Escribí el código." });
      return;
    }
    setState({ kind: "starting" });
    try {
      const detector = await createDetector();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("scanner video element is missing");
      video.srcObject = stream;
      await video.play();
      setState({ kind: "scanning" });

      const scan = async () => {
        if (!streamRef.current) return;
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

  const cameraActive = state.kind === "starting" || state.kind === "scanning";

  return (
    <div className="grid min-w-0 gap-3">
      <div className={cameraActive ? "relative overflow-hidden rounded-2xl border border-white/10 bg-black" : "hidden"}>
        <video ref={videoRef} aria-label="Vista de la cámara" className="aspect-[4/3] w-full object-cover" muted playsInline />
        <div aria-hidden className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-xl border-2 border-apple-400/80" />
      </div>
      <p aria-live="polite" className="text-sm text-zinc-400">
        {state.kind === "starting" ? "Abriendo la cámara…" : null}
        {state.kind === "scanning" ? "Apuntá al código de barras dentro del recuadro." : null}
        {state.kind === "detected" ? <>Código leído: <span className="break-all font-mono text-white">{state.code}</span></> : null}
      </p>
      {state.kind === "error" ? <Alert tone="danger">{state.message}</Alert> : null}
      {cameraActive ? (
        <Button className="justify-self-start" onClick={cancel} variant="ghost">Cancelar</Button>
      ) : (
        <Button className="justify-self-start" onClick={() => void start()} variant="ghost">
          {state.kind === "detected" ? "Escanear otro" : "Escanear con cámara"}
        </Button>
      )}
    </div>
  );
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
