import { getLoginUrlResult } from "@/const";
import { FCM_TOKEN_STORAGE_KEY } from "@/lib/deviceToken";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });
  const deactivateDeviceTokenMutation = trpc.deviceTokens.deactivate.useMutation();

  const logout = useCallback(async () => {
    try {
      const deviceToken = localStorage.getItem(FCM_TOKEN_STORAGE_KEY);
      if (deviceToken) {
        try {
          await deactivateDeviceTokenMutation.mutateAsync({ token: deviceToken });
        } catch (error) {
          console.warn("[FCM] Failed to deactivate device token during logout.", error);
        } finally {
          localStorage.removeItem(FCM_TOKEN_STORAGE_KEY);
        }
      }
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [deactivateDeviceTokenMutation, logoutMutation, utils]);

  const state = useMemo(() => {
    return {
      user: meQuery.data ?? null,
      loading: meQuery.isLoading || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || logoutMutation.isPending) return;
    if (state.user) return;
    if (typeof window === "undefined") return;

    const loginUrl = redirectPath
      ? { ok: true as const, url: redirectPath }
      : getLoginUrlResult();

    if (!loginUrl.ok) {
      console.error("[Auth] Login URL configuration error:", loginUrl.message);
      return;
    }

    if (window.location.href === loginUrl.url) return;

    window.location.href = loginUrl.url;
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    meQuery.isLoading,
    state.user,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
