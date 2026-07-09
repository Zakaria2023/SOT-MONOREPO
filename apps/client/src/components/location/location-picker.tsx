"use client";

import {
  cityOptionsForCountry,
  countryOptions,
  findCountryIsoByName,
  findCountryNameByIso,
  formatLocation,
  parseLocation,
} from "@/lib/location";
import { MapPin } from "lucide-react";
import { useMemo, useState } from "react";
import { Combobox, FormError } from "ui";

type LocationPickerProps = {
  value: string;
  onChange: (value: string) => void;
  error?: string;
};

export const LocationPicker = ({
  value,
  onChange,
  error,
}: LocationPickerProps) => {
  const initial = parseLocation(value);
  const [countryIso, setCountryIso] = useState(() =>
    findCountryIsoByName(initial.countryName),
  );
  const [cityName, setCityName] = useState(() => initial.cityName);

  const cityOptions = useMemo(
    () => (countryIso ? cityOptionsForCountry(countryIso) : []),
    [countryIso],
  );

  const onCountryChange = (iso: string) => {
    setCountryIso(iso);
    // A city from the previous country no longer applies.
    setCityName("");
    onChange("");
  };

  const onCityChange = (city: string) => {
    setCityName(city);
    onChange(formatLocation(city, findCountryNameByIso(countryIso)));
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 text-sm font-semibold text-ink">
        <span className="text-primary">
          <MapPin size={16} />
        </span>
        Location
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Combobox
          value={countryIso}
          onChange={onCountryChange}
          options={countryOptions}
          placeholder="Country"
          searchPlaceholder="Search countries…"
          emptyMessage="No countries found"
        />
        <Combobox
          value={cityName}
          onChange={onCityChange}
          options={cityOptions}
          placeholder="City"
          searchPlaceholder="Search cities…"
          emptyMessage={
            countryIso ? "No cities found" : "Select a country first"
          }
          disabled={!countryIso}
        />
      </div>

      <FormError message={error} />
    </div>
  );
};
