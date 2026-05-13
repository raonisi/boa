import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { trpc } from "@/lib/trpc";
import { FCM_TOKEN_STORAGE_KEY, getOrCreateDeviceId } from "@/lib/deviceToken";

type ActiveUser = {
  id: number;
  accountStatus?: string | null;
};

export function useFcmDeviceTokenRegistration(user: ActiveUser | null) {
  const registeredForUserRef = useRef<number | null>(null);
  const registerMutation = trpc.deviceTokens.register.useMutation();

  useEffect(() => {
    if (!user || user.accountStatus !== "active") return;
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;
    if (registeredForUserRef.current === user.id) return;

    let isCancelled = false;
    registeredForUserRef.current = user.id;

    const register = async () => {
      try {
        const permission = await PushNotifications.checkPermissions();
        const shouldRequestPermission = permission.receive === "prompt" || permission.receive === "prompt-with-rationale";
        const receivePermission = shouldRequestPermission
          ? (await PushNotifications.requestPermissions()).receive
          : permission.receive;

        if (receivePermission !== "granted") {
          console.info("[FCM] Push notification permission was not granted.");
          return;
        }

        const registrationListener = await PushNotifications.addListener("registration", async (token) => {
          if (isCancelled) return;
          try {
            localStorage.setItem(FCM_TOKEN_STORAGE_KEY, token.value);
            await registerMutation.mutateAsync({
              token: token.value,
              platform: "android",
              deviceId: getOrCreateDeviceId(),
              appVersion: "1.0.0",
              deviceModel: navigator.userAgent.slice(0, 180),
              osVersion: navigator.platform || "android",
            });
          } catch (error) {
            console.warn("[FCM] Failed to register device token.", error);
          }
        });

        const errorListener = await PushNotifications.addListener("registrationError", (error) => {
          console.warn("[FCM] Push registration failed.", error);
        });

        await PushNotifications.register();

        return () => {
          registrationListener.remove();
          errorListener.remove();
        };
      } catch (error) {
        console.warn("[FCM] Push notification setup skipped.", error);
      }
    };

    let cleanup: (() => void) | undefined;
    register().then((result) => {
      cleanup = result;
      if (isCancelled) cleanup?.();
    });

    return () => {
      isCancelled = true;
      cleanup?.();
    };
  }, [registerMutation, user]);
}
