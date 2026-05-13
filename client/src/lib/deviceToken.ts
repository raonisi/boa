export const FCM_TOKEN_STORAGE_KEY = "boa-fcm-device-token";
export const FCM_DEVICE_ID_STORAGE_KEY = "boa-fcm-device-id";

export function getOrCreateDeviceId() {
  const existing = localStorage.getItem(FCM_DEVICE_ID_STORAGE_KEY);
  if (existing) return existing;
  const next =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `device_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(FCM_DEVICE_ID_STORAGE_KEY, next);
  return next;
}
