import { DesignSandbox } from "@/components/sandbox/design-sandbox";
import { PageHeader } from "@/components/shared/page-header";

// No Suspense boundary and no async child: this screen fetches nothing on load.
// Everything it shows comes from a basket the author has not built yet.
const SandboxPage = () => (
  <div className="flex flex-col gap-5">
    <PageHeader
      title="Sandbox"
      description="Put a basket through the real gate, and read what the buyer would read."
    />

    <DesignSandbox />
  </div>
);

export default SandboxPage;
