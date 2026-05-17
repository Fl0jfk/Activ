"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { clerkLocalizationFr } from "@/lib/clerk-localization";

type AppClerkProviderProps = {
  children: React.ReactNode;
};

export default function AppClerkProvider({ children }: AppClerkProviderProps) {
  return (
    <ClerkProvider
      localization={clerkLocalizationFr}
      signInFallbackRedirectUrl="/espace"
      signUpFallbackRedirectUrl="/espace"
      signInForceRedirectUrl="/espace"
      signUpForceRedirectUrl="/espace"
      afterSignOutUrl="/"
    >
      {children}
    </ClerkProvider>
  );
}
