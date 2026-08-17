"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function WorkspaceGuard({
  workspace,
  accountMode
}: {
  workspace: "print" | "brand";
  accountMode: "custom" | "brand" | "hybrid";
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname !== "/dashboard") return;
    if (accountMode === "brand" || workspace === "brand") {
      router.replace("/dashboard/brand");
      return;
    }
    if (accountMode === "hybrid" && workspace === "print") {
      router.replace("/dashboard/print");
    }
  }, [pathname, workspace, accountMode, router]);

  return null;
}
