import { RulesTable } from "@/components/rules/rules-table";
import { FlaskConical, Plus } from "lucide-react";
import Link from "next/link";
import { getCompatibilityRules } from "services";

const RulesPage = async () => {
  const rules = await getCompatibilityRules();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl text-ink">
            Compatibility Rules
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/rules/playground"
            className="flex items-center gap-1.5 rounded-control border border-hairline px-4 py-2 text-sm font-semibold text-secondary hover:bg-hover"
          >
            <FlaskConical size={16} />
            Playground
          </Link>
          <Link
            href="/rules/new"
            className="flex items-center gap-1.5 rounded-control bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
          >
            <Plus size={16} />
            Add Rule
          </Link>
        </div>
      </div>

      <RulesTable rules={rules} />
    </div>
  );
};

export default RulesPage;
