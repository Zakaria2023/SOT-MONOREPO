"use client";

import { Field } from "@/components/shared/field";

import { useState } from "react";
import { Button, Dropdown, Input } from "ui";
import { DOMAIN_OPTIONS } from "@/components/library/library-shared";
/** Create/rename form for a library group. */
export type GroupFields = {
  name: string;
  domain: string | null;
  keyPrefix: string | null;
};

export type GroupFormProps = {
  initial?: GroupFields;
  onSubmit: (fields: GroupFields) => void;
  onCancel: () => void;
  pending: boolean;
};

export const GroupForm = ({
  initial,
  onSubmit,
  onCancel,
  pending,
}: GroupFormProps) => {
  const [name, setName] = useState(initial?.name ?? "");
  const [domain, setDomain] = useState(initial?.domain ?? "");
  const [keyPrefix, setKeyPrefix] = useState(initial?.keyPrefix ?? "");

  return (
    <div className="flex flex-col gap-2 rounded-card border border-primary/40 bg-surface p-3">
      <Input
        label="Group name"
        placeholder="Power"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <Field label="Domain">
        <Dropdown
          value={domain}
          onChange={setDomain}
          options={DOMAIN_OPTIONS}
        />
      </Field>
      {/* Decided ONCE here, so no attribute author ever has to think about it.
          Every attribute filed under this group gets an external name starting
          with it — `pwr` gives `pwr.poe_budget` — and that name is what imports
          and exports key on. Nine decisions instead of one per attribute. */}
      <Field
        label="Name prefix"
        hint="Starts the external name of every attribute in this group — pwr gives pwr.poe_budget. Lowercase and short."
      >
        <Input
          placeholder="pwr"
          value={keyPrefix}
          onChange={(event) => setKeyPrefix(event.target.value)}
        />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button
          disabled={pending || name.trim() === ""}
          onClick={() =>
            onSubmit({
              name,
              domain: domain === "" ? null : domain,
              keyPrefix: keyPrefix.trim().toLowerCase() || null,
            })
          }
        >
          {initial ? "Save" : "Add group"}
        </Button>
      </div>
    </div>
  );
};
