import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { OnboardingOverlay } from "@/components/onboarding-overlay";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LexiLearn — Local English Learning",
  description: "A lightning-fast, 100% private, distraction-free English learning app with SM-2 spaced repetition, browser TTS, and offline-first local storage.",
  keywords: ["LexiLearn", "vocabulary", "spelling", "SRS", "TOEFL", "IELTS", "GRE", "spaced repetition"],
  authors: [{ name: "LexiLearn" }],
  icons: {
    icon: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <OnboardingOverlay />
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
