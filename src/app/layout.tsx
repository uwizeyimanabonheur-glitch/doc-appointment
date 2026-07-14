import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chronic Care Scheduler",
  description: "Scheduling & reminders for chronic disease patient care",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/* suppressHydrationWarning: browser extensions (e.g. Grammarly) inject
          attributes like data-gr-ext-installed onto <body> before hydration,
          which would otherwise trigger a hydration mismatch warning. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
