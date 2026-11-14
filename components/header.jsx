import { Suspense } from "react";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

import { Button } from "./ui/button";
import Link from "next/link";
import Image from "next/image";
import { checkUser } from "@/lib/checkUser";
import { CalendarDays, Users } from "lucide-react";
import CreditButton from "./CreditButton";
import RoleRedirect from "./RoleRedirect";
import ClerkProfileSync from "./ClerkProfileSync";
import ThemeToggle from "./theme-toggle";
import { LoadingSpinner } from "./ui/loading-spinner";

export default async function Header() {
  const user = await checkUser();

  return (
    <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between gap-2 px-3 sm:px-10 py-3 border-b border-border bg-background/80 text-foreground backdrop-blur-xl">
      {/* LOGO */}
      <Link href="/" className="shrink-0" aria-label="Prept home">
        <Image
          src="/logo.png"
          alt="Prept"
          width={100}
          height={100}
          style={{ width: "auto" }}
          className="h-9 sm:h-11 w-auto brightness-0 dark:brightness-100"
        />
      </Link>

      {user && <RoleRedirect role={user.role} />}
      {user && <ClerkProfileSync clerkUserId={user.clerkUserId} name={user.name} imageUrl={user.imageUrl} />}

      {/* AUTHENTICATION */}
      <Suspense fallback={<div className="h-9 w-24 flex items-center justify-center"><LoadingSpinner label="Loading account" /></div>}>
        <div className="flex items-center gap-1 sm:gap-3">
          <ThemeToggle />
          <Show when="signed-out">
            <SignInButton>
              <Button variant="ghost">Sign in</Button>
            </SignInButton>

            <SignUpButton>
              <Button variant="gold">Get started →</Button>
            </SignUpButton>
          </Show>

          <Show when="signed-in">
            {user?.role === "INTERVIEWER" && (
              <Button variant="ghost" asChild>
                <Link href="/dashboard">Dashboard</Link>
              </Button>
            )}

            {user?.role === "INTERVIEWEE" && (
              <>
                <Button variant="ghost" asChild>
                  <Link href="/explore">
                    <Users size={16} />
                    <span className="sr-only md:not-sr-only">Explore</span>
                  </Link>
                </Button>
                <Button variant="default" asChild>
                  <Link href="/appointments">
                    <CalendarDays size={16} />
                    <span className="sr-only md:not-sr-only">My Appointments</span>
                  </Link>
                </Button>
              </>
            )}
            <CreditButton
              role={
                user?.role === "INTERVIEWER" ? "INTERVIEWER" : "INTERVIEWEE"
              }
              credits={
                (user?.role === "INTERVIEWER"
                  ? user?.creditBalance
                  : user?.credits) ?? 0
              }
            />
            <UserButton />
          </Show>
        </div>
      </Suspense>
    </nav>
  );
}
