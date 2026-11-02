import { getScoresheetAccess } from "@/features/scoresheets/access";
import { storage } from "@/lib/storage";
import { bytesToArrayBuffer } from "@/lib/bytes";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ scoresheetId: string }> },
) {
  const { scoresheetId } = await context.params;
  const access = await getScoresheetAccess(scoresheetId);

  if (!access) {
    return new Response("Not found", { status: 404 });
  }

  let bytes: Buffer;
  try {
    bytes = await storage.read(access.sheet.storageKey);
  } catch {
    return new Response("Stored file not found", { status: 404 });
  }

  const download = new URL(request.url).searchParams.get("download") === "1";
  const filename = access.sheet.originalFilename.replaceAll('"', "");
  return new Response(new Blob([bytesToArrayBuffer(bytes)], { type: "application/pdf" }), {
    headers: {
      "Content-Type": access.sheet.mimeType || "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
