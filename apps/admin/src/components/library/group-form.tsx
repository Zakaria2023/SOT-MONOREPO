"use client";

import { Field } from "@/components/shared/field";

import { useState } from "react";
import { Button, Dropdown, Input } from "ui";
import { DOMAIN_OPTIONS } from "@/components/library/library-shared";
/** Create/rename form for a library group. */
export type GroupFormProps = {
  initial?: { name: string; domain: string | null };
  onSubmit: (fields: { name: string; domain: string | null }) => void;
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
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button
          disabled={pending || name.trim() === ""}
          onClick={() =>
            onSubmit({ name, domain: domain === "" ? null : domain })
          }
        >
          {initial ? "Save" : "Add group"}
        </Button>
      </div>
    </div>
  );
};
