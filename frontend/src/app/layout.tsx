import type { Metadata } from "next";
import { Geist } from 'next/font/google';
import "./globals.css";
import AppShell from "../components/AppShell";

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });

export const metadata: Metadata = {
  title: "AbsoluTurf – Premium Sports Turf Matchmaker",
  description: "Automate recurring sports turf match bookings, attendance voting, substitute queues, and payment tracking.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full ${geist.variable}`}>
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
