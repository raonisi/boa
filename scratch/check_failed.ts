import { getDb } from "../server/db";
import { googleCalendarEventSyncs } from "../drizzle/schema";
import { desc, eq } from "drizzle-orm";

async function run() {
  const db = await getDb();
  if (!db) {
    console.log("No DB connection");
    return;
  }
  const syncs = await db
    .select()
    .from(googleCalendarEventSyncs)
    .where(eq(googleCalendarEventSyncs.syncStatus, "failed"))
    .orderBy(desc(googleCalendarEventSyncs.lastSyncedAt))
    .limit(10);

  console.log("Failed syncs:");
  for (const s of syncs) {
    console.log(
      `- ID: ${s.id}, BoaEventId: ${s.boaEventId}, ErrorCode: ${s.lastErrorCode}, ErrorMessage: ${s.lastErrorMessageSafe}`
    );
  }
}

run()
  .catch(console.error)
  .then(() => process.exit(0));
