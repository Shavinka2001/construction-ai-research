"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { DashboardSidebar } from "@/components/layout/dashboard/DashboardSidebar";
import { DashboardNavbar } from "@/components/layout/dashboard/DashboardNavbar";
import { ArchitectWorkspaceProvider } from "@/contexts/ArchitectWorkspaceContext";
import { getAuthSession, type AuthUser } from "@/lib/auth";
import { AUTH_STORAGE_KEY } from "@/lib/session-guard";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let hadStoredSession = false;
    try {
      hadStoredSession = !!localStorage.getItem(AUTH_STORAGE_KEY);
    } catch {
      /* storage disabled */
    }
    const session = getAuthSession();
    if (!session?.token) {
      // getAuthSession() drops an expired token — tell the user why.
      router.replace(hadStoredSession ? "/login?session=expired" : "/login");
      return;
    }
    setUser(session);
    setReady(true);
  }, [router]);

  if (!ready || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-gold" aria-label="Loading" />
      </div>
    );
  }

  return (
    <ArchitectWorkspaceProvider token={user.token}>
      <div className="min-h-screen bg-slate-50">
        <DashboardSidebar
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
          user={user}
        />

        <DashboardNavbar
          onMenuOpen={() => setMobileMenuOpen(true)}
          user={user}
        />

        <main className="min-h-screen w-full bg-slate-50 pt-16 pl-0 lg:pl-64">
          <div className="w-full px-4 py-6 sm:px-8 sm:py-8">{children}</div>
        </main>
      </div>
    </ArchitectWorkspaceProvider>
  );
}
