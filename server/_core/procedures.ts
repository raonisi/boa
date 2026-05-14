import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "./trpc";

/** 지점장 전용 (branch_admin + accountStatus=active) */
export const branchAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  const u = ctx.user;
  if (u.accountStatus !== "active") throw new TRPCError({ code: "FORBIDDEN", message: "계정이 비활성화되었습니다." });
  if (u.role !== "branch_admin") throw new TRPCError({ code: "FORBIDDEN", message: "지점장만 접근 가능합니다." });
  return next({ ctx });
});

/** 부지점장 이상 (sub_branch_admin, branch_admin + active) */
export const subBranchAdminOrAboveProcedure = protectedProcedure.use(({ ctx, next }) => {
  const u = ctx.user;
  if (u.accountStatus !== "active") throw new TRPCError({ code: "FORBIDDEN", message: "계정이 비활성화되었습니다." });
  if (u.role !== "branch_admin" && u.role !== "sub_branch_admin")
    throw new TRPCError({ code: "FORBIDDEN", message: "부지점장 이상만 접근 가능합니다." });
  return next({ ctx });
});

/** 팀장 이상 (team_leader, sub_branch_admin, branch_admin + active) */
export const teamLeaderOrAboveProcedure = protectedProcedure.use(({ ctx, next }) => {
  const u = ctx.user;
  if (u.accountStatus !== "active") throw new TRPCError({ code: "FORBIDDEN", message: "계정이 비활성화되었습니다." });
  if (u.role !== "branch_admin" && u.role !== "sub_branch_admin" && u.role !== "team_leader")
    throw new TRPCError({ code: "FORBIDDEN", message: "팀장 이상만 접근 가능합니다." });
  return next({ ctx });
});

/** 활성 사용자 (accountStatus=active이면 모든 role 허용) */
export const activeUserProcedure = protectedProcedure.use(({ ctx, next }) => {
  const u = ctx.user;
  if (u.accountStatus !== "active") throw new TRPCError({ code: "FORBIDDEN", message: "계정이 비활성화되었습니다." });
  return next({ ctx });
});
