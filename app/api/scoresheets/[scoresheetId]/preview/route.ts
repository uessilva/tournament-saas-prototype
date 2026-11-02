import { storage } from "@/lib/storage";
import { bytesToArrayBuffer } from "@/lib/bytes";
import { getScoresheetAccess } from "@/features/scoresheets/access";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ scoresheetId: string }> },
) {
  const { scoresheetId } = await context.params;
  const access = await getScoresheetAccess(scoresheetId);
  if (!access || !access.sheet.previewStorageKey) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const bytes = await storage.read(access.sheet.previewStorageKey);
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
