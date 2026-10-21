// Run before migrations: a missing encryption key must never reach a live deployment.
const encryptionKey = process.env.DATA_ENCRYPTION_KEY ?? "";

if (!/^[a-f0-9]{64}$/iu.test(encryptionKey)) {
  console.error("Deployment stopped before database migrations: configure DATA_ENCRYPTION_KEY as 32 random bytes encoded in hex in this Vercel environment.");
  process.exitCode = 1;
} else {
  console.log("Deployment encryption key configuration verified.");
}
