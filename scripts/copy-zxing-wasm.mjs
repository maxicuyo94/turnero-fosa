// Copia el lector ZXing (WASM) que usa `barcode-detector` a `public/vendor/`, para
// servirlo desde la propia app en lugar del CDN que la libreria usa por defecto.
// El nombre lleva la version para que el navegador no reutilice un binario viejo.
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const fromBarcodeDetector = { paths: [dirname(require.resolve("barcode-detector"))] };
const wasmPath = require.resolve("zxing-wasm/reader/zxing_reader.wasm", fromBarcodeDetector);
const packagePath = join(dirname(wasmPath), "..", "..", "package.json");
const { version } = JSON.parse(readFileSync(packagePath, "utf8"));

const targetDirectory = join(process.cwd(), "public", "vendor");
mkdirSync(targetDirectory, { recursive: true });
copyFileSync(wasmPath, join(targetDirectory, `zxing_reader-${version}.wasm`));
console.log(`zxing_reader-${version}.wasm copied to public/vendor/`);
