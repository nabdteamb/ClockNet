import { createHash } from "node:crypto";

const DEVICE_HASH_SALT = process.env.DEVICE_HASH_SALT ?? "clocknet-default-salt";

export function hashDeviceFingerprint(fingerprint: string): string {
  return createHash("sha256")
    .update(`${DEVICE_HASH_SALT}:${fingerprint}`)
    .digest("hex");
}
