
import { Suspense } from "react";
import { Show, SignInButton,SignUpButton, UserButton } from "@clerk/nextjs";
import { Button } from "./ui/button";
import Link from "next/link";
import Image from "next/image";

export default function Header() {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-3 sm:px-10 py-3 border-b border-white/7 backdrop-blur-xl">
      
      {/* LOGO */}
        <Link href="/">
          <Image src="/logo.png" alt="Logo" width={100} height={100} className = "h-11 w-auto" />
        </Link>

    {/*  REDIRECTION LOGIC */}



    {/* SIGN IN */}

      <Suspense fallback={null}>
        <div className="flex items-center gap-3">
          <Show when="signed-out">

            {/* LINKS */}



            {/* CREDITS */}

            <SignInButton >
              <Button variant="ghost">Sign in</Button>
            </SignInButton>

            <SignUpButton >
              <Button variant="gold">Get started →</Button>
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
