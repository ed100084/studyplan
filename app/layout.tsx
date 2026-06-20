import type { Metadata } from "next";
import { Suspense } from "react";
import { FormSubmitGuard } from "@/app/components/form-submit-guard";
import { NavigationFeedback } from "@/app/components/navigation-feedback";
import { TimeZoneSync } from "./timezone-sync";
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
    <html lang="zh-TW">
      <body>
        <TimeZoneSync />
        <FormSubmitGuard />
        <Suspense fallback={null}>
          <NavigationFeedback />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
