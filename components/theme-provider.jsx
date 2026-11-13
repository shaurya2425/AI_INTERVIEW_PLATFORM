"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { Toaster } from "sonner";

function ThemedServices({ children }) {
  const { resolvedTheme } = useTheme();

  return (
    <ClerkProvider appearance={{ theme: resolvedTheme === "dark" ? dark : undefined }}>
      {children}
      <Toaster
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        position="top-center"
        offset={80}
        mobileOffset={{ top: 80, left: 16, right: 16 }}
        duration={6000}
        closeButton
        richColors
      />
    </ClerkProvider>
  );
}

export function ThemeProvider({ children, ...props }) {
  return (
    <NextThemesProvider {...props}>
      <ThemedServices>{children}</ThemedServices>
    </NextThemesProvider>
  );
}
