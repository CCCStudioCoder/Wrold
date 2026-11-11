import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import {Suspense} from "react";
import {Loading} from "@/app/util/components";
import {validateSession} from "@/app/util/session";

export const metadata: Metadata = {
  title: "Wrold app",
  description: "Translate your app in 5 minutes.",
  creator: "CCC Studio"
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full" suppressHydrationWarning>
        <nav className="fixed">
            <Link href="/">Wrold</Link>
            <ul>
                <Link href="/docs">Docs</Link>
                <Suspense fallback={<Loading height={500} width={500} />}>
                    <DashboardOrLogin />
                </Suspense>
            </ul>
        </nav>
        <div>{children}</div>
      </body>
    </html>
  );

  async function DashboardOrLogin() {
    const [_, sessionValid] = await validateSession();

    return sessionValid
      ? <Link href="dashboard" className="button-strong">Dashboard</Link>
      : (
          <>
            <Link href="auth/login" className="button-weak">Login</Link>
            <Link href="auth/signin" className="button-strong">Sign in</Link>
          </>
        )
  }
}
