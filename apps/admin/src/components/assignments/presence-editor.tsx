"use client";

import type { PredicateAttribute } from "@/components/assignments/condition-picker";
import { SubjectPicker } from "@/components/assignments/subject-picker";
import { Field } from "@/components/shared/field";
import type { PresenceSpec } from "@/db/types";
import type { DropdownOption } from "ui";

// The Presence family. Structurally different from every other one: the others
// compare items that ARE in the selection, while this detects a companion that
// SHOULD be there and isn't. So it is the only family that can say "you forgot
// the recorder".
//
// Two questions, both answered the same way — a product group, or a condition:
//
//   when the basket contains ...   →  the trigger
//   there must also be ...         →  what satisfies it
//
// Everything the old editor asked for beyond those two — several alternatives
// per requirement, a per-trigger quantity, a suggested-fix sentence — is gone
// from the FORM. The stored shape still carries them and the engine still
// evaluates them, so nothing already authored stops working; the form simply
// writes the one-requirement, one-alternative case.

type PresenceEditorProps = {
  value: PresenceSpec;
  onChange: (next: PresenceSpec) => void;
  attributes: PredicateAttribute[];
  categoryOptions: DropdownOption[];
};

export const PresenceEditor = ({
  value,
  onChange,
  attributes,
  categoryOptions,
}: PresenceEditorProps) => {
  const requirement = value.requires[0];
  const satisfiedBy = requirement?.satisfiedBy[0];

  return (
    <>
      <Field label="Trigger — when the basket contains">
        <SubjectPicker
          value={value.trigger}
          onChange={(trigger) => onChange({ ...value, trigger })}
          attributes={attributes}
          categoryOptions={categoryOptions}
        />
      </Field>

      <Field label="Requires — there must also be">
        <SubjectPicker
          value={
            satisfiedBy?.type === "item_exists" ? satisfiedBy.predicate : null
          }
          onChange={(predicate) =>
            onChange({
              ...value,
              requires: [
                {
                  // The buyer's sentence comes from the rule's own name and the
                  // finding, so there is nothing to type here.
                  description: requirement?.description ?? "",
                  satisfiedBy: [{ type: "item_exists", predicate }],
                  // 0 = presence alone is enough. Per-trigger pairing (20 doors
                  // need 20 readers) is still in the shape and still evaluated;
                  // it is simply not asked for here.
                  perTriggerQuantity: requirement?.perTriggerQuantity ?? 0,
                },
              ],
            })
          }
          attributes={attributes}
          categoryOptions={categoryOptions}
        />
      </Field>
    </>
  );
};
