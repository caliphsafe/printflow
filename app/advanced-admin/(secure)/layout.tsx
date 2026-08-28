import AdvancedAdminShell from "@/components/AdvancedAdminShell";
import { getAdvancedAdminContext } from "@/lib/advanced-admin";

export default async function SecureAdvancedAdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getAdvancedAdminContext();
  return <AdvancedAdminShell userEmail={user.email || ""}>{children}</AdvancedAdminShell>;
}
