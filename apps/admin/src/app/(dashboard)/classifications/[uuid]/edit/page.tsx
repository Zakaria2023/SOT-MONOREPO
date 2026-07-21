import { notFound } from "next/navigation";
import { ClassificationForm } from "@/components/classifications/classification-form";
import { getClassification } from "../../action";

type Props = {
  params: Promise<{ uuid: string }>;
};

const EditClassificationPage = async ({ params }: Props) => {
  const { uuid } = await params;

  const classification = await getClassification(uuid);

  if (!classification) {
    notFound();
  }

  return <ClassificationForm mode="edit" classification={classification} />;
};

export default EditClassificationPage;
