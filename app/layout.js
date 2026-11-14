
import "./globals.css";
import { DM_Sans, Lora } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import {
  SignInButton,
  SignUpButton,
} from "@clerk/nextjs";
import Header from "@/components/header";
import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

const lora = Lora({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-serif",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-sans",
});

export const metadata = {
  title: "Prept",
  description: "Prepare with purpose. Practice with confidence.",
  icons: {
    icon: { url: "/logo.png", type: "image/png" },
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body
        className={`${lora.variable} ${dmSans.variable} h-full antialiased`}
      >
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <Suspense fallback={<div className="h-16 flex items-center justify-center"><LoadingSpinner label="Loading navigation" /></div>}>
              <Header />
            </Suspense>

            <main className="min-h-screen">
              {children}
            </main>


            {/* FOOTER */}
            <footer className="relative overflow-hidden border-t border-border bg-card text-muted-foreground">

              <div className="mx-auto max-w-7xl px-6 py-14 sm:px-10 lg:py-16">

                <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-4 lg:gap-10">

                  {/* BRAND SECTION */}
                  <div className="lg:col-span-1">

                    <Link href="/" className="inline-flex items-center">
                      <Image
                        src="/logo.png"
                        alt="Prept"
                        width={120}
                        height={48}
                        style={{ width: "auto", height: "48px" }}
                        className="brightness-0 dark:brightness-100"
                        priority
                      />
                    </Link>

                    <p className="mt-5 max-w-xs text-sm leading-7 text-muted-foreground">
                      Prepare with purpose. Practice with confidence.
                      Take your interview preparation to the next level.
                    </p>

                    {/* <span className="mt-6 inline-block text-[10px] font-semibold uppercase tracking-[0.3em] text-brand">
                      Dark Edition
                    </span> */}

                  </div>

                  {/* PLATFORM */}
                  <div>
                    <h3 className="mb-6 text-xs font-semibold uppercase tracking-[0.2em] text-foreground">
                      Platform
                    </h3>

                    <ul className="space-y-4 text-sm">
                      <li>
                        <Link
                          href="/"
                          className="transition-colors hover:text-brand"
                        >
                          Home
                        </Link>
                      </li>

                      <li>
                        <Link
                          href="/explore"
                          className="transition-colors hover:text-brand"
                        >
                          Explore
                        </Link>
                      </li>

                      <li>
                        <Link
                          href="/appointments"
                          className="transition-colors hover:text-brand"
                        >
                          Appointments
                        </Link>
                      </li>
                    </ul>
                  </div>

                  {/* FOR EVERYONE */}
                  <div>
                    <h3 className="mb-6 text-xs font-semibold uppercase tracking-[0.2em] text-foreground">
                      For Everyone
                    </h3>

                    <ul className="space-y-4 text-sm">
                      <li>
                        <Link
                          href="/explore"
                          className="transition-colors hover:text-brand"
                        >
                          Find Interviews
                        </Link>
                      </li>

                      <li>
                        <Link
                          href="/appointments"
                          className="transition-colors hover:text-brand"
                        >
                          Track Progress
                        </Link>
                      </li>
                    </ul>
                  </div>

                  {/* ACCOUNT */}
                  <div>
                    <h3 className="mb-6 text-xs font-semibold uppercase tracking-[0.2em] text-foreground">
                      Account
                    </h3>

                    <ul className="space-y-4 text-sm">
                      <li>
                        <SignInButton mode="modal">
                          <button className="transition-colors hover:text-brand">
                            Sign In
                          </button>
                        </SignInButton>
                      </li>

                      <li>
                        <SignUpButton mode="modal">
                          <button className="transition-colors hover:text-brand">
                            Get Started
                          </button>
                        </SignUpButton>
                      </li>
                    </ul>
                  </div>

                </div>

                {/* BOTTOM BAR */}
                <div className="mt-14 border-t border-border pt-7">
                  <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">

                    <p className="text-xs text-muted-foreground">
                      © 2026 Prept. All rights reserved.
                    </p>

                    <p className="text-xs tracking-wide text-muted-foreground">
                      Made with <span className="text-brand">♥</span> for better interviews.
                    </p>

                  </div>
                </div>

              </div>
            </footer>

          </ThemeProvider>
      </body>
    </html>
  );
}
