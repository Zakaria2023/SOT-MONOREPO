import { RelationBuilder } from "@/components/rules/relation-builder";
import { getSpecifications } from "services";

const NewRulePage = async () => {
  const specifications = await getSpecifications();

  return (
    <RelationBuilder mode="add" specifications={specifications} />
  );
};

export default NewRulePage;
