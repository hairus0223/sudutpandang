import "./globals.css";
import { ToastProvider } from "@/components/ui/ToastProvider";

export const metadata = {
  title: "Studio Self Photo",
  description: "Local Kiosk Gallery",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className="bg-black text-white antialiased"
        suppressHydrationWarning
      >
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
