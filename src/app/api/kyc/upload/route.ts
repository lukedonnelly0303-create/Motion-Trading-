import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db, newId } from "@/db";
import { kycDocuments, users } from "@/db/schema";

// Dev-only local storage. Swap for S3 / Supabase Storage / Cloudflare R2
// before deploying — most hosts (Vercel included) don't give you a
// persistent filesystem, and KYC documents need real retention/access
// controls a plain uploads folder doesn't provide.
const UPLOAD_DIR = path.join(process.cwd(), "uploads");

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

  await mkdir(UPLOAD_DIR, { recursive: true });
  const safeName = `${session.user.id}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, safeName), bytes);

  const id = newId();
  await db.insert(kycDocuments).values({ id, userId: session.user.id, filename: safeName, status: "PENDING" });
  await db.update(users).set({ kycStatus: "PENDING" }).where(eq(users.id, session.user.id));

  return NextResponse.json({ id, filename: safeName, status: "PENDING" });
}
