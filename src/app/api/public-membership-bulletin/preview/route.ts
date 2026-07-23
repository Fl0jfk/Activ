import { NextRequest, NextResponse } from "next/server";
import type { MembershipBulletinFormPayload } from "@/lib/membership-bulletin";
import { validateMembershipBulletinPayload } from "@/lib/membership-bulletin";
import { buildMembershipBulletinPdf } from "@/lib/membership-bulletin-pdf";

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as MembershipBulletinFormPayload;
    const validation = validateMembershipBulletinPayload(payload, { requirePassword: false });
    if (!validation.ok) {
      return NextResponse.json({ message: validation.message }, { status: 400 });
    }

    const pdfBytes = await buildMembershipBulletinPdf(payload);
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="bulletin-adhesion-apercu.pdf"',
      },
    });
  } catch (error) {
    console.error("Failed to preview membership bulletin", error);
    return NextResponse.json(
      { message: "Impossible de générer l'aperçu du bulletin." },
      { status: 500 },
    );
  }
}
