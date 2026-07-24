import type { Express } from "express";
import {
  getHealthVersionSummary,
  getSafeAppVersionMetadata,
} from "./appVersion";

export function registerAppVersionRoutes(app: Express) {
  app.get("/api/health", (_req, res) => {
    const version = getHealthVersionSummary();
    const hasProductionReleaseIdentity =
      version.environmentLabel !== "production" || version.commitSha !== null;
    res.status(hasProductionReleaseIdentity ? 200 : 503).json({
      ok: hasProductionReleaseIdentity,
      service: "boa-crm",
      version,
    });
  });

  app.get("/api/version", (_req, res) => {
    res.status(200).json(getSafeAppVersionMetadata());
  });
}
