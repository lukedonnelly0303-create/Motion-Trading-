import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { get } from "@vercel/blob";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { kycDocuments } from "@/db/schema";

// Streams a KYC document back to an authenticated admin. Documents live in
// a private Blob store, so this route (not a public URL) is the only way
// to read them — see src/app/api/kyc/upload/route.ts for the upload side.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const [doc] = await db.select().from(kycDocuments).where(eq(kycDocuments.id, params.id)).limit(1);
  if (!doc?.blobPath) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const result = await get(doc.blobPath, { access: "private" });
  if (result?.statusCode !== 200) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(result.stream, {
    headers: {
      "Content-Type": result.blob.contentType || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `inline; filename="${doc.filename.replace(/"/g, "")}"`,
      // KYC documents are PII — never let a browser or intermediary cache them.
      "Cache-Control": "private, no-store",
    },
  });
}
