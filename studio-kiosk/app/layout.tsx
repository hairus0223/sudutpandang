import "./globals.css";

export const metadata = {
  title: "Studio Self Photo",
  description: "Local Kiosk Gallery",
  viewport: "width=device-width, initial-scale=1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="bg-black text-white antialiased">
        {children}
      </body>
    </html>
  );
}
