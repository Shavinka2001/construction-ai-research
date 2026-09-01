"use client";

import { motion } from "framer-motion";
import { Mail, MapPin, MessageSquare, Navigation, Phone, User } from "lucide-react";
import { DynamicLocationPickerMap } from "@/components/land-validation/DynamicLocationPickerMap";
import { useComplianceWorkflow } from "@/contexts/ComplianceWorkflowContext";
import { getAuthorityContact } from "@/lib/compliance-workflow-data";

export function StepAuthorityMapping() {
  const { roadmap, activeRoadmapIndex, pin } = useComplianceWorkflow();

  const activeStep = roadmap[activeRoadmapIndex];
  const contact = activeStep
    ? getAuthorityContact(activeStep.authority)
    : null;

  const mapPin = contact
    ? { lat: contact.lat, lon: contact.lon }
    : pin;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
          Step 4 · Authority Mapping &amp; Routing
        </p>
        <h2 className="mt-1 text-xl font-bold text-slate-900">
          Assigned regulatory officer
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Contact card updates dynamically based on the active roadmap step
          selected in Step 2.
        </p>
      </div>

      {!activeStep || !contact ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
          Complete earlier steps and select a roadmap item to view the assigned
          authority.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <motion.div
            key={activeStep.id}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35 }}
            className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="border-b border-slate-100 bg-slate-900 px-5 py-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-300">
                Active approval gate
              </p>
              <h3 className="mt-1 text-lg font-bold text-white">
                {activeStep.title}
              </h3>
            </div>

            <div className="flex flex-1 flex-col p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                  <User className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {contact.officerName}
                  </p>
                  <p className="text-xs text-blue-700">{contact.role}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {contact.institution}
                  </p>
                </div>
              </div>

              <ul className="mt-5 space-y-3 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  {contact.phone}
                </li>
                <li className="flex items-start gap-2">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  {contact.email}
                </li>
                <li className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  {contact.address}
                </li>
              </ul>

              <div className="mt-auto flex flex-wrap gap-2 pt-6">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
                >
                  <MessageSquare className="h-4 w-4" />
                  Message Officer
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:border-blue-200 hover:bg-blue-50"
                >
                  <Navigation className="h-4 w-4 text-blue-600" />
                  Get Directions
                </button>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: 0.08 }}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="text-xs font-semibold text-slate-700">
                Authority office location
              </p>
            </div>
            <DynamicLocationPickerMap
              value={mapPin}
              readOnly
              pinDraggable={false}
              className="h-[320px] w-full lg:h-full lg:min-h-[360px]"
            />
          </motion.div>
        </div>
      )}
    </div>
  );
}
