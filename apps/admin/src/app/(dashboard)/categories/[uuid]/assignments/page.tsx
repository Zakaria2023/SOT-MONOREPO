import { getCategory } from "@/app/(dashboard)/categories/action";
import { AssignmentBuilder } from "@/components/categories/assignment-builder";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAssignments, getLibraryAttributes } from "./actions";

type Props = {
  params: Promise<{ uuid: string }>;
};

const CategoryAssignmentsPage = async ({ params }: Props) => {
  const { uuid } = await params;

  const [category, assignments, library] = await Promise.all([
    getCategory(uuid),
    getAssignments(uuid),
    getLibraryAttributes(),
  ]);

  if (!category) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/categories/${uuid}/edit`}
        className="text-sm text-muted transition-colors hover:text-ink"
      >
        ← Back to {category.name}
      </Link>
      <AssignmentBuilder
        categoryUuid={uuid}
        categoryName={category.name}
        assignments={assignments}
        library={library}
      />
    </div>
  );
};

export default CategoryAssignmentsPage;
