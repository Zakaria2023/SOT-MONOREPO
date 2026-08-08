import {
  getMyTrainingAction,
  getOpenSessionsAction,
} from "@/app/(dashboard)/training/actions";
import { TrainingFeed } from "@/components/training/training-feed";

const PartnerTrainingPage = async () => {
  const [sessions, mine] = await Promise.all([
    getOpenSessionsAction(),
    getMyTrainingAction(),
  ]);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl text-ink">Training</h1>
        <p className="mt-1 text-sm text-muted">
          Vendor-supported courses, and the route to a capability: attend, pass the
          assessment, and we verify the certificate.
        </p>
      </div>

      <TrainingFeed
        sessions={sessions}
        registrations={mine.registrations}
        certificates={mine.certificates}
      />
    </div>
  );
};

export default PartnerTrainingPage;
