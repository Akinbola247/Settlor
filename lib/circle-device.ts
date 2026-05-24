"use client";

import { deleteCookie, getCookie, setCookie } from "cookies-next";
import type { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";

export const DEVICE_ID_STORAGE_KEY = "deviceId";

const DEVICE_COOKIE_NAMES = ["deviceToken", "deviceEncryptionKey"] as const;

/** Cookie options so device tokens survive OAuth redirects on mobile Safari (HTTPS prod). */
export function deviceCookieOptions() {
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:";
  return {
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
    sameSite: "lax" as const,
    secure,
  };
}

export function setDeviceCookies(deviceToken: string, deviceEncryptionKey: string) {
  const opts = deviceCookieOptions();
  setCookie("deviceToken", deviceToken, opts);
  setCookie("deviceEncryptionKey", deviceEncryptionKey, opts);
}

export function readDeviceCookies() {
  return {
    deviceToken: (getCookie("deviceToken") as string) || "",
    deviceEncryptionKey: (getCookie("deviceEncryptionKey") as string) || "",
  };
}

export function clearDeviceTokenCookies() {
  const opts = { path: "/" };
  for (const name of DEVICE_COOKIE_NAMES) {
    deleteCookie(name, opts);
  }
}

/** Clear device id + tokens (use when Circle reports unknown device or invalid token). */
export function clearCircleDeviceState() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(DEVICE_ID_STORAGE_KEY);
  }
  clearDeviceTokenCookies();
}

export function hasDeviceCookies(): boolean {
  const { deviceToken, deviceEncryptionKey } = readDeviceCookies();
  return Boolean(deviceToken && deviceEncryptionKey);
}

/** Circle W3S device / token errors that require re-registering the browser device. */
export function isDeviceCredentialError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("device id is not found") ||
    m.includes("device id not found") ||
    m.includes("incorrect device") ||
    m.includes("device token is invalid") ||
    m.includes("invalid device token") ||
    m.includes("only one active token") ||
    (m.includes("device token") && m.includes("invalid"))
  );
}

/**
 * Device id from Circle SDK (source of truth). If localStorage drifts from the SDK
 * (common after ITP / app env changes), drop stale cookies bound to the old id.
 */
export async function resolveDeviceId(sdk: W3SSdk): Promise<string> {
  const sdkDeviceId = await sdk.getDeviceId();
  if (typeof window === "undefined") return sdkDeviceId;

  const stored = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (stored && stored !== sdkDeviceId) {
    clearDeviceTokenCookies();
  }
  window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, sdkDeviceId);
  return sdkDeviceId;
}
