import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { AuthProvider } from "@/hooks/use-auth";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "XAI Governance Platform",
  description: "AI Model Trust & Explainability Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <AuthProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <DashboardLayout>{children}</DashboardLayout>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
