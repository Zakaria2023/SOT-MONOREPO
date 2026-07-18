"use client";

import type {
  SpecFieldForm,
  SpecificationFormValues,
} from "@/app/(dashboard)/specifications/validation";
import type { SelectSpecifications } from "@/db/schema/specifications";
import type { SpecField } from "@/db/types";
import { CornerDownRight, Plus, Trash2 } from "lucide-react";
import { useMemo } from "react";
import {
  Controller,
  useFieldArray,
  useFormContext,
  useWatch,
} from "react-hook-form";
import { slugify } from "utils";
import { Button, Dropdown } from "ui";
import type { DropdownOption } from "ui";

// One referenceable field in a condition: a specification itself, or any
// nested sub-field inside its option tree (products store both by key).
type ConditionField = {
  key: string;
  label: string;
  depth: number;
  values: string[];
};

type RulesEditorProps = {
  // Other specifications from the same category tree — the only ones a
  // rule's conditions may reference.
  specifications: SelectSpecifications[];
  hasCategories: boolean;
};

type RuleCardProps = {
  ruleIndex: number;
  conditionFields: ConditionField[];
  // Every forceable "field\0value" choice in this specification's tree.
  forcedChoices: DropdownOption[];
  onRemove: () => void;
};

type RuleClauseRowProps = {
  ruleIndex: number;
  clauseIndex: number;
  conditionFields: ConditionField[];
  onRemove: () => void;
};

const MATCH_OPTIONS: DropdownOption[] = [
  { value: "all", label: "All conditions match (AND)" },
  { value: "any", label: "Any condition matches (OR)" },
];

// Joins a forced field key and value into one dropdown option value. Keys are
// slugs and never contain this char, so decoding is unambiguous.
const FORCED_SEPARATOR = "\u0000";

// Flatten each specification and every sub-field in its option tree into a
// depth-ordered list, so conditions can reference nested fields too (e.g.
// "PoE Standard" under PoE's Yes option).
const collectConditionFields = (
  specifications: SelectSpecifications[],
): ConditionField[] => {
  const fields: ConditionField[] = [];
  const seen = new Set<string>();

  const push = (field: SpecField, depth: number) => {
    if (!seen.has(field.key)) {
      seen.add(field.key);
      fields.push({
        key: field.key,
        label: field.label,
        depth,
        values: field.options.map((option) => option.value),
      });
    }
    for (const option of field.options) {
      for (const child of option.children) {
        push(child, depth + 1);
      }
    }
  };

  for (const specification of specifications) {
    push(
      {
        key: specification.key,
        label: specification.label,
        options: specification.options ?? [],
      },
      0,
    );
  }
  return fields;
};

// Every forceable value in the host specification's own (unsaved) form tree,
// flattened into one list: the host's option values, and beneath each option
// the values of its sub-fields (recursively). Encoded as "key\0value" so one
// dropdown pick sets both the forced field and its value.
const collectForcedChoices = (
  hostLabel: string,
  options: SpecificationFormValues["options"],
): DropdownOption[] => {
  const choices: DropdownOption[] = [];
  const seen = new Set<string>();

  const push = (
    fieldKey: string,
    fieldLabel: string,
    value: string,
    depth: number,
  ) => {
    const composite = `${fieldKey}${FORCED_SEPARATOR}${value}`;
    if (value.trim().length === 0 || seen.has(composite)) {
      return;
    }
    seen.add(composite);
    choices.push({
      value: composite,
      label: depth === 0 ? value : `${fieldLabel}: ${value}`,
      depth,
    });
  };

  const walkFields = (children: SpecFieldForm[], depth: number) => {
    for (const child of children) {
      if (child.label.trim().length === 0) {
        continue;
      }
      const key = slugify(child.label);
      for (const option of child.options) {
        push(key, child.label, option.value, depth);
        walkFields(option.children, depth + 1);
      }
    }
  };

  // An empty label can't be keyed yet — choices appear once the spec is named.
  if (hostLabel.trim().length === 0) {
    return choices;
  }
  const hostKey = slugify(hostLabel);
  for (const option of options) {
    push(hostKey, hostLabel, option.value, 0);
    walkFields(option.children, 1);
  }
  return choices;
};

const RuleClauseRow = ({
  ruleIndex,
  clauseIndex,
  conditionFields,
  onRemove,
}: RuleClauseRowProps) => {
  const { control, setValue } = useFormContext<SpecificationFormValues>();
  const specKey = useWatch({
    control,
    name: `rules.${ruleIndex}.clauses.${clauseIndex}.specKey`,
  });

  const specOptions = conditionFields.map((field) => ({
    value: field.key,
    label: field.label,
    depth: field.depth,
  }));
  const valueOptions = (
    conditionFields.find((field) => field.key === specKey)?.values ?? []
  ).map((value) => ({ value, label: value }));

  return (
    <div className="flex flex-col gap-2 rounded-control border border-hairline bg-page p-3 md:flex-row md:items-center">
      <div className="md:w-64">
        <Controller
          control={control}
          name={`rules.${ruleIndex}.clauses.${clauseIndex}.specKey`}
          render={({ field }) => (
            <Dropdown
              searchable
              searchPlaceholder="Search specifications..."
              value={field.value}
              onChange={(value) => {
                field.onChange(value);
                // A different spec means different options — reset the picks.
                setValue(
                  `rules.${ruleIndex}.clauses.${clauseIndex}.values`,
                  [],
                );
              }}
              placeholder="Specification"
              options={specOptions}
            />
          )}
        />
      </div>

      <span className="shrink-0 text-xs font-medium text-faint">is one of</span>

      <div className="flex-1">
        <Controller
          control={control}
          name={`rules.${ruleIndex}.clauses.${clauseIndex}.values`}
          render={({ field }) => (
            <Dropdown
              multiple
              value={field.value}
              onChange={field.onChange}
              placeholder={specKey ? "Select values" : "Pick a spec first"}
              options={valueOptions}
            />
          )}
        />
      </div>

      <Button
        type="button"
        variant="icon"
        className="shrink-0 self-end md:self-auto"
        onClick={onRemove}
      >
        <Trash2 size={16} />
      </Button>
    </div>
  );
};

