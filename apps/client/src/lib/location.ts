import { City, Country } from "country-state-city";
import type { ComboboxOption } from "ui";

export type ParsedLocation = {
  cityName: string;
  countryName: string;
};

// All countries, computed once — the option list never changes.
export const countryOptions: ComboboxOption[] = Country.getAllCountries().map(
  (country) => ({ value: country.isoCode, label: country.name }),
);

// Cities of a country, de-duplicated by name (a country can list the same city
// name under several states, but we only ever store the name).
export const cityOptionsForCountry = (isoCode: string): ComboboxOption[] => {
  const cities = City.getCitiesOfCountry(isoCode) ?? [];
  const seen = new Set<string>();
  const options: ComboboxOption[] = [];
  for (const city of cities) {
    if (seen.has(city.name)) {
      continue;
    }
    seen.add(city.name);
    options.push({ value: city.name, label: city.name });
  }
  return options;
};

export const findCountryIsoByName = (name: string): string =>
  countryOptions.find((option) => option.label === name)?.value ?? "";

export const findCountryNameByIso = (isoCode: string): string =>
  countryOptions.find((option) => option.value === isoCode)?.label ?? "";

// Stored form: "City, Country" — keeps the first token as the city so the
// same-city partner matching keeps working. Empty until both are chosen.
export const formatLocation = (
  cityName: string,
  countryName: string,
): string => (cityName && countryName ? `${cityName}, ${countryName}` : "");

export const parseLocation = (value: string): ParsedLocation => {
  const [cityName = "", countryName = ""] = value
    .split(",")
    .map((part) => part.trim());
  return { cityName, countryName };
};
