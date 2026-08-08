"use client";

import {
  createSessionAction,
  issueCertificateAction,
  markAttendanceAction,
  recordAssessmentAction,
} from "@/app/(dashboard)/training/action";
import {
  TRAINING_DELIVERY_MODE_LABELS,
  TRAINING_REGISTRATION_STATUS_LABELS,
} from "@/db/label";
import {
  Award,
  CalendarPlus,
  CircleCheck,
  GraduationCap,
  Users,
} from "lucide-react";
import { useState, useTransition } from "react";
import type { CourseRow, RegistrationRow, SessionRow } from "services";
import { Dropdown } from "ui";

// A16. Courses, sessions, and the mark-up sheet.
//
// THE ROW THAT MATTERS IS A PASS WITH NO CERTIFICATE YET. That is the only place
// on this screen where a capability can be created, and it is deliberately two
// clicks from attendance: mark who turned up, record what they scored, and only then
// issue. A single "complete" button would collapse the gate the whole module exists
// to hold — attendance is not achievement.
//
// So a registration shows exactly one action at a time, and the button says which
// step it is.

type TrainingBoardProps = {
  courses: CourseRow[];
  sessions: SessionRow[];
};

type RollProps = {
  session: SessionRow;
  registrations: RegistrationRow[];
  onError: (message: string) => void;
};

