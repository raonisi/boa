import React from "react";
(globalThis as any).React = React;
import { describe, expect, it, vi, beforeEach } from "vitest";

// Strict Hook Reconciler that mirrors React's internal hook tracking & Rules of Hooks
class StrictHookReconciler {
  previousHooks: string[] | null = null;
  currentHooks: string[] = [];
  renderCount = 0;

  reset() {
    this.previousHooks = null;
    this.currentHooks = [];
    this.renderCount = 0;
  }

  startRender() {
    this.renderCount++;
    if (this.currentHooks.length > 0) {
      this.previousHooks = [...this.currentHooks];
    }
    this.currentHooks = [];
  }

  recordHook(name: string) {
    const index = this.currentHooks.length;
    this.currentHooks.push(name);
    if (this.previousHooks !== null) {
      if (index >= this.previousHooks.length) {
        throw new Error(
          `Rendered more hooks than during the previous render. (Previous: ${this.previousHooks.length}, current index: ${index}, hook: ${name})`
        );
      }
      if (this.previousHooks[index] !== name) {
        throw new Error(
          `React Hook order changed at index ${index}: expected ${this.previousHooks[index]}, got ${name}`
        );
      }
    }
  }

  endRender() {
    if (this.previousHooks !== null && this.currentHooks.length < this.previousHooks.length) {
      throw new Error(
        `Rendered fewer hooks than during the previous render. (Previous: ${this.previousHooks.length}, current: ${this.currentHooks.length})`
      );
    }
  }
}

const reconciler = new StrictHookReconciler();

// Hook interception via React 19 Client Internals
const originalDispatcher = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE?.H;
const mockDispatcher = {
  useContext: (...args: any[]) => {
    reconciler.recordHook("useContext");
    return {};
  },
  useState: (initial: any) => {
    reconciler.recordHook("useState");
    return [typeof initial === "function" ? initial() : initial, () => {}];
  },
  useMemo: (factory: any, deps: any) => {
    reconciler.recordHook("useMemo");
    return factory();
  },
  useCallback: (fn: any, deps: any) => {
    reconciler.recordHook("useCallback");
    return fn;
  },
  useEffect: (effect: any, deps: any) => {
    reconciler.recordHook("useEffect");
  },
  useRef: (initial: any) => {
    reconciler.recordHook("useRef");
    return { current: initial };
  },
  useId: () => {
    reconciler.recordHook("useId");
    return ":r0:";
  },
  useTransition: () => {
    reconciler.recordHook("useTransition");
    return [false, () => {}];
  },
  useSyncExternalStore: (sub: any, get: any) => {
    reconciler.recordHook("useSyncExternalStore");
    return get();
  },
};

// Mock TRPC state & spies
let mockSettingsState: {
  isLoading: boolean;
  isError: boolean;
  data: any;
  refetch: any;
};

let lastResyncHistoryOpts: any = null;

const mutationSpies = {
  upsertCalendarIntegration: vi.fn(),
  testCalendarAccess: vi.fn(),
  retryFailedSync: vi.fn(),
  updateSyncPolicy: vi.fn(),
  updateContactPolicy: vi.fn(),
  upsertPersonalSettings: vi.fn(),
  resyncMisclassifiedConsultationEventsDryRun: vi.fn(),
  resyncMisclassifiedConsultationEventsExecute: vi.fn(),
  duplicateAuditDryRun: vi.fn(),
};

