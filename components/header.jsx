
import { Suspense } from "react";
import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";

import { Button } from "./ui/button";
import Link from "next/link";
import Image from "next/image";
import { checkUser } from "@/lib/checkUser";

export default async function Header() {
  const user = await checkUser();

  return (
    <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-3 sm:px-10 py-3 border-b border-white/7 backdrop-blur-xl">

      {/* LOGO */}
      <Link href="/">
        <Image
          src="/logo.png"
          alt="Logo"
          width={100}
          height={100}
          className="h-11 w-auto"
        />
      </Link>

      {/* AUTHENTICATION */}
      <Suspense fallback={<div className="h-9 w-24" />}>
        <div className="flex items-center gap-3">
          <Show when="signed-out">
            <SignInButton>
              <Button variant="ghost">
                Sign in
              </Button>
            </SignInButton>

            <SignUpButton>
              <Button variant="gold">
                Get started →
              </Button>
            </SignUpButton>
          </Show>

          <Show when="signed-in">
            <UserButton />
          </Show>
        </div>
      </Suspense>
    </nav>
  );
}
