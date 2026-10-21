import { spawnSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { parse } from "dotenv";

const git = (args, input) => {
  const result = spawnSync("git", args, { input, maxBuffer: 256 * 1024 * 1024, windowsHide: true });
  if (result.status !== 0) throw new Error("Git secret scan failed.");
  return result.stdout;
};
const known = new Set();
for (const file of readdirSync(".").filter((name) => /^\.env(?:\.|$)/u.test(name) && name !== ".env.example")) {
  if (!statSync(file).isFile()) continue;
  for (const [name, value] of Object.entries(parse(readFileSync(file)))) {
    if (!/(SECRET|PASSWORD|TOKEN|API_KEY|ENCRYPTION_KEY|DATABASE_URL)/u.test(name) || value.length < 16 || /replace|generate-with|localhost|127\.0\.0\.1/iu.test(value)) continue;
    known.add(value);
    if (name.includes("DATABASE_URL")) {
      try { const password = decodeURIComponent(new URL(value).password); if (password.length >= 16) known.add(password); } catch { /* no secrets printed */ }
    }
  }
}
const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/gu,
  /\b(?:ghp_|github_pat_|sk_live_|sk-proj-|AKIA)[A-Za-z0-9_-]{20,}/gu,
  /\bAPP_USR-[A-Za-z0-9_-]{25,}/gu,
  /\bre_[A-Za-z0-9]{25,}/gu,
  /postgres(?:ql)?:\/\/[^\s"']+:[^\s"']+@(?!(?:localhost|127\.0\.0\.1)(?=[:/]))[^\s"']+/gu,
];
let findings = 0;
const checked = new Set();
// Verified synthetic URL fixtures, matched by both path and exact fingerprint, never whole folders.
const testUrlFingerprints = new Set(["17f5a4f1b879", "84bd9b865183"]);
function check(bytes, path) {
  if (path === ".env.example") return;
  const content = bytes.toString("utf8");
  const matches = new Set([...known].filter((value) => content.includes(value)));
  for (const pattern of patterns) for (const match of content.matchAll(pattern)) matches.add(match[0]);
  for (const value of matches) {
    const fingerprint = createHash("sha256").update(value).digest("hex").slice(0, 12);
    if (["tests/test-data-guard.test.ts", "history/tests/test-data-guard.test.ts"].includes(path) && testUrlFingerprints.has(fingerprint) && !known.has(value)) continue;
    const identity = `${path}:${fingerprint}`;
    if (checked.has(identity)) continue;
    checked.add(identity); findings++;
    console.error(`Potential secret: ${path} (fingerprint ${fingerprint}; value redacted)`);
  }
}
const objects = git(["rev-list", "--objects", "--all"]).toString("utf8").trim().split("\n").map((line) => {
  const space = line.indexOf(" ");
  return { id: space < 0 ? line : line.slice(0, space), path: space < 0 ? "Git object" : line.slice(space + 1) };
});
const batch = git(["cat-file", "--batch"], objects.map((object) => object.id).join("\n") + "\n");
let offset = 0;
let blobs = 0;
for (const object of objects) {
  const end = batch.indexOf(10, offset);
  const [, type, length] = batch.toString("utf8", offset, end).split(" ");
  const size = Number(length);
  if (!Number.isFinite(size)) throw new Error("Invalid Git object response.");
  const content = batch.subarray(end + 1, end + 1 + size);
  if (type === "blob") { check(content, `history/${object.path}`); blobs++; }
  offset = end + 1 + size + 1;
}
// Include current tracked/untracked source, including new files. Ignored local secrets are never printed.
for (const file of git(["ls-files", "-z", "--cached", "--others", "--exclude-standard"]).toString("utf8").split("\0").filter(Boolean)) {
  if (existsSync(file) && statSync(file).isFile()) check(readFileSync(file), file);
}
if (existsSync(".next/static")) {
  const scanBundle = (folder) => { for (const name of readdirSync(folder)) { const path = `${folder}/${name}`; if (statSync(path).isDirectory()) scanBundle(path); else check(readFileSync(path), path); } };
  scanBundle(".next/static");
}
console.log(`Scanned ${blobs} historical blobs, current source and available client bundles; ${findings} potential secrets.`);
console.log("Pattern scan is not proof of absence; rotate any credential confirmed to have been exposed.");
process.exitCode = findings ? 1 : 0;
