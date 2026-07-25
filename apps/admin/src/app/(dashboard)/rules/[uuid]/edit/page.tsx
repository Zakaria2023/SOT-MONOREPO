import { RelationBuilder } from "@/components/rules/relation-builder";
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

  return (
    <RelationBuilder
      mode="edit"
      rule={rule}
      specifications={specifications}
    />
  );
};

export default EditRulePage;
