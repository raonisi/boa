import type { Express } from "express";
import {
  getHealthVersionSummary,
  getSafeAppVersionMetadata,
} from "./appVersion";

export function registerAppVersionRoutes(app: Express) {
  app.get("/api/health", (_req, res) => {
    res.status(200).json({
      ok: true,
      service: "boa-crm",
      version: getHealthVersionSummary(),
    });
  });

  app.get("/api/version", (_req, res) => {
    res.status(200).json(getSafeAppVersionMetadata());
  });
}
