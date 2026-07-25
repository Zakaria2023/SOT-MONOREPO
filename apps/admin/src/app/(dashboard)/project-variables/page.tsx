import { VariablesManager } from "@/components/project-variables/variables-manager";
import { AsyncSection } from "@/components/shared/async-section";
import { getVariables } from "./action";

const VariablesList = async () => {
  const variables = await getVariables();
  return <VariablesManager variables={variables} />;
};

const ProjectVariablesPage = () => (
  <div className="flex flex-col gap-5">
    <h1 className="font-heading text-2xl text-ink">Project variables</h1>

    <AsyncSection reloadKey="project-variables">
      <VariablesList />
    </AsyncSection>
  </div>
);

export default ProjectVariablesPage;
