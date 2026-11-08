import { lazy } from "react";

type CustomerDetailModule = typeof import("../pages/CustomerDetail");
type ChunkFailureKind = "network" | "missing" | "html" | "invalid-path" | "invalid-module" | "exhausted";
const MAX_MODULE_ATTEMPTS = 4;

const messages: Record<ChunkFailureKind, string> = {
  network: "고객 상세 화면 리소스를 불러오지 못했습니다. 네트워크 연결을 확인하고 다시 시도해 주세요.",
  missing: "현재 버전의 고객 상세 파일을 찾을 수 없습니다. 페이지를 새로고침해 최신 화면을 불러와 주세요.",
  html: "고객 상세 파일 대신 다른 응답을 받았습니다. 페이지를 새로고침해 다시 확인해 주세요.",
  "invalid-path": "고객 상세 화면 파일을 확인할 수 없습니다. 페이지를 새로고침해 주세요.",
  "invalid-module": "고객 상세 화면을 초기화할 수 없습니다. 페이지를 새로고침해 주세요.",
  exhausted: "고객 상세 화면을 계속 불러오지 못했습니다. 페이지를 새로고침해 주세요.",
};

export class CustomerDetailChunkError extends Error {
  readonly refreshRequired: boolean;
  readonly canRetry: boolean;

  constructor(readonly kind: ChunkFailureKind, readonly attempt: number) {
    super(messages[kind]);
    this.name = "CustomerDetailChunkError";
    this.refreshRequired = kind !== "network" || attempt > 1;
    this.canRetry = attempt < MAX_MODULE_ATTEMPTS;
  }
}

// Only the current document's Vite preload path is eligible for a retry.
// Never accept an external origin, another script, or a supplied query/hash.
export function resolveCustomerDetailChunkPath(
  hrefs: readonly string[],
  origin: string,
  development = false
): string | undefined {
  for (const href of hrefs) {
    try {
      const url = new URL(href, origin);
      const allowed = development
        ? /^\/src\/pages\/CustomerDetail\.tsx$/
        : /^\/assets\/CustomerDetail-[\w-]+\.js$/;
      if (url.origin === origin && !url.username && !url.password &&
          !url.search && !url.hash && allowed.test(url.pathname)) {
        return url.pathname;
      }
    } catch {
      // A malformed preload is not a script source.
    }
  }
}

export function classifyCustomerDetailResponse(status: number, mime: string): ChunkFailureKind {
  if (status === 404 || status === 410) return "missing";
  if (status === 200 && !/^(?:application|text)\/(?:javascript|ecmascript)$/i.test(mime.split(";")[0].trim())) {
    return "html";
  }
  return "network";
}

function currentChunkPath() {
  const hrefs = import.meta.env.DEV
    ? [new URL(import.meta.url).pathname.replace(/lib\/customerDetailLoader\.ts$/, "pages/CustomerDetail.tsx")]
    : Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="modulepreload"][href]'), link => link.getAttribute("href") ?? "");
  return resolveCustomerDetailChunkPath(hrefs, window.location.origin, import.meta.env.DEV);
}

async function diagnoseFailure(path?: string): Promise<ChunkFailureKind> {
  if (!path) return "invalid-path";
  try {
    const response = await fetch(path, {
      cache: "no-store", credentials: "same-origin", redirect: "error",
      signal: AbortSignal.timeout(3000),
    });
    const kind = classifyCustomerDetailResponse(response.status, response.headers.get("content-type") ?? "");
    await response.body?.cancel();
    return kind;
  } catch {
    return "network";
  }
}

let attempts = 0;
let loaded: CustomerDetailModule | undefined;
let request: Promise<CustomerDetailModule> | undefined;
let component = lazy(loadCustomerDetail);

function loadCustomerDetail(): Promise<CustomerDetailModule> {
  if (loaded) return Promise.resolve(loaded);
  if (request) return request;
  if (attempts >= MAX_MODULE_ATTEMPTS) {
    return Promise.reject(new CustomerDetailChunkError("exhausted", attempts));
  }
  const attempt = ++attempts;
  let specifier: string | undefined;
  request = Promise.resolve().then(async () => {
    try {
      let module: CustomerDetailModule;
      if (attempt === 1) {
        // Keep Vite code splitting and its build-owned preload path.
        module = await import("../pages/CustomerDetail");
      } else {
        const path = currentChunkPath();
        if (!path) throw new CustomerDetailChunkError("invalid-path", attempt);
        specifier = path + "?customer-detail-retry=" + attempt;
        module = await import(/* @vite-ignore */ specifier) as CustomerDetailModule;
      }
      if (typeof module.default !== "function") {
        throw new CustomerDetailChunkError("invalid-module", attempt);
      }
      loaded = module;
      return module;
    } catch (error) {
      const failure = error instanceof CustomerDetailChunkError
        ? error
        : new CustomerDetailChunkError(await diagnoseFailure(specifier ?? currentChunkPath()), attempt);
      // React.lazy caches rejections too. Only future attempts use a new lazy
      // object; a successful page retains its identity across customer changes.
      component = lazy(loadCustomerDetail);
      throw failure;
    } finally {
      request = undefined;
    }
  });
  return request;
}

export function getCustomerDetailComponent() {
  return component;
}
