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
      appearance={{
        variables: {
          colorPrimary: "#1f6fd0",
          colorText: "#1b2430",
          colorBackground: "#ffffff",
          borderRadius: "0.75rem",
          fontFamily: "var(--font-jakarta), 'Segoe UI', sans-serif",
        },
      }}
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
