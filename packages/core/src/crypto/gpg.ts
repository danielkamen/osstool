import { exec as execCb } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

const exec = promisify(execCb);

export async function signWithGpg(
  payload: Buffer,
  keyId: string,
): Promise<string> {
  const payloadPath = join(tmpdir(), `provenance-payload-${randomUUID()}`);
  const sigPath = `${payloadPath}.asc`;

  try {
    await writeFile(payloadPath, payload);
    await exec(
      `gpg --detach-sign --armor --local-user "${keyId}" --output "${sigPath}" "${payloadPath}"`,
    );
    const sig = await readFile(sigPath, "utf-8");
    return sig.trim();
  } finally {
    await unlink(payloadPath).catch(() => {});
    await unlink(sigPath).catch(() => {});
  }
}

export async function verifyGpgSignature(
  payload: Buffer,
  signature: string,
): Promise<boolean> {
  const sigPath = join(tmpdir(), `provenance-sig-${randomUUID()}.asc`);
  const payloadPath = join(tmpdir(), `provenance-payload-${randomUUID()}`);

  try {
    await writeFile(sigPath, signature);
    await writeFile(payloadPath, payload);
    await exec(`gpg --verify "${sigPath}" "${payloadPath}"`);
    return true;
  } catch {
    return false;
  } finally {
    await unlink(sigPath).catch(() => {});
    await unlink(payloadPath).catch(() => {});
  }
}
