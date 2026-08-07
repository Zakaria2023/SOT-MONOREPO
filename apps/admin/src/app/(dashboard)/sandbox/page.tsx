import { DesignSandbox } from "@/components/sandbox/design-sandbox";
import { RuleHealth } from "@/components/sandbox/rule-health";
import { AsyncSection } from "@/components/shared/async-section";
import { PageHeader } from "@/components/shared/page-header";

// The basket half fetches nothing on load — everything it shows comes from a
// selection the author has not built yet — so only the health half is wrapped.
const SandboxPage = () => (
  <div className="flex flex-col gap-8">
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Sandbox"
        description="Put a basket through the real gate, and read what the buyer would read."
      />

      <DesignSandbox />
    </div>

    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-lg text-ink">Are the rules guarding?</h2>
        <p className="text-sm text-muted">
          A rule that engages with nothing is as quiet as a rule that passed. This
          tells them apart, and says whose problem each one is.
        </p>
      </div>

      <AsyncSection reloadKey="rule-health">
        <RuleHealth />
      </AsyncSection>
    </div>
  </div>
);

export default SandboxPage;
