import "dotenv/config";

import { sqlClient } from "../lib/db/client";
import { resetDemoData } from "../lib/db/seed";

async function main() {
  const summary = await resetDemoData();
  console.log("Summer Cup 2026 demo data restored.");
  console.log(
    JSON.stringify(
      {
        event: "/events/" + summary.eventSlug,
        ...summary.counts,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sqlClient.end({ timeout: 5 });
  });
