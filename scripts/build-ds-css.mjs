/* Compiles the design-system stylesheet into ds-dist/ds.css.
   Uses the postcss + @tailwindcss/postcss pair the app already depends on, so
   the DS build adds no new packages. */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";

const from = path.resolve("src/components/ui/ds.css");
const to = path.resolve("ds-dist/ds.css");

const source = await readFile(from, "utf8");
const result = await postcss([tailwindcss()]).process(source, { from, to });

await mkdir(path.dirname(to), { recursive: true });
await writeFile(to, result.css, "utf8");

console.log(`ds.css -> ${path.relative(process.cwd(), to)} (${result.css.length} bytes)`);
