import type { Metadata } from "next";
import ThankYou from "@/components/inscription/thank-you";
import { NOINDEX_METADATA } from "@/lib/seo";

export const metadata: Metadata = { title: "Merci pour votre pré-inscription", ...NOINDEX_METADATA };

export default function PreinscriptionMerciPage() {
  return <ThankYou />;
}
