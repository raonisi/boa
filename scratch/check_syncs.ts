import { getDb } from '../server/db';
import { googleCalendarEventSyncs, googleCalendarIntegrations } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

async function run() {
  const db = await getDb();
  if (!db) { console.log('no db'); return; }
  const syncs = await db.select().from(googleCalendarEventSyncs).where(eq(googleCalendarEventSyncs.calendarType, 'consultation_followup'));
  console.log('Syncs:', syncs);
  const integrations = await db.select().from(googleCalendarIntegrations);
  console.log('Integrations:', integrations);
  process.exit(0);
}
run();
