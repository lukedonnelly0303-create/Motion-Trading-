import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { accounts, users } from "@/db/schema";

// Certificate PDFs are generated on demand rather than stored — they're
// cheap to build and this way they always reflect the account's current
// state (no stale file to keep in sync, no storage to manage).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [account] = await db.select().from(accounts).where(eq(accounts.id, params.id)).limit(1);
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (account.userId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (account.status !== "PASSED" && account.status !== "FUNDED") {
    return NextResponse.json({ error: "Certificate is available once this account has passed" }, { status: 409 });
  }

  const [trader] = await db.select().from(users).where(eq(users.id, account.userId)).limit(1);
  const traderName = trader?.name || trader?.email || "Trader";

  const evaluationLabel = account.evaluationType === "ONE_STEP" ? "1-Step Evaluation" : "2-Step Evaluation";
  // Only append a phase qualifier when it adds information — a 1-Step
  // evaluation has no sub-phases, so "1-Step Evaluation — Evaluation"
  // would just be redundant.
  const phaseQualifier =
    account.status === "FUNDED"
      ? "Funded Account"
      : account.evaluationType === "TWO_STEP" && account.phase === "PHASE_2"
      ? "Phase 2 (Verification)"
      : account.evaluationType === "TWO_STEP"
      ? "Phase 1"
      : null;
  const achievementLine = phaseQualifier
    ? `has successfully completed the ${evaluationLabel} — ${phaseQualifier}`
    : `has successfully completed the ${evaluationLabel}`;
  const certId = `MT-${account.id.slice(0, 8).toUpperCase()}`;
  const issuedOn = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([842, 595]); // A4 landscape
  const { width, height } = page.getSize();

  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);

  const ink = rgb(0.09, 0.11, 0.15);
  const inkDim = rgb(0.42, 0.45, 0.5);
  const gold = rgb(0.62, 0.5, 0.24);

  // Border
  page.drawRectangle({
    x: 24,
    y: 24,
    width: width - 48,
    height: height - 48,
    borderColor: gold,
    borderWidth: 1.5,
  });
  page.drawRectangle({
    x: 34,
    y: 34,
    width: width - 68,
    height: height - 68,
    borderColor: gold,
    borderWidth: 0.5,
  });

  const centerText = (text: string, y: number, font = regular, size = 12, color = ink) => {
    const textWidth = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (width - textWidth) / 2, y, font, size, color });
  };

  centerText("MOTION TRADING", height - 100, bold, 22, ink);
  centerText("Certificate of Achievement", height - 130, regular, 13, gold);

  centerText("This certifies that", height - 200, regular, 12, inkDim);
  centerText(traderName, height - 235, bold, 26, ink);
  centerText(achievementLine, height - 270, regular, 13, inkDim);
  centerText(`Account size: $${(account.accountSize / 1000).toFixed(0)}K`, height - 300, regular, 13, inkDim);

  centerText(`Issued ${issuedOn}`, 110, regular, 10.5, inkDim);
  centerText(`Certificate ID: ${certId}`, 92, regular, 10.5, inkDim);
  centerText(
    "This certificate reflects a simulated evaluation account and is not a record of live trading performance.",
    68,
    regular,
    8.5,
    inkDim
  );

  const bytes = await pdf.save();

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="motion-trading-certificate-${certId}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
