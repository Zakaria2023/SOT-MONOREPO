"use client";

import {
  DEFAULT_PHONE_ISO,
  composeE164,
  parseE164,
  phoneCodeOptions,
} from "@/lib/phone";
import { Phone } from "lucide-react";
import { useState } from "react";
import { Combobox, FormError, Input } from "ui";

type PhoneInputProps = {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  label?: string;
};

// A country selector + local number field that always emits a valid E.164
// string (what Clerk requires), so users can't submit a malformed number.
export const PhoneInput = ({
  value,
  onChange,
  error,
  label = "Phone",
}: PhoneInputProps) => {
  const initial = parseE164(value);
  const [iso, setIso] = useState(initial.iso || DEFAULT_PHONE_ISO);
  const [nationalNumber, setNationalNumber] = useState(initial.nationalNumber);

  const update = (nextIso: string, nextNumber: string) => {
    setIso(nextIso);
    setNationalNumber(nextNumber);
    onChange(composeE164(nextIso, nextNumber));
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 text-sm font-semibold text-ink">
        <span className="text-primary">
          <Phone size={16} />
        </span>
        {label}
      </label>

      <Combobox
        value={iso}
        onChange={(nextIso) => update(nextIso, nationalNumber)}
        options={phoneCodeOptions}
        placeholder="Select country"
        searchPlaceholder="Search countries…"
        emptyMessage="No countries found"
      />

      <Input
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="Phone number"
        value={nationalNumber}
        onChange={(event) => update(iso, event.target.value)}
      />

      <FormError message={error} />
    </div>
  );
};
