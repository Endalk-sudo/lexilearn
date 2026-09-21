import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { OnboardingV2 } from "@/features/onboarding/components/onboarding-v2";
import { ServiceWorkerRegistrar, OfflineBanner } from "@/components/pwa";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "LexiLearn — Local English Learning",
    template: "%s · LexiLearn",
  },
  description:
    "A calm, private, offline-first English vocabulary app with SM-2 spaced repetition, browser pronunciation and zero telemetry.",
  applicationName: "LexiLearn",
  keywords: ["LexiLearn", "vocabulary", "spelling", "SRS", "TOEFL", "IELTS", "GRE", "spaced repetition"],
  authors: [{ name: "LexiLearn" }],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/logo.png", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "LexiLearn — Local English Learning",
    description:
      "Spaced repetition, pronunciation and quizzes. 100% local, no account, no telemetry.",
    type: "website",
    siteName: "LexiLearn",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfcfe" },
    { media: "(prefers-color-scheme: dark)", color: "#16181d" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} grain font-sans antialiased`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <OfflineBanner />
          {children}
          <OnboardingV2 />
          <Toaster
            position="bottom-right"
            mobileOffset={{ bottom: 96, right: 16 }}
            toastOptions={{ duration: 3200 }}
          />
          <ServiceWorkerRegistrar />
        </ThemeProvider>
      </body>
    </html>
  );
}
