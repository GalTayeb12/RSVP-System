import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "אישורי הגעה",
  description: "מערכת לניהול מוזמנים ואישורי הגעה לאירועים",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
