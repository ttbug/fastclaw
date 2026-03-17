import { SidebarLayout } from "@/components/sidebar";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <SidebarLayout>{children}</SidebarLayout>;
}
