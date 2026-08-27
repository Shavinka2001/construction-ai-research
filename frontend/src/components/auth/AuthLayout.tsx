import { AuthBrandingPanel } from "@/components/auth/AuthBrandingPanel";

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <AuthBrandingPanel />
      <div className="flex w-full flex-col bg-slate-50 lg:w-1/2">
        <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>
    </div>
  );
}
