import { getDb } from "../server/db";
import { googleCalendarEventSyncs } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

async function runAudit() {
  const db = await getDb();
  if (!db) {
    console.log("No DB connection");
    process.exit(1);
  }

  // Find duplicates: same boaEventId, multiple synced rows
  const allSyncs = await db.select().from(googleCalendarEventSyncs);
  
  const grouped = new Map<number, typeof allSyncs>();
  for (const sync of allSyncs) {
    if (sync.syncStatus !== "synced") continue;
    if (!grouped.has(sync.boaEventId)) {
      grouped.set(sync.boaEventId, []);
    }
    grouped.get(sync.boaEventId)!.push(sync);
  }

  let duplicateCount = 0;
  let activeInBranchCommon = 0;
  let activeInConsultationFollowup = 0;

  for (const [boaEventId, syncs] of grouped.entries()) {
    if (syncs.length > 1) {
      console.log(`Duplicate found for boaEventId: ${boaEventId}`);
      duplicateCount++;
    }
    for (const sync of syncs) {
      if (sync.calendarType === "branch_common") activeInBranchCommon++;
      if (sync.calendarType === "consultation_followup") activeInConsultationFollowup++;
    }
  }

  console.log("Duplicate Audit Results:");
  console.log(`Total Synced Events: ${allSyncs.filter(s => s.syncStatus === "synced").length}`);
  console.log(`Duplicates: ${duplicateCount}`);
  console.log(`Active in branch_common: ${activeInBranchCommon}`);
  console.log(`Active in consultation_followup: ${activeInConsultationFollowup}`);
  process.exit(0);
}

runAudit().catch(console.error);
