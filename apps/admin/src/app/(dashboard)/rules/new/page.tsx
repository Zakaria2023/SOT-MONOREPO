import { RuleForm } from "@/components/rules/rule-form";
import { getProjectVariables, getSpecifications } from "services";

const NewRulePage = async () => {
  const [specifications, variables] = await Promise.all([
    getSpecifications(),
    getProjectVariables(),
  ]);

  return (
    <RuleForm
      mode="add"
      specifications={specifications}
      variables={variables}
    />
  );
};

export default NewRulePage;
