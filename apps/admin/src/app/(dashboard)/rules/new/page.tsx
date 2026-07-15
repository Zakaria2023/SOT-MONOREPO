import { RuleForm } from "@/components/rules/rule-form";
import { getSpecifications } from "services";

const NewRulePage = async () => {
  const specifications = await getSpecifications();

  return <RuleForm mode="add" specifications={specifications} />;
};

export default NewRulePage;
