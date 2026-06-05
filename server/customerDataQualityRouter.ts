import { z } from "zod";
import { activeUserProcedure } from "./_core/procedures";
import { router } from "./_core/trpc";
import {
  buildCustomerDataQualityDashboard,
  buildCustomerDataQualityFilterOptions,
} from "./customerDataQuality";

const dashboardInputSchema = z.object({
  assignedUserId: z.number().optional(),
  teamId: z.number().optional(),
  subBranchId: z.number().optional(),
  issueType: z.string().optional(),
  qualityLevel: z.enum(["good", "needs_improvement", "caution", "critical"]).optional(),
  search: z.string().optional(),
  sortBy: z.enum(["quality_score_asc", "last_managed_asc", "issue_count_desc"]).default("quality_score_asc"),
  limit: z.number().min(1).max(100).default(25),
  offset: z.number().min(0).default(0),
}).optional();

export const customerDataQualityRouter = router({
  filterOptions: activeUserProcedure.query(async ({ ctx }) =>
    buildCustomerDataQualityFilterOptions(ctx.user as any),
  ),
  dashboard: activeUserProcedure
    .input(dashboardInputSchema)
    .query(async ({ ctx, input }) =>
      buildCustomerDataQualityDashboard(ctx.user as any, input ?? {}),
    ),
});
