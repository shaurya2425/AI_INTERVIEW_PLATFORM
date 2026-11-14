import arcjet, { detectBot, shield } from "@arcjet/next";
import { clerkMiddleware } from "@clerk/nextjs/server";
import { arcjetDevelopmentLogger } from "@/lib/arcjet-logger";
import { NextResponse } from "next/server";

const aj = arcjet({
  key: process.env.ARCJET_KEY,
  log: arcjetDevelopmentLogger,
  rules: [
    shield({ mode: "LIVE" }),
    detectBot({
      mode: "LIVE",
      allow: ["CATEGORY:SEARCH_ENGINE", "CATEGORY:PREVIEW"],
    }),
  ],
});

export default clerkMiddleware(async (_auth, req) => {
  const pathname = req.nextUrl.pathname;
  const isWebhookRoute = pathname === "/api/webhooks/stream" ||
    pathname.startsWith("/api/webhooks/stream/");

  // This machine endpoint validates its own scheduler secret in the route.
  const isReminderJob = pathname === "/api/cron/interview-reminders";
  if(!isWebhookRoute && !isReminderJob){
    const decision = await aj.protect(req);

    if(decision.isDenied()){
      return NextResponse.json({error:"Forbidden"},{status:403});
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for Clerk's auto-proxy path
    "/__clerk/:path*",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
