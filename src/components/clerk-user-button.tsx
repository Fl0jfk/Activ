"use client";

import { UserButton } from "@clerk/nextjs";

function SpaceIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="size-4"
      aria-hidden
    >
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z" />
    </svg>
  );
}

export default function ClerkUserButton() {
  return (
    <UserButton
      appearance={{
        elements: {
          userButtonPopoverCard: "font-sans",
        },
      }}
    >
      <UserButton.MenuItems>
        <UserButton.Link label="Mon espace" labelIcon={<SpaceIcon />} href="/espace" />
      </UserButton.MenuItems>
    </UserButton>
  );
}
