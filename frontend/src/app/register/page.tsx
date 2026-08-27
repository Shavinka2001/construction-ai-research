"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Mail,
  Lock,
  User,
  Phone,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthMobileBrand } from "@/components/auth/AuthBrandingPanel";
import { FloatingInput } from "@/components/auth/FloatingInput";
import { AuthAlert } from "@/components/auth/AuthAlert";
import { ApiRequestError } from "@/lib/api";
import { registerUser } from "@/lib/auth";

function validateEmail(email: string): string | undefined {
  if (!email.trim()) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return "Enter a valid email address";
  return undefined;
}

function validateFullName(name: string): string | undefined {
  if (!name.trim()) return "Full name is required";
  if (name.trim().length < 2) return "Name must be at least 2 characters";
  return undefined;
}

function validatePassword(password: string): string | undefined {
  if (!password) return "Password is required";
  if (password.length < 8) return "Password must be at least 8 characters";
  return undefined;
}

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const errors: Record<string, string> = {};
    const nameErr = validateFullName(fullName);
    const emailErr = validateEmail(email);
    const passwordErr = validatePassword(password);

    if (nameErr) errors.fullName = nameErr;
    if (emailErr) errors.email = emailErr;
    if (passwordErr) errors.password = passwordErr;

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setLoading(true);

    try {
      await registerUser({
        email: email.trim(),
        full_name: fullName.trim(),
        password,
        role: "CLIENT",
        contact_number: contactNumber.trim() || null,
      });
      router.push("/login?registered=true");
    } catch (err) {
      if (err instanceof ApiRequestError) {
        const apiFieldErrors: Record<string, string> = {};
        err.errors.forEach((e) => {
          if (e.field) apiFieldErrors[e.field] = e.message;
        });
        if (Object.keys(apiFieldErrors).length > 0) {
          setFieldErrors((prev) => ({ ...prev, ...apiFieldErrors }));
        }
        const details = err.errors.map((e) => e.message).join(". ");
        setError(details || err.message);
      } else {
        setError("Unable to connect to the server. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <AuthMobileBrand />

      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-luxury sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Create your account
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Register as a client to begin your pre-construction feasibility
          analysis
        </p>

        {error && (
          <div className="mt-6">
            <AuthAlert message={error} onDismiss={() => setError(null)} />
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
          <FloatingInput
            id="fullName"
            label="Full name"
            type="text"
            value={fullName}
            onChange={setFullName}
            autoComplete="name"
            placeholder="Jane Doe"
            icon={<User className="h-4 w-4" />}
            error={fieldErrors.fullName}
          />

          <FloatingInput
            id="email"
            label="Email address"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            placeholder="you@example.com"
            icon={<Mail className="h-4 w-4" />}
            error={fieldErrors.email}
          />

          <FloatingInput
            id="contactNumber"
            label="Contact number"
            type="tel"
            value={contactNumber}
            onChange={setContactNumber}
            autoComplete="tel"
            placeholder="+94 77 123 4567"
            icon={<Phone className="h-4 w-4" />}
            error={fieldErrors.contact_number}
          />

          <FloatingInput
            id="password"
            label="Password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            placeholder="Minimum 8 characters"
            icon={<Lock className="h-4 w-4" />}
            error={fieldErrors.password}
            trailing={
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="flex min-h-touch min-w-touch items-center justify-center rounded-lg text-slate-400 transition-colors hover:text-gold"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            }
          />

          <button
            type="submit"
            disabled={loading}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border-2 border-transparent bg-brand-primary text-sm font-semibold text-white transition-all duration-300 hover:border-gold hover:shadow-[0_0_0_1px_#D4AF37,0_4px_20px_-4px_rgba(212,175,55,0.35)] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Creating account…
              </>
            ) : (
              <>
                Create Account
                <ArrowRight className="h-4 w-4 text-gold" aria-hidden />
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-gold transition-colors hover:text-gold-dark"
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
