"use client";

import {
  ConditionPicker,
  type PredicateAttribute,
} from "@/components/assignments/condition-picker";
import { Field, FieldSet } from "@/components/shared/field";
import type { PresenceAlternative, PresenceSpec } from "@/db/types";
import { Plus, X } from "lucide-react";
import { Dropdown, Input, Textarea, type DropdownOption } from "ui";

// The Presence family. Structurally different from every other one: the others
// compare items that ARE in the selection, while this detects a companion that
// SHOULD be there and isn't. So it is the only family that can say "you forgot
// the recorder".
//
// It identifies "a camera" the same way every other family identifies anything —
// through an attribute, normally a Device Role. Matching on category NAMES would
// break the first time a category is renamed or translated.

// The buyer-supplied inputs a requirement may be satisfied by. Structural, so
// this file does not have to reach into the relation builder for a type.
type PresenceVariable = {
  uuid: string;
  label: string;
  unit: string | null;
};

type PresenceEditorProps = {
  value: PresenceSpec;
  onChange: (next: PresenceSpec) => void;
  attributes: PredicateAttribute[];
  variables: PresenceVariable[];
};

export const PresenceEditor = ({
  value,
  onChange,
  attributes,
  variables,
}: PresenceEditorProps) => {
  const setRequirement = (
    index: number,
    patch: Partial<PresenceSpec["requires"][number]>,
  ): void => {
    onChange({
      ...value,
      requires: value.requires.map((requirement, at) =>
        at === index ? { ...requirement, ...patch } : requirement,
      ),
    });
  };

  const setAlternative = (
    requirementIndex: number,
    alternativeIndex: number,
    next: PresenceAlternative | null,
  ): void => {
    const requirement = value.requires[requirementIndex];
    if (!requirement) {
      return;
    }
    const satisfiedBy = next
      ? requirement.satisfiedBy.map((alternative, at) =>
          at === alternativeIndex ? next : alternative,
        )
      : requirement.satisfiedBy.filter((_, at) => at !== alternativeIndex);
    setRequirement(requirementIndex, { satisfiedBy });
  };

  const variableOptions: DropdownOption[] = variables.map((variable) => ({
    value: variable.uuid,
    label: variable.label,
  }));

  return (
    <div className="flex flex-col gap-4">
      <FieldSet
        title="This applies to items where…"
        hint="Usually a Device Role — “role is Camera”. Using an attribute rather than a category keeps the rule working after a category is renamed."
      >
        <ConditionPicker
          value={value.trigger}
          onChange={(trigger) =>
            onChange({
              ...value,
              trigger: trigger ?? {
                op: "exists",
                attr: attributes[0]?.uuid ?? "",
              },
            })
          }
          attributes={attributes}
          emptyLabel="Pick what triggers this rule"
        />
      </FieldSet>

      <div className="flex flex-col gap-3">
        <span className="text-sm font-semibold text-ink">
          …and the selection must also contain
        </span>

        {value.requires.length === 0 && (
          <p className="rounded-control border border-dashed border-hairline px-3 py-4 text-center text-[11px] text-faint">
            Nothing required yet — this rule would always pass.
          </p>
        )}

        {value.requires.map((requirement, requirementIndex) => (
          <div
            key={requirementIndex}
            className="flex flex-col gap-2.5 rounded-control border border-hairline bg-base p-2.5"
          >
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <Input
                  label="What the buyer is told is missing"
                  placeholder="Cameras need somewhere to record"
                  value={requirement.description}
                  onChange={(event) =>
                    setRequirement(requirementIndex, {
                      description: event.target.value,
                    })
                  }
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...value,
                    requires: value.requires.filter(
                      (_, at) => at !== requirementIndex,
                    ),
                  })
                }
                aria-label="Remove this requirement"
                className="mt-6 shrink-0 rounded-control p-1.5 text-faint hover:bg-hover hover:text-red-400"
              >
                <X size={14} />
              </button>
            </div>

            <Field label="Satisfied by any one of these">
              {requirement.satisfiedBy.map((alternative, alternativeIndex) => (
                <div
                  key={alternativeIndex}
                  className="flex flex-col gap-1.5 rounded-control border border-hairline p-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <Dropdown
                        value={alternative.type}
                        onChange={(next) =>
                          setAlternative(
                            requirementIndex,
                            alternativeIndex,
                            next === "variable_true"
                              ? {
                                  type: "variable_true",
                                  variableUuid: variables[0]?.uuid ?? "",
                                }
                              : {
                                  type: "item_exists",
                                  predicate: {
                                    op: "exists",
                                    attr: attributes[0]?.uuid ?? "",
                                  },
                                },
                          )
                        }
                        options={[
                          {
                            value: "item_exists",
                            label: "An item in the cart",
                          },
                          ...(variables.length > 0
                            ? [
                                {
                                  value: "variable_true",
                                  label: "The buyer answered yes to…",
                                },
                              ]
                            : []),
                        ]}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setAlternative(requirementIndex, alternativeIndex, null)
                      }
                      aria-label="Remove this alternative"
                      className="shrink-0 rounded-control p-1.5 text-faint hover:bg-hover hover:text-red-400"
                    >
                      <X size={13} />
                    </button>
                  </div>

                  {alternative.type === "item_exists" ? (
                    <ConditionPicker
                      value={alternative.predicate}
                      onChange={(predicate) =>
                        setAlternative(requirementIndex, alternativeIndex, {
                          type: "item_exists",
                          predicate: predicate ?? {
                            op: "exists",
                            attr: attributes[0]?.uuid ?? "",
                          },
                        })
                      }
                      attributes={attributes}
                      emptyLabel="Describe the companion"
                    />
                  ) : (
                    <Dropdown
                      value={alternative.variableUuid}
                      onChange={(variableUuid) =>
                        setAlternative(requirementIndex, alternativeIndex, {
                          type: "variable_true",
                          variableUuid,
                        })
                      }
                      options={variableOptions}
                    />
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={() =>
                  setRequirement(requirementIndex, {
                    satisfiedBy: [
                      ...requirement.satisfiedBy,
                      {
                        type: "item_exists",
                        predicate: {
                          op: "exists",
                          attr: attributes[0]?.uuid ?? "",
                        },
                      },
                    ],
                  })
                }
                className="flex w-fit items-center gap-1 rounded-control px-2 py-0.5 text-[11px] text-primary hover:bg-hover"
              >
                <Plus size={12} />
                Add an alternative
              </button>
            </Field>

            <div className="flex flex-col gap-1">
              <Input
                label="Quantity per trigger"
                type="number"
                min={0}
                step="0.1"
                value={String(requirement.perTriggerQuantity)}
                onChange={(event) =>
                  setRequirement(requirementIndex, {
                    perTriggerQuantity: Number(event.target.value),
                  })
                }
              />
              <span className="text-[11px] text-muted">
                0 = only presence matters. 1 = every trigger needs its own — 20
                doors demand 20 readers, checked as a total. This is how
                per-door pairing works without modelling each door.
              </span>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() =>
            onChange({
              ...value,
              requires: [
                ...value.requires,
                {
                  description: "",
                  satisfiedBy: [
                    {
                      type: "item_exists",
                      predicate: {
                        op: "exists",
                        attr: attributes[0]?.uuid ?? "",
                      },
                    },
                  ],
                  perTriggerQuantity: 0,
                },
              ],
            })
          }
          className="flex w-fit items-center gap-1 rounded-control px-2 py-1 text-xs text-primary hover:bg-hover"
        >
          <Plus size={13} />
          Add a requirement
        </button>
      </div>

      <Textarea
        label="Suggested fix shown to the buyer"
        rows={2}
        placeholder="Add an NVR, or switch on cloud recording."
        value={value.suggestedFix ?? ""}
        onChange={(event) =>
          onChange({ ...value, suggestedFix: event.target.value || null })
        }
      />
    </div>
  );
};