const RuleCard = ({
  ruleIndex,
  conditionFields,
  forcedChoices,
  onRemove,
}: RuleCardProps) => {
  const { control, setValue } = useFormContext<SpecificationFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `rules.${ruleIndex}.clauses`,
  });
  const forcedKey = useWatch({
    control,
    name: `rules.${ruleIndex}.forcedKey`,
  });

  return (
    <div className="flex flex-col gap-4 rounded-control border border-hairline p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-ink">
          Rule {ruleIndex + 1}
        </span>
        <Button type="button" variant="icon" onClick={onRemove}>
          <Trash2 size={16} />
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted">When</span>
        <div className="md:w-72">
          <Controller
            control={control}
            name={`rules.${ruleIndex}.match`}
            render={({ field }) => (
              <Dropdown
                value={field.value}
                onChange={field.onChange}
                options={MATCH_OPTIONS}
              />
            )}
          />
        </div>

        {fields.map((field, clauseIndex) => (
          <RuleClauseRow
            key={field.id}
            ruleIndex={ruleIndex}
            clauseIndex={clauseIndex}
            conditionFields={conditionFields}
            onRemove={() => remove(clauseIndex)}
          />
        ))}

        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={() => append({ specKey: "", values: [] })}
        >
          <Plus size={16} />
          Add Condition
        </Button>
      </div>

      <div className="flex flex-col gap-2 border-t border-hairline pt-4">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
          <CornerDownRight size={13} />
          Then force
        </span>
        {forcedChoices.length === 0 ? (
          <p className="rounded-control border border-dashed border-hairline p-3 text-sm text-faint md:w-72">
            Name this specification and add its options above first — the rule
            forces one of its values.
          </p>
        ) : (
          <div className="md:w-96">
            <Controller
              control={control}
              name={`rules.${ruleIndex}.forcedValue`}
              render={({ field, fieldState }) => (
                <>
                  <Dropdown
                    value={
                      forcedKey && field.value
                        ? `${forcedKey}${FORCED_SEPARATOR}${field.value}`
                        : ""
                    }
                    onChange={(composite) => {
                      const separatorAt = composite.indexOf(FORCED_SEPARATOR);
                      setValue(
                        `rules.${ruleIndex}.forcedKey`,
                        composite.slice(0, separatorAt),
                      );
                      field.onChange(composite.slice(separatorAt + 1));
                    }}
                    placeholder="Select a value"
                    options={forcedChoices}
                  />
                  {fieldState.error && (
                    <p className="mt-1 text-xs text-danger">
                      {fieldState.error.message}
                    </p>
                  )}
                </>
              )}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export const RulesEditor = ({
  specifications,
  hasCategories,
}: RulesEditorProps) => {
  const { control } = useFormContext<SpecificationFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: "rules" });
  const watchedLabel = useWatch({ control, name: "label" });
  const watchedOptions = useWatch({ control, name: "options" });

  // Every forceable value in this specification's tree, one flat list.
  const forcedChoices = useMemo(
    () => collectForcedChoices(watchedLabel ?? "", watchedOptions ?? []),
    [watchedLabel, watchedOptions],
  );

  // Specs and all their nested sub-fields, referenceable in conditions.
  const conditionFields = useMemo(
    () => collectConditionFields(specifications),
    [specifications],
  );

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="text-sm font-semibold text-ink">Rules</label>
        <p className="mt-1 text-xs text-muted">
          When other specifications&apos; chosen values match, this
          specification is auto-set to the forced value and locked on the
          product form. The first matching rule wins.
        </p>
      </div>

      {!hasCategories ? (
        <p className="rounded-control border border-dashed border-hairline p-4 text-sm text-faint">
          Select the categories above first — rules can only reference
          specifications from the same category tree.
        </p>
      ) : specifications.length === 0 ? (
        <p className="rounded-control border border-dashed border-hairline p-4 text-sm text-faint">
          No other specifications apply to the selected categories yet — create
          them first, then come back to add rules.
        </p>
      ) : (
        <>
          {fields.map((field, ruleIndex) => (
            <RuleCard
              key={field.id}
              ruleIndex={ruleIndex}
              conditionFields={conditionFields}
              forcedChoices={forcedChoices}
              onRemove={() => remove(ruleIndex)}
            />
          ))}

          <Button
            type="button"
            variant="outline"
            className="self-start"
            onClick={() =>
              append({
                match: "all",
                clauses: [{ specKey: "", values: [] }],
                forcedKey: "",
                forcedValue: "",
              })
            }
          >
            <Plus size={16} />
            Add Rule
          </Button>
        </>
      )}
    </div>
  );
};
