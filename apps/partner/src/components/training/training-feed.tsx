"use client";

import { registerAction } from "@/app/(dashboard)/training/actions";
import {
  CERTIFICATE_STANDING_LABELS,
  TRAINING_DELIVERY_MODE_LABELS,
  TRAINING_REGISTRATION_STATUS_LABELS,
} from "@/db/label";
import {
  Award,
  BadgeCheck,
  CalendarDays,
  CircleAlert,
  Clock,
  GraduationCap,
} from "lucide-react";
import { useState, useTransition } from "react";
import type { CertificateRow, RegistrationRow, SessionRow } from "services";

// P14 / P15. What a partner can learn, and what it unlocks.
//
// EVERY UPCOMING COURSE SAYS WHAT PASSING IT GRANTS. That is the whole reason a
// partner opens this screen: a webinar with no consequence is a webinar nobody
// attends. And it says PASSING, not attending, because a certificate on attendance
// alone is worth nothing to the customer whose fire system they go on to install —
// and a partner who found that out on the day would rightly be annoyed.
//
// The certificate list shows the DERIVED standing, worked out from today's date. A
// certificate that lapsed last month still reads `verified` in the database, and
// showing that column would tell a partner they hold a capability they have lost.

type TrainingFeedProps = {
  sessions: SessionRow[];
  registrations: RegistrationRow[];
  certificates: CertificateRow[];
};

const TONE: Record<string, string> = {
  valid: "border-emerald-200 bg-emerald-50 text-emerald-900",
  unverified: "border-amber-200 bg-amber-50 text-amber-900",
  expired: "border-red-200 bg-red-50 text-red-800",
  revoked: "border-hairline bg-hover text-muted",
};

export const TrainingFeed = ({
  sessions,
  registrations,
  certificates,
}: TrainingFeedProps) => {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const registeredSessions = new Set(
    registrations.map((registration) => registration.sessionUuid),
  );

  const register = (sessionUuid: string): void => {
    setError(undefined);
    startTransition(async () => {
      const result = await registerAction(sessionUuid);
      if (result.error) {
        setError(result.error);
      }
    });
  };

  return (
    <div className="flex flex-col gap-7">
      {error && (
        <p className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <section className="flex flex-col gap-2">
        <div>
          <h2 className="font-heading flex items-center gap-2 text-lg">
            <BadgeCheck size={17} className="text-primary" />
            Your certifications
          </h2>
          <p className="text-xs text-muted">
            What you are certified for, and until when.
          </p>
        </div>

        {certificates.length === 0 ? (
          <p className="rounded-card border border-dashed border-hairline px-4 py-8 text-center text-sm text-faint">
            None yet. Passing a course below is how you earn one.
          </p>
        ) : (
          certificates.map((certificate) => (
            <div
              key={certificate.uuid}
              className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-hairline bg-surface px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">
                  {certificate.capability.replace(/_/g, " ")}
                </p>
                <p className="text-[11px] text-muted">
                  {certificate.reference} · issued {certificate.issuedOn} by{" "}
                  {certificate.issuedByName ?? "SOT"}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                    TONE[certificate.state.standing]
                  }`}
                >
                  {CERTIFICATE_STANDING_LABELS[certificate.state.standing]}
                </span>
                {/* The sentence, not just the badge. "Lapsed" tells a partner what
                    happened; the reason tells them what to do. */}
                <span className="text-[11px] text-muted">
                  {certificate.state.reason}
                </span>
              </div>
            </div>
          ))
        )}

        {certificates.some((certificate) => certificate.state.lapsingSoon) && (
          <p className="flex items-start gap-1.5 rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <CircleAlert size={12} className="mt-0.5 shrink-0" />
            One of your certifications lapses soon. Book a course before it does —
            the capability stops working on the day it expires, not when we get
            round to telling you.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div>
          <h2 className="font-heading flex items-center gap-2 text-lg">
            <CalendarDays size={17} className="text-primary" />
            Coming up
          </h2>
          <p className="text-xs text-muted">
            Each course says what passing it unlocks. Attending is not enough — there
            is an assessment.
          </p>
        </div>

        {sessions.length === 0 ? (
          <p className="rounded-card border border-dashed border-hairline px-4 py-8 text-center text-sm text-faint">
            Nothing scheduled at the moment.
          </p>
        ) : (
          sessions.map((session) => {
            const full = session.placesLeft === 0;
            const already = registeredSessions.has(session.uuid);

            return (
              <div
                key={session.uuid}
                className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-hairline bg-surface px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">
                    {session.courseTitle}
                  </p>
                  <p className="text-[11px] text-muted">
                    {session.brandName ?? "SOT"} ·{" "}
                    {TRAINING_DELIVERY_MODE_LABELS[session.mode]}
                    {session.heldOn && ` · ${session.heldOn}`}
                    {session.timing && ` · ${session.timing}`}
                    {/* No limit and no places left must not read the same. */}
                    {session.placesLeft !== null &&
                      ` · ${session.placesLeft} places left`}
                  </p>
                  {session.unlocksCapability ? (
                    <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-emerald-800">
                      <Award size={11} />
                      Pass at {session.passMark}% and this unlocks{" "}
                      {session.unlocksCapability.replace(/_/g, " ")}
                    </p>
                  ) : (
                    <p className="mt-1 text-[11px] text-faint">
                      No capability attached — worth attending for its own sake.
                    </p>
                  )}
                </div>

                {already ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] text-secondary">
                    <Clock size={11} />
                    You are registered
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => register(session.uuid)}
                    disabled={pending || full}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-control bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
                  >
                    <GraduationCap size={13} />
                    {full ? "Full" : "Register"}
                  </button>
                )}
              </div>
            );
          })
        )}
      </section>

      {registrations.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-lg">Your courses</h2>
          {registrations.map((registration) => (
            <div
              key={registration.uuid}
              className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-hairline px-4 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm text-ink">{registration.courseTitle}</p>
                <p className="text-[11px] text-muted">
                  {registration.heldOn ?? "self-paced"}
                  {registration.assessmentScore !== null &&
                    ` · scored ${registration.assessmentScore}% against a ${registration.passMark}% pass mark`}
                </p>
              </div>
              <span className="shrink-0 text-[11px] text-secondary">
                {TRAINING_REGISTRATION_STATUS_LABELS[registration.status]}
              </span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
};
