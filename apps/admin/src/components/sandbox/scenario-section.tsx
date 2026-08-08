import { listScenariosAction } from "@/app/(dashboard)/sandbox/actions";
import { ScenarioList } from "@/components/sandbox/scenario-list";

// Lists what exists without evaluating anything. Running the suite costs a full
// rule pass per scenario, and that is a button somebody presses — not the price
// of opening the page.
export const ScenarioSection = async () => {
  const scenarios = await listScenariosAction();

  return (
    <ScenarioList
      names={scenarios.map((scenario) => ({
        uuid: scenario.uuid,
        name: scenario.name,
        note: scenario.note,
        baselined: scenario.expected !== null,
      }))}
    />
  );
};
