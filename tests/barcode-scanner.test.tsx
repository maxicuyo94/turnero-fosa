import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BarcodeScanner } from "@/src/modules/shop/barcode-scanner";

const stopTrack = vi.fn();
const detect = vi.fn();
const getUserMedia = vi.fn();

class FakeBarcodeDetector {
  static getSupportedFormats = vi.fn(async () => ["ean_13", "code_128"]);
  detect = detect;
}

beforeEach(() => {
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
  vi.stubGlobal("BarcodeDetector", FakeBarcodeDetector);
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  getUserMedia.mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  stopTrack.mockReset();
  detect.mockReset();
  getUserMedia.mockReset();
});

describe("BarcodeScanner", () => {
  it("lee un código una sola vez, apaga la cámara y exige rearmar para leer otro", async () => {
    const onDetected = vi.fn();
    detect.mockResolvedValueOnce([]).mockResolvedValue([{ rawValue: " 7791234567890\n" }]);
    render(<BarcodeScanner onDetected={onDetected} />);

    fireEvent.click(screen.getByRole("button", { name: "Escanear con cámara" }));

    await waitFor(() => expect(onDetected).toHaveBeenCalledWith("7791234567890"));
    expect(getUserMedia).toHaveBeenCalledWith({ video: { facingMode: { ideal: "environment" } }, audio: false });
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
