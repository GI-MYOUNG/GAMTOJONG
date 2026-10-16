import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "감토정 공식몰 | 오늘의 식탁에, 오래된 정성",
  description: "경북 영주의 정성을 담은 감토정. 고추장과 된장을 만나고, 나만의 식탁을 준비하세요.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
