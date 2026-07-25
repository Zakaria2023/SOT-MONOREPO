import { RelationBuilder } from "@/components/rules/relation-builder";
import { getProjectVariables, getSpecifications } from "services";

const NewRulePage = async () => {
  const [specifications, variables] = await Promise.all([
    getSpecifications(),
    getProjectVariables(),
  ]);

  return (
    <RelationBuilder
      mode="add"
      specifications={specifications}
      variables={variables}
    />
  );
};

export default NewRulePage;
