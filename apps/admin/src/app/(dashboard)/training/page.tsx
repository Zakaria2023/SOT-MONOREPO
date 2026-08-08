import {
  getCoursesAction,
  getSessionsAction,
} from "@/app/(dashboard)/training/action";
import { AsyncSection } from "@/components/shared/async-section";
import { PageHeader } from "@/components/shared/page-header";
import { TrainingBoard } from "@/components/training/training-board";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";

const Board = async () => {
  const [courses, sessions] = await Promise.all([
    getCoursesAction(),
    getSessionsAction(),
  ]);
  return <TrainingBoard courses={courses} sessions={sessions} />;
};

const TrainingPage = () => (
  <div className="flex flex-col gap-5">
    <PageHeader
      title="Training"
      description="Courses, sessions and assessments. A capability is earned by passing, never by attending."
    />

    <Link
      href="/training/certifications"
      className="inline-flex w-fit items-center gap-2 rounded-control border border-hairline px-3 py-2 text-sm text-ink transition-colors hover:border-primary"
    >
      <BadgeCheck size={15} className="text-primary" />
      Certificates waiting to be verified
    </Link>

    <AsyncSection reloadKey="training">
      <Board />
    </AsyncSection>
  </div>
);

export default TrainingPage;