const Roll = ({ session, registrations, onError }: RollProps) => {
  const [scores, setScores] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const run = (work: () => Promise<{ error?: string }>): void => {
    startTransition(async () => {
      const result = await work();
      if (result.error) {
        onError(result.error);
      }
    });
  };

  if (registrations.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-xs text-faint">
        Nobody has registered for this session yet.
      </p>
    );
  }

  return (
    <div className="divide-y divide-hairline">
      {registrations.map((registration) => (
        <div
          key={registration.uuid}
          className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5"
        >
          <div className="min-w-0">
            <p className="text-sm text-ink">
              {registration.partnerName ?? "A partner"}
            </p>
            <p className="text-[11px] text-muted">
              {TRAINING_REGISTRATION_STATUS_LABELS[registration.status]}
              {registration.assessmentScore !== null &&
                ` · scored ${registration.assessmentScore}% against a ${registration.passMark}% pass mark`}
              {registration.certificateUuid && " · certificate issued"}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {registration.status === "registered" && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    run(() => markAttendanceAction(registration.uuid, true))
                  }
                  disabled={pending}
                  className="rounded-control border border-hairline px-2.5 py-1.5 text-xs font-medium text-ink hover:border-primary disabled:opacity-60"
                >
                  Attended
                </button>
                <button
                  type="button"
                  onClick={() =>
                    run(() => markAttendanceAction(registration.uuid, false))
                  }
                  disabled={pending}
                  className="rounded-control border border-hairline px-2.5 py-1.5 text-xs text-muted hover:text-ink disabled:opacity-60"
                >
                  No show
                </button>
              </>
            )}

            {/* The assessment. Offered on `attended`, and on a previous fail —
                somebody can sit it again. */}
            {(registration.status === "attended" ||
              registration.status === "failed") &&
              session.hasAssessment === 1 && (
                <>
                  <input
                    value={scores[registration.uuid] ?? ""}
                    onChange={(event) =>
                      setScores((previous) => ({
                        ...previous,
                        [registration.uuid]: event.target.value,
                      }))
                    }
                    inputMode="numeric"
                    placeholder="Score %"
                    className="w-20 rounded-control border border-hairline bg-surface px-2 py-1.5 text-xs text-ink"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      run(() =>
                        recordAssessmentAction(
                          registration.uuid,
                          Number(scores[registration.uuid]),
                          null,
                        ),
                      )
                    }
                    disabled={pending || !scores[registration.uuid]}
                    className="rounded-control bg-primary px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
                  >
                    Record mark
                  </button>
                </>
              )}

            {/* THE ONLY PLACE A CAPABILITY CAN BE CREATED. Offered on a pass, and
                only once. */}
            {registration.status === "passed" &&
              registration.certificateUuid === null &&
              registration.unlocksCapability && (
                <button
                  type="button"
                  onClick={() => run(() => issueCertificateAction(registration.uuid))}
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 rounded-control bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
                >
                  <Award size={12} />
                  Issue certificate
                </button>
              )}

            {registration.certificateUuid && (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
                <CircleCheck size={11} />
                issued — needs verifying
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export const TrainingBoard = ({ courses, sessions }: TrainingBoardProps) => {
  const [error, setError] = useState<string>();
  const [openSession, setOpenSession] = useState<string>();
  const [rolls, setRolls] = useState<Record<string, RegistrationRow[]>>({});
  const [newSession, setNewSession] = useState<{
    courseUuid: string;
    heldOn: string;
    capacity: string;
  }>({ courseUuid: "", heldOn: "", capacity: "" });
  const [pending, startTransition] = useTransition();

  const openRoll = (sessionUuid: string): void => {
    if (openSession === sessionUuid) {
      setOpenSession(undefined);
      return;
    }
    setOpenSession(sessionUuid);
    startTransition(async () => {
      const { getRegistrationsAction } = await import(
        "@/app/(dashboard)/training/action"
      );
      const list = await getRegistrationsAction(sessionUuid);
      setRolls((previous) => ({ ...previous, [sessionUuid]: list }));
    });
  };

  const schedule = (): void => {
    setError(undefined);
    startTransition(async () => {
      const result = await createSessionAction({
        courseUuid: newSession.courseUuid,
        mode: "in_person",
        heldOn: newSession.heldOn || null,
        timing: null,
        location: null,
        capacity: newSession.capacity ? Number(newSession.capacity) : null,
        trainerName: null,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setNewSession({ courseUuid: "", heldOn: "", capacity: "" });
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <p className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <h2 className="font-heading flex items-center gap-2 text-lg">
          <GraduationCap size={17} className="text-primary" />
          Courses
          <span className="text-sm text-faint">{courses.length}</span>
        </h2>
        {courses.length === 0 ? (
          <p className="rounded-card border border-dashed border-hairline px-4 py-8 text-center text-sm text-faint">
            No courses yet. A course that unlocks a capability is how a partner
            earns one.
          </p>
        ) : (
          courses.map((course) => (
            <div
              key={course.uuid}
              className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-hairline bg-surface px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{course.title}</p>
                <p className="text-[11px] text-muted">
                  {course.brandName ?? "SOT"}
                  {course.system && ` · ${course.system}`}
                  {` · ${course.sessionCount} sessions, ${course.upcomingCount} upcoming`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {course.unlocksCapability ? (
                  <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-900">
                    unlocks {course.unlocksCapability.replace(/_/g, " ")}
                  </span>
                ) : (
                  <span className="text-[11px] text-faint">unlocks nothing</span>
                )}
                <span className="text-[11px] text-muted">
                  pass at {course.passMark}%
                  {course.validForMonths
                    ? ` · valid ${course.validForMonths} months`
                    : " · does not expire"}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {courses.length > 0 && (
        <div className="flex flex-wrap items-end gap-2 rounded-card border border-hairline bg-surface p-4">
          <div className="flex min-w-52 flex-col gap-1 text-xs text-muted">
            Course
            <Dropdown
              value={newSession.courseUuid}
              onChange={(value) =>
                setNewSession((previous) => ({ ...previous, courseUuid: value }))
              }
              placeholder="Pick one"
              options={courses.map((course) => ({
                value: course.uuid,
                label: course.title,
              }))}
            />
          </div>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Date
            <input
              type="date"
              value={newSession.heldOn}
              onChange={(event) =>
                setNewSession((previous) => ({
                  ...previous,
                  heldOn: event.target.value,
                }))
              }
              className="rounded-control border border-hairline bg-surface px-2.5 py-1.5 text-xs text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Capacity (blank for no limit)
            <input
              value={newSession.capacity}
              onChange={(event) =>
                setNewSession((previous) => ({
                  ...previous,
                  capacity: event.target.value,
                }))
              }
              inputMode="numeric"
              className="w-32 rounded-control border border-hairline bg-surface px-2.5 py-1.5 text-xs text-ink"
            />
          </label>
          <button
            type="button"
            onClick={schedule}
            disabled={pending || !newSession.courseUuid || !newSession.heldOn}
            className="inline-flex items-center gap-1.5 rounded-control bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
          >
            <CalendarPlus size={13} />
            Schedule a session
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h2 className="font-heading flex items-center gap-2 text-lg">
          <Users size={17} className="text-primary" />
          Sessions
          <span className="text-sm text-faint">{sessions.length}</span>
        </h2>
        {sessions.map((session) => (
          <div
            key={session.uuid}
            className="overflow-hidden rounded-card border border-hairline bg-surface"
          >
            <button
              type="button"
              onClick={() => openRoll(session.uuid)}
              className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left hover:bg-hover"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">
                  {session.courseTitle}
                </p>
                <p className="text-[11px] text-muted">
                  {TRAINING_DELIVERY_MODE_LABELS[session.mode]}
                  {session.heldOn && ` · ${session.heldOn}`}
                  {` · ${session.registeredCount} registered`}
                  {/* Null capacity is no limit, not no places. */}
                  {session.placesLeft !== null &&
                    ` · ${session.placesLeft} places left`}
                </p>
              </div>
              <span className="shrink-0 text-[11px] text-secondary">
                {openSession === session.uuid ? "Hide" : "Mark up"}
              </span>
            </button>

            {openSession === session.uuid && (
              <div className="border-t border-hairline">
                <Roll
                  session={session}
                  registrations={rolls[session.uuid] ?? []}
                  onError={setError}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
