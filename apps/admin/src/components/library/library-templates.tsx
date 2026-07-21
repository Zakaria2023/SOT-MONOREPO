"use client";

import {
  createTemplateFromGroupAction,
  deleteTemplateAction,
  type LibraryBuilderGroup,
  type SpecificationTemplate,
} from "@/app/(dashboard)/library/action";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button, Dropdown } from "ui";

type LibraryTemplatesProps = {
  templates: SpecificationTemplate[];
  groups: LibraryBuilderGroup[];
};

export const LibraryTemplates = ({
  templates,
  groups,
}: LibraryTemplatesProps) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>(undefined);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [fromGroup, setFromGroup] = useState("");

  // Resolve attribute keys → labels for display (templates store keys).
  const labelByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const group of groups) {
      for (const attribute of group.attributes) {
        map.set(attribute.key, attribute.label);
      }
    }
    return map;
  }, [groups]);

  const run = (action: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      setError(undefined);
      const result = await action();
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-4 rounded-card border border-hairline bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-semibold text-ink">
          Templates · {templates.length}
        </span>
        <div className="flex items-center gap-2">
          <div className="w-52">
            <Dropdown
              value={fromGroup}
              onChange={setFromGroup}
              placeholder="From group…"
              options={groups
                .filter((group) => group.uuid)
                .map((group) => ({ value: group.uuid, label: group.name }))}
            />
          </div>
          <Button
            type="button"
            disabled={!fromGroup || isPending}
            onClick={() =>
              run(async () => {
                const result = await createTemplateFromGroupAction(fromGroup);
                if (!result.error) setFromGroup("");
                return result;
              })
            }
          >
            <Plus size={15} /> Create
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {templates.length === 0 ? (
        <p className="py-6 text-center text-sm text-faint">
          No templates yet. Bundle a group&apos;s attributes into a reusable
          template.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-hairline">
          {templates.map((template) => {
            const isOpen = expanded === template.uuid;
            return (
              <li key={template.uuid} className="py-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setExpanded(isOpen ? null : template.uuid)
                    }
                    className="flex flex-1 items-center gap-2 text-left"
                  >
                    <ChevronDown
                      size={16}
                      className={`text-faint transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                    <span className="font-heading text-sm text-ink">
                      {template.name}
                    </span>
                    <span className="text-xs text-faint">
                      {template.attributeKeys.length} attributes
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      run(() => deleteTemplateAction(template.uuid))
                    }
                    aria-label="Delete template"
                    className="rounded-control border border-hairline p-1.5 text-secondary hover:bg-hover"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                {isOpen && (
                  <p className="mt-2 pl-6 text-xs leading-relaxed text-muted">
                    {template.attributeKeys
                      .map((key) => labelByKey.get(key) ?? key)
                      .join(" · ")}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
