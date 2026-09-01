"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Clock,
  FileStack,
  Mail,
  MapPin,
  MessageSquare,
  Navigation,
  Phone,
  Timer,
  User,
} from "lucide-react";
import { useWorkflowAuthority } from "@/contexts/ComplianceWorkflowContext";
import { resolveAuthorityProfile } from "@/lib/compliance-workflow-data";
import AuthorityLocatorMap from "./AuthorityLocatorMap";
import { cn } from "@/lib/utils";

const panelVariants = {
  hidden: { opacity: 0, x: 32 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: "spring", stiffness: 320, damping: 32, delay: 0.05 },
  },
};

const mapVariants = {
  hidden: { opacity: 0, x: -32 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: "spring", stiffness: 320, damping: 32 },
  },
};

function formatPhoneForTel(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

export function AuthorityLocator() {
  const { pin, zone, activeRoadmapStep: activeStep } = useWorkflowAuthority();

  const profile = useMemo(() => {
    if (!activeStep) return null;
    return resolveAuthorityProfile(activeStep.authority, { pin, zone });
  }, [activeStep, pin, zone]);

  const directionsUrl = profile
    ? `https://www.google.com/maps/dir/?api=1&destination=${profile.lat},${profile.lon}`
    : "#";

  if (!activeStep || !profile) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
        Complete Steps 1–3 and select a roadmap phase in Step 2 to locate the
        assigned authority office.
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeStep.id}
        initial="hidden"
        animate="visible"
        exit="hidden"
        className="grid gap-6 lg:grid-cols-2"
      >
        {/* Left — authority map */}
        <motion.div
          variants={mapVariants}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Authority Locator
            </p>
            <p className="text-sm font-semibold text-slate-900">
              {profile.displayName}
            </p>
          </div>
          <AuthorityLocatorMap
            authority={{
              lat: profile.lat,
              lon: profile.lon,
              label: profile.displayName,
            }}
          />
        </motion.div>

        {/* Right — assigned authority card */}
        <motion.div
          variants={panelVariants}
          className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="border-b border-slate-100 bg-gradient-to-r from-slate-900 to-slate-800 px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-300">
              Assigned Authority
            </p>
            <h3 className="mt-1 text-lg font-bold text-white">
              {profile.displayName}
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Phase {activeStep.phase} · {activeStep.title}
            </p>
          </div>

          <div className="flex flex-1 flex-col p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                <User className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">
                  {profile.officerName}
                </p>
                <p className="text-xs font-medium text-blue-700">
                  {profile.role}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <FileStack className="h-3 w-3" />
                  Active Submissions
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                  {profile.activeSubmissions}
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <Timer className="h-3 w-3" />
                  Avg. Response Time
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                  {profile.avgResponseDays}
                  <span className="text-base font-semibold text-slate-400">
                    {" "}
                    days
                  </span>
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <Building2 className="h-3 w-3" />
                Office Address
              </p>
              <p className="flex items-start gap-2 text-sm leading-relaxed text-slate-700">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                {profile.address}
              </p>
            </div>

            <div className="mt-5">
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <Clock className="h-3 w-3" />
                Working Hours
              </p>
              <div className="overflow-hidden rounded-xl border border-slate-100">
                <table className="w-full text-left text-xs">
                  <tbody>
                    {profile.workingHours.map((row, index) => (
                      <tr
                        key={row.day}
                        className={cn(
                          index % 2 === 0 ? "bg-white" : "bg-slate-50/80",
                          "border-b border-slate-50 last:border-0"
                        )}
                      >
                        <th
                          scope="row"
                          className="px-3 py-2.5 font-semibold text-slate-700"
                        >
                          {row.day}
                        </th>
                        <td className="px-3 py-2.5 text-slate-500">{row.hours}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <ul className="mt-5 space-y-2 text-sm text-slate-600">
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-slate-400" />
                {profile.phone}
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                {profile.email}
              </li>
            </ul>

            <div className="mt-auto flex flex-wrap gap-2 pt-6">
              <motion.a
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
              >
                <Navigation className="h-4 w-4" />
                Get Directions
              </motion.a>
              <motion.a
                href={`tel:${formatPhoneForTel(profile.phone)}`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:border-blue-200 hover:bg-blue-50"
              >
                <Phone className="h-4 w-4 text-blue-700" />
                Call Official
              </motion.a>
              <motion.a
                href={`mailto:${profile.email}?subject=ConstructAI%20Compliance%20Submission`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:border-blue-200 hover:bg-blue-50"
              >
                <MessageSquare className="h-4 w-4 text-blue-700" />
                Message Official
              </motion.a>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
