import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { put } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db, newId } from "@/db";
import { kycDocuments, users } from "@/db/schema";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 8MB)" }, { status: 400 });
  }

  const safeName = `${session.user.id}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  // KYC documents are identity/financial documents, so they go in the
  // private Blob store — reads require an authenticated fetch, not a bare
  // public URL. See /api/admin/kyc/[id]/file for how they're served back.
  let blob;
  try {
    blob = await put(`kyc/${safeName}`, file, { access: "private" });
  } catch (err) {
    console.error("KYC blob upload failed", err);
    return NextResponse.json(
      { error: "Upload storage isn't configured yet — contact support." },
      { status: 500 }
    );
  }

  const id = newId();
  await db
    .insert(kycDocuments)
    .values({ id, userId: session.user.id, filename: safeName, blobPath: blob.pathname, status: "PENDING" });
  await db.update(users).set({ kycStatus: "PENDING" }).where(eq(users.id, session.user.id));

  return NextResponse.json({ id, filename: safeName, status: "PENDING" });
}
