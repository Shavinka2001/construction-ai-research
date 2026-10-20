"use client";

import { useState } from "react";
import { AuthoritySidebar } from "@/components/layout/authority/AuthoritySidebar";
import { AuthorityHeader } from "@/components/layout/authority/AuthorityHeader";
import { AuthorityPageTransition } from "@/components/layout/authority/AuthorityPageTransition";
import { ComplianceWorkflowProvider } from "@/contexts/ComplianceWorkflowContext";
import type { AuthUser } from "@/lib/auth";

type AuthorityShellProps = {
  user: AuthUser;
  children: React.ReactNode;
  headerTitle?: string;
  headerSubtitle?: string;
};

export function AuthorityShell({
  user,
  children,
  headerTitle,
  headerSubtitle,
}: AuthorityShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <ComplianceWorkflowProvider>
      <div className="min-h-screen bg-slate-50">
        <AuthoritySidebar
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
          user={user}
        />

        <AuthorityHeader
          onMenuOpen={() => setMobileMenuOpen(true)}
          user={user}
          title={headerTitle}
          subtitle={headerSubtitle}
        />

        <main className="min-h-screen w-full bg-slate-50 pt-16 pl-0 lg:pl-64">
          <div className="w-full px-4 py-6 sm:px-8 sm:py-8">
            <AuthorityPageTransition>{children}</AuthorityPageTransition>
          </div>
        </main>
      </div>
    </ComplianceWorkflowProvider>
  );
}
