import { inArray } from "drizzle-orm";
import { getDb } from "./db";
import {
  customers,
  consultations,
  followUps,
  schedules,
  users,
  teams,
} from "../drizzle/schema";

export const SLA_TARGET_HOURS = 24;
export const SLA_HIGH_RISK_HOURS = 48;
export const SLA_CRITICAL_HOURS = 72;

export function maskNameForSla(name: string) {
  if (!name) return "";
  if (name.length === 2) return name[0] + "*";
  if (name.length > 2)
    return name[0] + "*".repeat(name.length - 2) + name[name.length - 1];
  return name;
}

export async function buildFirstContactSlaInsights(
  scopedCustomers: any[],
  activeUsers: any[],
  visibleTeams: any[]
) {
  const db = await getDb();
  if (!db) return null;

  const validCustomers = scopedCustomers.filter(
    c => c.agentId && c.assignedAt && c.isActive
  );
  const customerIds = validCustomers.map(c => c.id);

  let allConsultations: any[] = [];
  let allFollowUps: any[] = [];
  let allSchedules: any[] = [];

  // Chunk fetching to avoid parameter limits
  const chunkSize = 1000;
  for (let i = 0; i < customerIds.length; i += chunkSize) {
    const chunk = customerIds.slice(i, i + chunkSize);
    if (chunk.length === 0) continue;

    const [cRes, fRes, sRes] = await Promise.all([
      db
        .select()
        .from(consultations)
        .where(inArray(consultations.customerId, chunk)),
      db.select().from(followUps).where(inArray(followUps.customerId, chunk)),
      db.select().from(schedules).where(inArray(schedules.customerId, chunk)),
    ]);

    allConsultations.push(...cRes);
    allFollowUps.push(...fRes);
    allSchedules.push(...sRes);
  }

  const now = new Date();
  const customerMap = new Map();

  for (const customer of validCustomers) {
    const assignedAt = new Date(customer.assignedAt);
    const cData = allConsultations.filter(
      c => c.customerId === customer.id && new Date(c.createdAt) >= assignedAt
    );
    const fData = allFollowUps.filter(
      f =>
        f.customerId === customer.id &&
        (new Date(f.createdAt) >= assignedAt ||
          (f.completedAt && new Date(f.completedAt) >= assignedAt))
    );
    const sData = allSchedules.filter(
      s =>
        s.customerId === customer.id &&
        (new Date(s.createdAt) >= assignedAt ||
          (s.completedAt && new Date(s.completedAt) >= assignedAt))
    );

    const contactDates: Date[] = [];
    cData.forEach(c => contactDates.push(new Date(c.createdAt)));
    fData.forEach(f => {
      contactDates.push(new Date(f.createdAt));
      if (f.completedAt) contactDates.push(new Date(f.completedAt));
    });
    sData.forEach(s => {
      contactDates.push(new Date(s.createdAt));
      if (s.completedAt) contactDates.push(new Date(s.completedAt));
    });

    if (customer.consultStatus !== "미상담" && contactDates.length === 0) {
      contactDates.push(new Date(customer.updatedAt));
    }

    contactDates.sort((a, b) => a.getTime() - b.getTime());
    const firstContactAt = contactDates.length > 0 ? contactDates[0] : null;

    const elapsedMs = firstContactAt
      ? firstContactAt.getTime() - assignedAt.getTime()
      : now.getTime() - assignedAt.getTime();
    const elapsedHours = elapsedMs / (1000 * 60 * 60);

    let status = "not_contacted";
    let riskLevel = "none";

    if (firstContactAt) {
      if (elapsedHours <= SLA_TARGET_HOURS) status = "contacted_on_time";
      else status = "contacted_late";
    } else {
      if (elapsedHours > SLA_CRITICAL_HOURS) {
        status = "critical_overdue";
        riskLevel = "critical";
      } else if (elapsedHours > SLA_HIGH_RISK_HOURS) {
        status = "high_risk_overdue";
        riskLevel = "high";
      } else if (elapsedHours > SLA_TARGET_HOURS) {
        status = "overdue";
        riskLevel = "warning";
      } else {
        status = "not_contacted";
      }
    }

    customerMap.set(customer.id, {
      customerId: customer.id,
      displayName: maskNameForSla(customer.name),
      assignedAgentId: customer.agentId,
      assignedAt: assignedAt.toISOString(),
      firstContactAt: firstContactAt?.toISOString() ?? null,
      elapsedHours,
      status,
      riskLevel,
      consultStatus: customer.consultStatus,
    });
  }

  // Build Users array
  const usersOutput = activeUsers.map(user => {
    const userCustomers = validCustomers.filter(c => c.agentId === user.id);
    const assignedCount = userCustomers.length;
    let contactedOnTime = 0,
      contactedLate = 0,
      notContacted = 0,
      overdue = 0,
      highRisk = 0,
      critical = 0;
    let totalElapsedHoursForContacted = 0;
    let contactedCount = 0;

    userCustomers.forEach(c => {
      const data = customerMap.get(c.id);
      if (!data) return;
      if (data.status === "contacted_on_time") contactedOnTime++;
      else if (data.status === "contacted_late") contactedLate++;
      else if (data.status === "not_contacted") notContacted++;
      else if (data.status === "overdue") overdue++;
      else if (data.status === "high_risk_overdue") highRisk++;
      else if (data.status === "critical_overdue") critical++;

      if (data.firstContactAt) {
        contactedCount++;
        totalElapsedHoursForContacted += data.elapsedHours;
      }
    });

    const completionRate =
      assignedCount > 0
        ? Math.round((contactedCount / assignedCount) * 100)
        : 0;
    const avgHours =
      contactedCount > 0
        ? Math.round((totalElapsedHoursForContacted / contactedCount) * 10) / 10
        : 0;

    let userRisk = "normal";
    if (critical > 0) userRisk = "critical";
    else if (highRisk > 0 || overdue > 3) userRisk = "high";
    else if (overdue > 0) userRisk = "warning";

    const team = visibleTeams.find(t => t.id === user.teamId);

    return {
      userId: user.id,
      name: user.name,
      role: user.role,
      teamName: team?.name ?? "미지정",
      metrics: {
        assignedCount,
        contactedOnTime,
        contactedLate,
        notContacted,
        overdue,
        highRisk,
        critical,
        completionRate,
        averageFirstContactHours: avgHours,
      },
      riskLevel: userRisk,
    };
  });

  // Global summary
  const summary = {
    assignedCustomerCount: validCustomers.length,
    contactedOnTimeCount: 0,
    contactedLateCount: 0,
    notContactedCount: 0,
    overdueCount: 0,
    highRiskOverdueCount: 0,
    criticalOverdueCount: 0,
    completionRate: 0,
    averageFirstContactHours: 0,
  };

  let totalContacted = 0;
  let totalElapsed = 0;

  customerMap.forEach(data => {
    if (data.status === "contacted_on_time") summary.contactedOnTimeCount++;
    else if (data.status === "contacted_late") summary.contactedLateCount++;
    else if (data.status === "not_contacted") summary.notContactedCount++;
    else if (data.status === "overdue") summary.overdueCount++;
    else if (data.status === "high_risk_overdue")
      summary.highRiskOverdueCount++;
    else if (data.status === "critical_overdue") summary.criticalOverdueCount++;

    if (data.firstContactAt) {
      totalContacted++;
      totalElapsed += data.elapsedHours;
    }
  });

  summary.completionRate =
    validCustomers.length > 0
      ? Math.round((totalContacted / validCustomers.length) * 100)
      : 0;
  summary.averageFirstContactHours =
    totalContacted > 0
      ? Math.round((totalElapsed / totalContacted) * 10) / 10
      : 0;

  const overdueCustomers = Array.from(customerMap.values())
    .filter(c =>
      ["overdue", "high_risk_overdue", "critical_overdue"].includes(c.status)
    )
    .sort((a, b) => b.elapsedHours - a.elapsedHours);

  return {
    summary,
    users: usersOutput,
    overdueCustomers,
  };
}
