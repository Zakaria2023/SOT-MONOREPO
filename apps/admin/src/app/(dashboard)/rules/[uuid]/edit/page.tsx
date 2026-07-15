import { RuleForm } from "@/components/rules/rule-form";
import { notFound } from "next/navigation";
import { getCompatibilityRule, getSpecifications } from "services";

type Props = {
  params: Promise<{ uuid: string }>;
};

const EditRulePage = async ({ params }: Props) => {
  const { uuid } = await params;

  const [rule, specifications] = await Promise.all([
    getCompatibilityRule(uuid),
    getSpecifications(),
  ]);

  if (!rule) {
    notFound();
  }

  return <RuleForm mode="edit" rule={rule} specifications={specifications} />;
};

export default EditRulePage;