vi.mock("@/components/DashboardLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dashboard-layout">{children}</div>
  ),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => {
      reconciler.recordHook("useUtils");
      return {
        googleCalendar: {
          getSettings: { invalidate: vi.fn() },
          listSyncStatus: { invalidate: vi.fn() },
          listFailedSyncs: { invalidate: vi.fn() },
          getResyncHistory: { invalidate: vi.fn() },
        },
      };
    },
    googleCalendar: {
      getSettings: {
        useQuery: () => {
          reconciler.recordHook("useQuery(getSettings)");
          return mockSettingsState;
        },
      },
      listSyncStatus: {
        useQuery: () => {
          reconciler.recordHook("useQuery(listSyncStatus)");
          return { data: [], isLoading: false };
        },
      },
      listFailedSyncs: {
        useQuery: (_: any, opts: any) => {
          reconciler.recordHook("useQuery(listFailedSyncs)");
          return { data: [], isLoading: false };
        },
      },
      getOAuthConnectUrl: {
        useQuery: () => {
          reconciler.recordHook("useQuery(getOAuthConnectUrl)");
          return { data: { url: "https://example.com" }, refetch: vi.fn() };
        },
      },
      getResyncHistory: {
        useQuery: (_: any, opts: any) => {
          reconciler.recordHook("useQuery(getResyncHistory)");
          lastResyncHistoryOpts = opts;
          return { data: [], isLoading: false };
        },
      },
      previewSafeEventPayload: {
        useQuery: () => {
          reconciler.recordHook("useQuery(previewSafeEventPayload)");
          return { data: null, isLoading: false };
        },
      },
      upsertCalendarIntegration: {
        useMutation: () => {
          reconciler.recordHook("useMutation(upsertCalendarIntegration)");
          return { mutateAsync: mutationSpies.upsertCalendarIntegration };
        },
      },
      testCalendarAccess: {
        useMutation: () => {
          reconciler.recordHook("useMutation(testCalendarAccess)");
          return { mutateAsync: mutationSpies.testCalendarAccess };
        },
      },
      retryFailedSync: {
        useMutation: () => {
          reconciler.recordHook("useMutation(retryFailedSync)");
          return { mutateAsync: mutationSpies.retryFailedSync };
        },
      },
      updateSyncPolicy: {
        useMutation: () => {
          reconciler.recordHook("useMutation(updateSyncPolicy)");
          return { mutateAsync: mutationSpies.updateSyncPolicy };
        },
      },
      updateContactPolicy: {
        useMutation: () => {
          reconciler.recordHook("useMutation(updateContactPolicy)");
          return { mutateAsync: mutationSpies.updateContactPolicy };
        },
      },
      upsertPersonalSettings: {
        useMutation: () => {
          reconciler.recordHook("useMutation(upsertPersonalSettings)");
          return {
            mutate: mutationSpies.upsertPersonalSettings,
            isPending: false,
          };
        },
      },
      resyncMisclassifiedConsultationEventsDryRun: {
        useMutation: () => {
          reconciler.recordHook("useMutation(resyncDryRun)");
          return { mutateAsync: mutationSpies.resyncMisclassifiedConsultationEventsDryRun };
        },
      },
      resyncMisclassifiedConsultationEventsExecute: {
        useMutation: () => {
          reconciler.recordHook("useMutation(resyncExecute)");
          return { mutateAsync: mutationSpies.resyncMisclassifiedConsultationEventsExecute };
        },
      },
      duplicateAuditDryRun: {
        useMutation: () => {
          reconciler.recordHook("useMutation(duplicateAuditDryRun)");
          return { mutateAsync: mutationSpies.duplicateAuditDryRun };
        },
      },
    },
  },
}));

import GoogleCalendarIntegration from "./GoogleCalendarIntegration";

