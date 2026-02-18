import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("")
}

export function createRandomToken(length = 12): string {
  const size = Math.max(length, 4)
  const cryptoApi = globalThis.crypto

  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID().replace(/-/g, "").slice(0, size)
  }

  if (cryptoApi?.getRandomValues) {
    const bytes = new Uint8Array(Math.ceil(size / 2))
    cryptoApi.getRandomValues(bytes)
    return bytesToHex(bytes).slice(0, size)
  }

  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`.slice(0, size)
}

export function createRandomUUID(): string {
  const cryptoApi = globalThis.crypto
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID()
  }

  const seed = createRandomToken(32).padEnd(32, "0").slice(0, 32)
  return `${seed.slice(0, 8)}-${seed.slice(8, 12)}-${seed.slice(12, 16)}-${seed.slice(16, 20)}-${seed.slice(20, 32)}`
}
