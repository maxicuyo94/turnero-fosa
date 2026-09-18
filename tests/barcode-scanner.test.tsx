import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BarcodeScanner } from "@/src/modules/shop/barcode-scanner";

const stopTrack = vi.fn();
const applyConstraints = vi.fn();
const detect = vi.fn();
const getUserMedia = vi.fn();
const enumerateDevices = vi.fn();

class FakeBarcodeDetector {
  static getSupportedFormats = vi.fn(async () => ["ean_13", "code_128"]);
  detect = detect;
}

function fakeStream(capabilities: Record<string, unknown> = {}, deviceId = "rear-main") {
  const track = {
    stop: stopTrack,
    applyConstraints,
    getCapabilities: () => capabilities,
    getSettings: () => ({ deviceId }),
  };
  return { getTracks: () => [track], getVideoTracks: () => [track] };
}

beforeEach(() => {
  window.localStorage.clear();
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia, enumerateDevices } });
  vi.stubGlobal("BarcodeDetector", FakeBarcodeDetector);
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  applyConstraints.mockResolvedValue(undefined);
  enumerateDevices.mockResolvedValue([{ kind: "videoinput", deviceId: "rear-main" }]);
  getUserMedia.mockResolvedValue(fakeStream());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  [stopTrack, applyConstraints, detect, getUserMedia, enumerateDevices].forEach((mock) => mock.mockReset());
});

describe("BarcodeScanner", () => {
  it("lee un código una sola vez, apaga la cámara y exige rearmar para leer otro", async () => {
    const onDetected = vi.fn();
    detect.mockResolvedValueOnce([]).mockResolvedValue([{ rawValue: " 7791234567890\n" }]);
    render(<BarcodeScanner onDetected={onDetected} />);

    fireEvent.click(screen.getByRole("button", { name: "Escanear con cámara" }));

    await waitFor(() => expect(onDetected).toHaveBeenCalledWith("7791234567890"));
    expect(stopTrack).toHaveBeenCalled();
    expect(screen.getByText("7791234567890")).toBeInTheDocument();

    // El mismo codigo sigue frente a la camara: no se vuelve a informar.
    await new Promise((resolve) => setTimeout(resolve, 450));
    expect(onDetected).toHaveBeenCalledTimes(1);
    expect(getUserMedia).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Escanear otro" }));
    await waitFor(() => expect(onDetected).toHaveBeenCalledTimes(2));
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });

  it("pide alta resolución, activa foco continuo y arranca con zoom 2×", async () => {
    detect.mockResolvedValue([]);
    getUserMedia.mockResolvedValue(fakeStream({ focusMode: ["manual", "continuous"], zoom: { min: 1, max: 8, step: 0.1 } }));
    render(<BarcodeScanner onDetected={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Escanear con cámara" }));

    const zoom = await screen.findByRole("slider", { name: /Zoom/ });
    expect(getUserMedia).toHaveBeenCalledWith({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    });
    expect(applyConstraints).toHaveBeenCalledWith({ advanced: [{ focusMode: "continuous", zoom: 2 }] });
    expect(zoom).toHaveValue("2");

    fireEvent.change(zoom, { target: { value: "4.5" } });
    expect(applyConstraints).toHaveBeenLastCalledWith({ advanced: [{ zoom: 4.5 }] });
    expect(screen.getByText("4.5×")).toBeInTheDocument();
  });

  it("prende y apaga la linterna cuando el equipo la tiene", async () => {
    detect.mockResolvedValue([]);
    getUserMedia.mockResolvedValue(fakeStream({ torch: true }));
    render(<BarcodeScanner onDetected={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Escanear con cámara" }));
    fireEvent.click(await screen.findByRole("button", { name: "Linterna" }));
    expect(applyConstraints).toHaveBeenLastCalledWith({ advanced: [{ torch: true }] });

    fireEvent.click(screen.getByRole("button", { name: "Apagar linterna" }));
    expect(applyConstraints).toHaveBeenLastCalledWith({ advanced: [{ torch: false }] });
  });

  it("cambia de lente y recuerda la elección para la próxima lectura", async () => {
    detect.mockResolvedValue([]);
    enumerateDevices.mockResolvedValue([
      { kind: "audioinput", deviceId: "mic" },
      { kind: "videoinput", deviceId: "rear-main" },
      { kind: "videoinput", deviceId: "rear-wide" },
    ]);
    render(<BarcodeScanner onDetected={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Escanear con cámara" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cambiar cámara" }));

    await waitFor(() => expect(getUserMedia).toHaveBeenLastCalledWith({
      video: { deviceId: { exact: "rear-wide" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    }));
    expect(window.localStorage.getItem("inventory-scanner-camera")).toBe("rear-wide");
  });

  it("vuelve a la cámara trasera si la guardada ya no existe", async () => {
    detect.mockResolvedValue([]);
    window.localStorage.setItem("inventory-scanner-camera", "old-phone");
    getUserMedia.mockRejectedValueOnce(Object.assign(new Error("gone"), { name: "OverconstrainedError" }));
    render(<BarcodeScanner onDetected={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Escanear con cámara" }));

    expect(await screen.findByRole("button", { name: "Cancelar" })).toBeInTheDocument();
    await waitFor(() => expect(getUserMedia).toHaveBeenLastCalledWith(expect.objectContaining({
      video: expect.objectContaining({ facingMode: { ideal: "environment" } }),
    })));
    expect(window.localStorage.getItem("inventory-scanner-camera")).toBeNull();
  });

  it("sin controles de cámara (iPhone) no muestra zoom, linterna ni cambio de lente", async () => {
    const onDetected = vi.fn();
    detect.mockResolvedValueOnce([]).mockResolvedValue([{ rawValue: "7791234567890" }]);
    render(<BarcodeScanner onDetected={onDetected} />);

    fireEvent.click(screen.getByRole("button", { name: "Escanear con cámara" }));
    await screen.findByRole("button", { name: "Cancelar" });

    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Linterna" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cambiar cámara" })).not.toBeInTheDocument();
    expect(applyConstraints).not.toHaveBeenCalled();
    await waitFor(() => expect(onDetected).toHaveBeenCalledWith("7791234567890"));
  });

  it("explica el permiso denegado y deja volver a intentar", async () => {
    const onDetected = vi.fn();
    getUserMedia.mockRejectedValue(new DOMException("denied", "NotAllowedError"));
    render(<BarcodeScanner onDetected={onDetected} />);

    fireEvent.click(screen.getByRole("button", { name: "Escanear con cámara" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No hay permiso para usar la cámara");
    expect(screen.getByRole("button", { name: "Escanear con cámara" })).toBeInTheDocument();
    expect(onDetected).not.toHaveBeenCalled();
  });

  it("avisa cuando el navegador no ofrece cámara", async () => {
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });
    render(<BarcodeScanner onDetected={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Escanear con cámara" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Este navegador no permite usar la cámara");
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("cancelar apaga la cámara sin leer nada", async () => {
    const onDetected = vi.fn();
    detect.mockResolvedValue([]);
    render(<BarcodeScanner onDetected={onDetected} />);

    fireEvent.click(screen.getByRole("button", { name: "Escanear con cámara" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));

    expect(stopTrack).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Escanear con cámara" })).toBeInTheDocument();
    expect(onDetected).not.toHaveBeenCalled();
  });
});
