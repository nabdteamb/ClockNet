export function buildDeviceFingerprint(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const browser = navigator.userAgent;
  const os = navigator.platform;
  const resolution = `${window.screen.width}x${window.screen.height}`;

  return [browser, os, resolution].join("|");
}
