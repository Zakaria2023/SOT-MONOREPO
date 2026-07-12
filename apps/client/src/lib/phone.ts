import { Country } from "country-state-city";
import type { ComboboxOption } from "ui";

type PhoneCountry = {
  iso: string;
  name: string;
  flag: string;
  dial: string;
};

// Built once — the country list never changes. Dial code is normalised to
// "+<digits>" so it can be concatenated straight into an E.164 number.
const phoneCountries: PhoneCountry[] = Country.getAllCountries()
  .map((country) => ({
    iso: country.isoCode,
    name: country.name,
    flag: country.flag,
    dial: `+${(country.phonecode ?? "").replace(/\D/g, "")}`,
  }))
  .filter((country) => country.dial.length > 1);

/** Default to Saudi Arabia given the app's primary market. */
export const DEFAULT_PHONE_ISO = "SA";

// Searchable by country name or dial code; the ISO code is the stable value.
export const phoneCodeOptions: ComboboxOption[] = phoneCountries.map(
  (country) => ({
    value: country.iso,
    label: `${country.flag} ${country.name} (${country.dial})`,
  }),
);

const dialByIso = new Map(phoneCountries.map((c) => [c.iso, c.dial]));

const byDialLengthDesc = [...phoneCountries].sort(
  (a, b) => b.dial.length - a.dial.length,
);

export const dialCodeForIso = (iso: string): string =>
  dialByIso.get(iso) ?? "";

/** Combines a country and a locally-typed number into an E.164 string. */
export const composeE164 = (iso: string, nationalNumber: string): string => {
  const dial = dialCodeForIso(iso);
  const digits = nationalNumber.replace(/\D/g, "").replace(/^0+/, "");
  if (!dial || !digits) {
    return "";
  }
  return `${dial}${digits}`;
};

/** Best-effort split of an E.164 string back into a country + local number. */
export const parseE164 = (
  value: string,
): { iso: string; nationalNumber: string } => {
  if (value.startsWith("+")) {
    // Longest dial code first so e.g. +1 vs +1876 resolve to the right country.
    const match = byDialLengthDesc.find((country) =>
      value.startsWith(country.dial),
    );
    if (match) {
      return { iso: match.iso, nationalNumber: value.slice(match.dial.length) };
    }
  }
  return { iso: DEFAULT_PHONE_ISO, nationalNumber: "" };
};
