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
          {children}
        </div>
      </div>
    </DemoExperience>
  );
}
