
import "./globals.css";
import { DM_Sans, Lora } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
} from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import Header from "@/components/header";
import { Toaster } from "sonner";
import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";

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
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${lora.variable} ${dmSans.variable} h-full antialiased`}
      >
        <ClerkProvider
          appearance={{
            theme: dark,
          }}
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <Suspense fallback={<div className="h-16" />}>
              <Header />
            </Suspense>

            <main className="min-h-screen">
              {children}
            </main>

            <Toaster richColors />

            {/* FOOTER */}
            <footer className="relative overflow-hidden border-t border-white/10 bg-[#090909] text-stone-400">

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
                        priority
                      />
                    </Link>

                    <p className="mt-5 max-w-xs text-sm leading-7 text-stone-400">
                      Prepare with purpose. Practice with confidence.
                      Take your interview preparation to the next level.
                    </p>

                    {/* <span className="mt-6 inline-block text-[10px] font-semibold uppercase tracking-[0.3em] text-[#D6B46A]">
                      Dark Edition
                    </span> */}

                  </div>

                  {/* PLATFORM */}
                  <div>
                    <h3 className="mb-6 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                      Platform
                    </h3>

                    <ul className="space-y-4 text-sm">
                      <li>
                        <Link
                          href="/"
                          className="transition-colors hover:text-[#D6B46A]"
                        >
                          Home
                        </Link>
                      </li>

                      <li>
                        <Link
                          href="/explore"
                          className="transition-colors hover:text-[#D6B46A]"
                        >
                          Explore
                        </Link>
                      </li>

                      <li>
                        <Link
                          href="/appointments"
                          className="transition-colors hover:text-[#D6B46A]"
                        >
                          Appointments
                        </Link>
                      </li>
                    </ul>
                  </div>

                  {/* FOR EVERYONE */}
                  <div>
                    <h3 className="mb-6 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                      For Everyone
                    </h3>

                    <ul className="space-y-4 text-sm">
                      <li>
                        <Link
                          href="/explore"
                          className="transition-colors hover:text-[#D6B46A]"
                        >
                          Find Interviews
                        </Link>
                      </li>

                      <li>
                        <Link
                          href="/appointments"
                          className="transition-colors hover:text-[#D6B46A]"
                        >
                          Track Progress
                        </Link>
                      </li>
                    </ul>
                  </div>

                  {/* ACCOUNT */}
                  <div>
                    <h3 className="mb-6 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                      Account
                    </h3>

                    <ul className="space-y-4 text-sm">
                      <li>
                        <SignInButton mode="modal">
                          <button className="transition-colors hover:text-[#D6B46A]">
                            Sign In
                          </button>
                        </SignInButton>
                      </li>

                      <li>
                        <SignUpButton mode="modal">
                          <button className="transition-colors hover:text-[#D6B46A]">
                            Get Started
                          </button>
                        </SignUpButton>
                      </li>
                    </ul>
                  </div>

                </div>

                {/* BOTTOM BAR */}
                <div className="mt-14 border-t border-white/10 pt-7">
                  <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">

                    <p className="text-xs text-stone-500">
                      © 2026 Prept. All rights reserved.
                    </p>

                    <p className="text-xs tracking-wide text-stone-500">
                      Made with <span className="text-[#D6B46A]">♥</span> for better interviews.
                    </p>

                  </div>
                </div>

              </div>
            </footer>

          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
