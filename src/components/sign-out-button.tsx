"use client";

import type { ReactNode } from "react";
import { useClerk } from "@clerk/nextjs";

type SignOutButtonProps = {
  className?: string;
  children?: ReactNode;
};

/** Déconnexion puis retour à l'accueil. */
export default function SignOutButton({ className = "btn btn-ghost", children = "Me déconnecter" }: SignOutButtonProps) {
  const { signOut } = useClerk();
  return (
    <button type="button" onClick={() => void signOut({ redirectUrl: "/" })} className={className}>
      {children}
    </button>
  );
}
