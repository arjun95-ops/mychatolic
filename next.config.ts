import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));

function normalizeAllowedDevOrigin(value: string): string | null {
  const raw = value.trim().toLowerCase();
  if (!raw) return null;

  try {
    const parsed = new URL(raw.includes('://') ? raw : `http://${raw}`);
    return parsed.hostname.toLowerCase();
  } catch {
    const normalized = raw
      .replace(/^https?:\/\//, '')
      .split('/')[0]
      ?.split(':')[0]
      ?.trim();
    return normalized || null;
  }
}

const envAllowedDevOrigins = [
  ...new Set(
    (process.env.NEXT_ALLOWED_DEV_ORIGINS ?? '')
      .split(',')
      .map(normalizeAllowedDevOrigin)
      .filter((value): value is string => Boolean(value))
  ),
];

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: false,
  allowedDevOrigins:
    envAllowedDevOrigins.length > 0
      ? envAllowedDevOrigins
      : [
          '192.168.1.27',
          'localhost',
          '127.0.0.1',
          '::1',
        ],
  turbopack: {
    root: rootDir,
  },
};

export default nextConfig;
