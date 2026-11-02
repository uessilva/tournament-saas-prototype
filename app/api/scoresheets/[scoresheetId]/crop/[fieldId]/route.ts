import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { extractedFields } from "@/lib/db/schema";
import { storage } from "@/lib/storage";
import { bytesToArrayBuffer } from "@/lib/bytes";
import { getScoresheetAccess } from "@/features/scoresheets/access";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ scoresheetId: string; fieldId: string }> },
) {
  const { scoresheetId, fieldId } = await context.params;
  const access = await getScoresheetAccess(scoresheetId);
  if (!access) {
    return new Response("Not found", { status: 404 });
  }

  const [field] = await db
    .select()
    .from(extractedFields)
    .where(
      and(
        eq(extractedFields.id, fieldId),
        eq(extractedFields.scoresheetId, scoresheetId),
      ),
    )
    .limit(1);

  if (!field?.cropStorageKey) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const bytes = await storage.read(field.cropStorageKey);
    return new Response(
      new Blob([bytesToArrayBuffer(bytes)], { type: "image/svg+xml; charset=utf-8" }),
      {
        headers: {
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
