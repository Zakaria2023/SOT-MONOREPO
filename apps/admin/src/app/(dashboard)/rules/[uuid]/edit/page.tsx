import { RuleForm } from "@/components/rules/rule-form";
import { notFound } from "next/navigation";
import {
  getCompatibilityRule,
  getProjectVariables,
  getSpecifications,
} from "services";

type Props = {
  params: Promise<{ uuid: string }>;
};

const EditRulePage = async ({ params }: Props) => {
  const { uuid } = await params;

  const [rule, specifications, variables] = await Promise.all([
    getCompatibilityRule(uuid),
    getSpecifications(),
    getProjectVariables(),
  ]);

  if (!rule) {
    notFound();
  }

  return (
    <RuleForm
      mode="edit"
      rule={rule}
      specifications={specifications}
      variables={variables}
    />
  );
};

export default EditRulePage;
