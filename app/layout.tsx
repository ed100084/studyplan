import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StudyPlan | 阿蓮國中讀書規劃",
  description: "給阿蓮國中學生、家長與班級管理者使用的讀書規劃網站。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}

