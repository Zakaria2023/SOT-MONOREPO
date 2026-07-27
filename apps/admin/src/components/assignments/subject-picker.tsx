"use client";

import type { PredicateAttribute } from "@/components/assignments/condition-picker";
import type { Predicate } from "@/db/types";
import { Dropdown, Input, type DropdownOption } from "ui";

// ---------------------------------------------------------------------------
// "Which items?" — answered the two ways an author actually thinks.
//
//   PRODUCT GROUP — a category and everything under it. What a thing IS.
//   CONDITION     — an attribute and a value. What a thing MEASURES.
//
// Both compile to the same Predicate, so the engine has one language and the
// author has two words. The group form exists because the alternative is
// demanding that every category be given a Device Role, and every product
// filled in, before a single rule can be written.
//
// A group matches the whole SUBTREE. A rule about Networking covers a switch
// filed under SOHO, which is the same inheritance everything else here runs on.
// ---------------------------------------------------------------------------

export type SubjectMode = "group" | "condition";

// What each side of the toggle emits before anything is picked.
//
// Both are real predicates, and neither is null. Null used to mean "condition
// mode, nothing chosen", which every caller then had to coerce back into
// something storable — and the coercion turned it straight back into a group,
// so the toggle could not be switched at all. A placeholder that says which
// mode it is removes the guess.
//
// `exists` on no attribute matches nothing, which is the honest reading of a
// condition nobody has finished writing.
const BLANK_GROUP: Predicate = { op: "in_category", categoryUuid: "" };
const BLANK_CONDITION: Predicate = { op: "exists", attr: "" };

type SubjectPickerProps = {
  value: Predicate | null;
  // Never null. The picker always hands back something storable — a blank group
  // or a blank condition — so no caller has to invent a default, and no caller
  // can invent one that flips the mode back.
  onChange: (next: Predicate) => void;
  attributes: PredicateAttribute[];
  // Depth-ordered, so the tree reads as a tree in the menu.
  categoryOptions: DropdownOption[];
};

/** Which of the two shapes a stored predicate is, so the toggle opens on it. */
export const subjectMode = (value: Predicate | null): SubjectMode =>
  value?.op === "in_category" ? "group" : "condition";

const attributeOf = (value: Predicate | null): string => {
  if (!value) {
    return "";
  }
  return "attr" in value ? value.attr : "";
};

/** The single value a condition asserts, as text for its control. */
const valueOf = (value: Predicate | null): string => {
  if (value?.op === "equals") {
    return typeof value.value === "boolean"
      ? String(value.value)
      : String(value.value);
  }
  if (value?.op === "in") {
    return value.values.length > 0 ? String(value.values[0]) : "";
  }
  return "";
};

export const SubjectPicker = ({
  value,
  onChange,
  attributes,
  categoryOptions,
}: SubjectPickerProps) => {
  const mode = subjectMode(value);
  const attribute = attributes.find(
    (entry) => entry.uuid === attributeOf(value),
  );
  const live = (attribute?.options ?? []).filter((option) => !option.retired);

  const setAttribute = (uuid: string): void => {
    const next = attributes.find((entry) => entry.uuid === uuid);
    if (!next) {
      return;
    }
    // Changing the attribute drops the old value — it belonged to a different
    // question, and carrying it over would assert something nobody chose.
    if (next.type === "boolean") {
      onChange({ op: "equals", attr: uuid, value: true });
      return;
    }
    if (next.type === "number") {
      onChange({ op: "exists", attr: uuid });
      return;
    }
    onChange({ op: "in", attr: uuid, values: [], mode: "any" });
  };

  const setValue = (raw: string): void => {
    const uuid = attributeOf(value);
    if (!uuid || !attribute) {
      return;
    }
    if (attribute.type === "boolean") {
      onChange({ op: "equals", attr: uuid, value: raw === "true" });
      return;
    }
    if (raw === "") {
      onChange({ op: "exists", attr: uuid });
      return;
    }
    onChange({ op: "in", attr: uuid, values: [raw], mode: "any" });
  };

  return (
    <div className="flex flex-col gap-2 rounded-control border border-dashed border-hairline p-2.5">
      <div className="flex w-fit rounded-control border border-hairline p-0.5">
        {(["group", "condition"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() =>
              onChange(option === "group" ? BLANK_GROUP : BLANK_CONDITION)
            }
            className={`rounded px-3 py-1 text-xs ${
              mode === option
                ? "bg-primary-tint font-medium text-primary"
                : "text-muted hover:text-ink"
            }`}
          >
            {option === "group" ? "Product group" : "Condition"}
          </button>
        ))}
      </div>

      {mode === "group" ? (
        <Dropdown
          value={value?.op === "in_category" ? value.categoryUuid : ""}
          onChange={(categoryUuid) =>
            onChange({ op: "in_category", categoryUuid })
          }
          options={categoryOptions}
          searchable
          placeholder="— group —"
        />
      ) : (
        <div className="flex flex-col gap-2">
          <Dropdown
            value={attributeOf(value)}
            onChange={setAttribute}
            options={attributes.map((entry) => ({
              value: entry.uuid,
              label: entry.unit
                ? `${entry.label} (${entry.unit})`
                : entry.label,
            }))}
            searchable
            placeholder="— attribute —"
          />

          {attribute?.type === "boolean" && (
            <Dropdown
              value={valueOf(value)}
              onChange={setValue}
              options={[
                { value: "true", label: "Yes" },
                { value: "false", label: "No" },
              ]}
              placeholder="value"
            />
          )}

          {(attribute?.type === "single_select" ||
            attribute?.type === "multi_select") && (
            <Dropdown
              value={valueOf(value)}
              onChange={setValue}
              options={live.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              searchable={live.length > 8}
              placeholder="value"
            />
          )}

          {/* A number has no list to pick from. Left blank the condition is
              "filled in at all", which is the only thing that can be said about
              a quantity without asking for an operator. */}
          {attribute?.type === "number" && (
            <Input
              placeholder="value"
              value={valueOf(value)}
              onChange={(event) => setValue(event.target.value)}
            />
          )}
        </div>
      )}
    </div>
  );
};
