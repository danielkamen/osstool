import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

const execFile = promisify(execFileCb);

const NAMESPACE = "contribution-provenance";

export async function signWithSsh(
  payload: Buffer,
  keyPath: string,
): Promise<string> {
  const payloadPath = join(tmpdir(), `provenance-payload-${randomUUID()}`);
  const sigPath = `${payloadPath}.sig`;

  try {
    await writeFile(payloadPath, payload);
    await execFile("ssh-keygen", [
      "-Y",
      "sign",
      "-f",
      keyPath,
      "-n",
      NAMESPACE,
      payloadPath,
    ]);
    const sig = await readFile(sigPath, "utf-8");
    return Buffer.from(sig).toString("base64");
  } finally {
    await unlink(payloadPath).catch(() => {});
    await unlink(sigPath).catch(() => {});
  }
}

export async function verifySshSignature(
  payload: Buffer,
  signature: string,
  allowedSignersContent: string,
): Promise<boolean> {
  const id = randomUUID();
  const sigPath = join(tmpdir(), `provenance-sig-${id}`);
  const payloadPath = join(tmpdir(), `provenance-payload-${id}`);
  const signersPath = join(tmpdir(), `provenance-signers-${id}`);

  try {
    const sigContent = Buffer.from(signature, "base64").toString("utf-8");
    await writeFile(sigPath, sigContent);
    await writeFile(payloadPath, payload);
    await writeFile(signersPath, allowedSignersContent);

    await execFile("ssh-keygen", [
      "-Y",
      "verify",
      "-f",
      signersPath,
      "-n",
      NAMESPACE,
      "-s",
      sigPath,
      "-I",
      "contributor",
    ]);
    return true;
  } catch {
    return false;
  } finally {
    await unlink(sigPath).catch(() => {});
    await unlink(payloadPath).catch(() => {});
    await unlink(signersPath).catch(() => {});
  }
}
