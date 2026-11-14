import Link from "next/link";
import { AppNav } from "@/components/nav";
import { DemoExperience } from "@/components/demo-experience";
export const metadata = { title: "MealWorks · Explore the demo" };
export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DemoExperience>
      <div className="app-shell">
        <div className="app-frame">
          <a className="skip-link" href="#main-content">
            Skip to content
          </a>
          <AppNav demo />
          <div className="demo-notice">
            <div>
              <span className="demo-label">Sample workspace</span>
              <p>Explore freely. Create an account to keep your choices.</p>
            </div>
            <div className="demo-entry-actions">
              <Link href="/login" className="text-action">
                Sign in
              </Link>
              <Link href="/register" className="btn btn-primary">
                Create account
              </Link>
            </div>
          </div>
          {children}
        </div>
      </div>
    </DemoExperience>
  );
}
