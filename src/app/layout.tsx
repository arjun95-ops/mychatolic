import type { Metadata } from "next";
import { JetBrains_Mono, Outfit } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/components/auth-provider";
import { PostComposer } from "@/components/feed/post-composer";
import { NotificationPanel } from "@/components/notifications/notification-panel";
import { SearchPanel } from "@/components/search/search-panel";
import { StoryViewerOverlay } from "@/components/stories/story-viewer-overlay";
import { ReactQueryProvider } from "@/components/react-query-provider";
import { ThemeModeFab } from "@/components/theme-mode-fab";

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MyCatholic - Platform Sosial untuk Komunitas Katolik",
  description: "Platform sosial networking untuk komunitas Katolik Indonesia. Terhubung dengan sesama umat, ikut jadwal misa, dan baca Alkitab bersama.",
  keywords: ["MyCatholic", "Katolik", "Umat", "Misa", "Alkitab", "Social Network", "Komunitas"],
  authors: [{ name: "MyCatholic Team" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "MyCatholic",
    description: "Platform sosial untuk komunitas Katolik",
    url: "https://mychatolic.com",
    siteName: "MyCatholic",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MyCatholic",
    description: "Platform sosial untuk komunitas Katolik",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className={`${outfit.variable} ${jetBrainsMono.variable} antialiased bg-background text-foreground font-sans`}
      >
        <ThemeProvider
          attribute="data-theme"
          themes={['light', 'dark']}
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <ReactQueryProvider>
            <AuthProvider>
              {children}
              <ThemeModeFab />
              <PostComposer />
              <NotificationPanel />
              <SearchPanel />
              <StoryViewerOverlay />
              <Toaster />
              <SonnerToaster richColors closeButton position="top-right" />
            </AuthProvider>
          </ReactQueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
