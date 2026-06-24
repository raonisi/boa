import { getGoogleCalendarApiClient } from "../server/googleCalendarClient.ts";
import { getAccessTokenOrThrow } from "../server/googleCalendarAuth.ts";

async function run() {
  try {
    const token = await getAccessTokenOrThrow();
    const client = getGoogleCalendarApiClient();
    const res = await client.testCalendarAccess(token, "f8d8....com");
    console.log("RESULT:", res);
  } catch (e) {
    console.error("ERROR:", e);
  }
  process.exit(0);
}
run();
