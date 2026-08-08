import { getAdminInboxAction } from "@/app/(dashboard)/notifications/action";
import { Inbox } from "@/components/notifications/inbox";
import { AsyncSection } from "@/components/shared/async-section";
import { PageHeader } from "@/components/shared/page-header";

const Feed = async () => <Inbox inbox={await getAdminInboxAction()} />;

const NotificationsPage = () => (
  <div className="flex flex-col gap-5">
    <PageHeader
      title="Notifications"
      description="What has happened that somebody here should know about."
    />

    <AsyncSection reloadKey="notifications">
      <Feed />
    </AsyncSection>
  </div>
);

export default NotificationsPage;
