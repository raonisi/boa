import { Capacitor } from "@capacitor/core";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

import {
  ANDROID_EXIT_PROMPT_MESSAGE,
  closeTopBackDismissableLayer,
  hasOpenBackDismissableLayer,
  resolveAndroidBackAction,
} from "@/lib/androidBackButton";

type NativeAndroidBackResult = "handled" | "exit-app";

declare global {
  interface Window {
    __boaHandleAndroidBackButton?: () => NativeAndroidBackResult;
  }
}

function canHandleAndroidBackButton() {
  return (
    typeof window !== "undefined" &&
    Capacitor.isNativePlatform() &&
    Capacitor.getPlatform() === "android"
  );
}

export function AndroidBackButtonHandler() {
  const [location, setLocation] = useLocation();
  const locationRef = useRef(location);
  const lastExitPromptAtRef = useRef<number | null>(null);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  useEffect(() => {
    if (!canHandleAndroidBackButton()) return;

    const previousHandler = window.__boaHandleAndroidBackButton;

    window.__boaHandleAndroidBackButton = () => {
      const doc = window.document;
      const hasOpenOverlay = hasOpenBackDismissableLayer(doc);
      const action = resolveAndroidBackAction({
        locationPath: locationRef.current,
        hasRouteHistory: window.history.length > 1,
        hasOpenOverlay,
        lastExitPromptAt: lastExitPromptAtRef.current,
        now: Date.now(),
      });

      if (action === "close-overlay") {
        closeTopBackDismissableLayer(doc);
        return "handled";
      }

      if (action === "route-back") {
        lastExitPromptAtRef.current = null;
        window.history.back();
        return "handled";
      }

      if (action === "go-home") {
        lastExitPromptAtRef.current = null;
        setLocation("/");
        return "handled";
      }

      if (action === "show-exit-prompt") {
        lastExitPromptAtRef.current = Date.now();
        toast.message(ANDROID_EXIT_PROMPT_MESSAGE, {
          id: "android-back-exit-toast",
        });
        return "handled";
      }

      return "exit-app";
    };

    return () => {
      if (previousHandler) {
        window.__boaHandleAndroidBackButton = previousHandler;
      } else {
        delete window.__boaHandleAndroidBackButton;
      }
    };
  }, [setLocation]);

  return <span hidden data-testid="app-back-handler-ready" />;
}
