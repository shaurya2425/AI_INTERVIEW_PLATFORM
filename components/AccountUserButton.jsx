"use client";

import dynamic from "next/dynamic";

// Clerk's browser widget can be ready before streamed server HTML hydrates.
// Mount it only on the client and reserve its space while it loads.
const UserButton = dynamic(
  () => import("@clerk/nextjs").then((module) => module.UserButton),
  {
    ssr: false,
    loading: () => <span className="block size-7" aria-hidden="true" />,
  }
);

export default function AccountUserButton() {
  return <UserButton />;
}