function renderComponent() {
  (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE.H = mockDispatcher;
  try {
    reconciler.startRender();
    const result = GoogleCalendarIntegration();
    reconciler.endRender();
    return { result, hookCount: reconciler.currentHooks.length, hooks: [...reconciler.currentHooks] };
  } finally {
    (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE.H = originalDispatcher;
  }
}

describe("GoogleCalendarIntegration Hook Order & Lifecycle Verification", () => {
  beforeEach(() => {
    reconciler.reset();
    lastResyncHistoryOpts = null;
    Object.values(mutationSpies).forEach(spy => spy.mockClear());
  });

  it("Scenario A: Initial visit -> loading -> loaded success transition preserves exact hook order and count", () => {
    // 1. Loading
    mockSettingsState = {
      isLoading: true,
      isError: false,
      data: undefined,
      refetch: vi.fn(),
    };
    const render1 = renderComponent();
    expect(render1.hookCount).toBe(26);

    // 2. Loaded success
    mockSettingsState = {
      isLoading: false,
      isError: false,
      data: {
        canManage: true,
        oauthConnected: true,
        syncRawTitleToGoogleCalendar: false,
        includeCustomerContactForActorCalendar: false,
        integrations: [
          {
            id: 1,
            calendarType: "branch_common",
            googleCalendarId: "c_1@group.calendar.google.com",
            syncActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        personalSettings: {
          personalCalendarIdMasked: "user***@gmail.com",
          contactDisplayConsent: true,
        },
      },
      refetch: vi.fn(),
    };
    const render2 = renderComponent();
    expect(render2.hookCount).toBe(26);
    expect(render1.hooks).toEqual(render2.hooks);
  });

  it("Scenario B: Initial visit -> loading -> error screen preserves exact hook order and count", () => {
    // 1. Loading
    mockSettingsState = {
      isLoading: true,
      isError: false,
      data: undefined,
      refetch: vi.fn(),
    };
    const render1 = renderComponent();
    expect(render1.hookCount).toBe(26);

    // 2. Error state
    mockSettingsState = {
      isLoading: false,
      isError: true,
      data: undefined,
      refetch: vi.fn(),
    };
    const render2 = renderComponent();
    expect(render2.hookCount).toBe(26);
    expect(render1.hooks).toEqual(render2.hooks);
  });

  it("Scenario C: Error screen -> retry refetch -> success screen preserves hook order and triggers refetch", () => {
    const refetchSpy = vi.fn();
    // 1. Loading
    mockSettingsState = {
      isLoading: true,
      isError: false,
      data: undefined,
      refetch: refetchSpy,
    };
    renderComponent();

    // 2. Error
    mockSettingsState = {
      isLoading: false,
      isError: true,
      data: undefined,
      refetch: refetchSpy,
    };
    const errRender = renderComponent();
    expect(errRender.hookCount).toBe(26);

    // Trigger onRetry from ErrorState element
    const errorStateElement = (errRender.result as any).props.children;
    expect(errorStateElement.props.onRetry).toBeDefined();
    errorStateElement.props.onRetry();
    expect(refetchSpy).toHaveBeenCalledTimes(1);

    // 3. Success after refetch
    mockSettingsState = {
      isLoading: false,
      isError: false,
      data: {
        canManage: true,
        oauthConnected: true,
        syncRawTitleToGoogleCalendar: false,
        includeCustomerContactForActorCalendar: false,
        integrations: [],
        personalSettings: null,
      },
      refetch: refetchSpy,
    };
    const successRender = renderComponent();
    expect(successRender.hookCount).toBe(26);
  });

  it("Scenario D: Empty integrations array renders properly without hook disruption", () => {
    mockSettingsState = {
      isLoading: false,
      isError: false,
      data: {
        canManage: true,
        oauthConnected: true,
        syncRawTitleToGoogleCalendar: false,
        includeCustomerContactForActorCalendar: false,
        integrations: [],
        personalSettings: null,
      },
      refetch: vi.fn(),
    };
    const render = renderComponent();
    expect(render.hookCount).toBe(26);
  });

  it("Scenario E: Unlinked state / personalSettings null does not throw TypeError and preserves hook count", () => {
    mockSettingsState = {
      isLoading: false,
      isError: false,
      data: {
        canManage: false,
        oauthConnected: false,
        syncRawTitleToGoogleCalendar: false,
        includeCustomerContactForActorCalendar: false,
        integrations: [],
        personalSettings: null,
      },
      refetch: vi.fn(),
    };
    expect(() => renderComponent()).not.toThrow();
    const render = renderComponent();
    expect(render.hookCount).toBe(26);
  });

  it("Scenario F-I: Role-based views preserve exact 26 hooks and control canManage query options", () => {
    const roles: Array<{ role: string; canManage: boolean }> = [
      { role: "branch_admin", canManage: true },
      { role: "sub_branch_admin", canManage: false },
      { role: "team_leader", canManage: false },
      { role: "member", canManage: false },
    ];

    for (const { role, canManage } of roles) {
      reconciler.reset();
      mockSettingsState = {
        isLoading: false,
        isError: false,
        data: {
          canManage,
          oauthConnected: true,
          syncRawTitleToGoogleCalendar: false,
          includeCustomerContactForActorCalendar: false,
          integrations: [],
          personalSettings: {
            personalCalendarIdMasked: `user-${role}@example.com`,
            contactDisplayConsent: false,
          },
        },
        refetch: vi.fn(),
      };

      const render = renderComponent();
      expect(render.hookCount).toBe(26);
      expect(lastResyncHistoryOpts?.enabled).toBe(canManage);
    }
  });

  it("Scenario J: Non-admin blocks getResyncHistory query (enabled: false)", () => {
    mockSettingsState = {
      isLoading: false,
      isError: false,
      data: {
        canManage: false,
        oauthConnected: true,
        syncRawTitleToGoogleCalendar: false,
        includeCustomerContactForActorCalendar: false,
        integrations: [],
        personalSettings: null,
      },
      refetch: vi.fn(),
    };
    renderComponent();
    expect(lastResyncHistoryOpts).toEqual({ enabled: false });
  });

  it("Scenario K: Admin enables getResyncHistory query (enabled: true)", () => {
    mockSettingsState = {
      isLoading: false,
      isError: false,
      data: {
        canManage: true,
        oauthConnected: true,
        syncRawTitleToGoogleCalendar: false,
        includeCustomerContactForActorCalendar: false,
        integrations: [],
        personalSettings: null,
      },
      refetch: vi.fn(),
    };
    renderComponent();
    expect(lastResyncHistoryOpts).toEqual({ enabled: true });
  });

  it("Scenario L: No write mutations are dispatched on mount across any state", () => {
    // 1. Loading mount
    mockSettingsState = {
      isLoading: true,
      isError: false,
      data: undefined,
      refetch: vi.fn(),
    };
    renderComponent();

    // 2. Error mount
    mockSettingsState = {
      isLoading: false,
      isError: true,
      data: undefined,
      refetch: vi.fn(),
    };
    renderComponent();

    // 3. Success mount
    mockSettingsState = {
      isLoading: false,
      isError: false,
      data: {
        canManage: true,
        oauthConnected: true,
        syncRawTitleToGoogleCalendar: false,
        includeCustomerContactForActorCalendar: false,
        integrations: [],
        personalSettings: null,
      },
      refetch: vi.fn(),
    };
    renderComponent();

    // Verify zero mutations fired
    for (const [name, spy] of Object.entries(mutationSpies)) {
      expect(spy).not.toHaveBeenCalled();
    }
  });
});
