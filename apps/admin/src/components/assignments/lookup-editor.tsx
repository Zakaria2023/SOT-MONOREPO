"use client";

import type { LookupRow } from "@/db/types";
import { Plus, Trash2 } from "lucide-react";
import { Dropdown, Input } from "ui";
import type { DropdownOption } from "ui";

type LookupEditorProps = {
  // The spec keys the table is keyed by, in column order.
  inputs: string[];
  rows: LookupRow[];
  // Every dropdown spec that could key the table: { value: key, label }.
  inputOptions: DropdownOption[];
  // The values each input spec offers, keyed by spec key.
  valuesByKey: Record<string, string[]>;
  // Unit of the measured spec, shown on the limit column.
  limitUnit: string | null | undefined;
  onChange: (inputs: string[], rows: LookupRow[]) => void;
};

export const LookupEditor = ({
  inputs,
  rows,
  inputOptions,
  valuesByKey,
  limitUnit,
  onChange,
}: LookupEditorProps) => {
  const labelFor = (key: string) =>
    inputOptions.find((option) => option.value === key)?.label ?? key;

  const addInput = (key: string) => {
    if (!key || inputs.includes(key)) {
      return;
    }
    onChange([...inputs, key], rows);
  };

  // Dropping a column also drops it from every row — a leftover condition on a
  // column nobody can see would silently stop rows matching.
  const removeInput = (key: string) =>
    onChange(
      inputs.filter((input) => input !== key),
      rows.map((row) => {
        const when = { ...row.when };
        delete when[key];
        return { ...row, when };
      }),
    );

  const addRow = () =>
    onChange(inputs, [...rows, { when: {}, limit: 0 }]);

  const removeRow = (index: number) =>
    onChange(
      inputs,
      rows.filter((_, position) => position !== index),
    );

  const setCell = (index: number, key: string, value: string) =>
    onChange(
      inputs,
      rows.map((row, position) =>
        position === index
          ? { ...row, when: { ...row.when, [key]: value } }
          : row,
      ),
    );

  const setLimit = (index: number, limit: number) =>
    onChange(
      inputs,
      rows.map((row, position) =>
        position === index ? { ...row, limit } : row,
      ),
    );

  return (
    <div className="flex flex-col gap-3 rounded-control border border-hairline p-4">
      <div>
        <p className="text-sm font-semibold text-ink">Lookup table</p>
        <p className="mt-0.5 text-sm text-muted">
          The limit is read from here, keyed by the item&apos;s own attribute
          values. Rows are tried top to bottom, so a specific row can sit above
          a catch-all. An item matching no row is left alone — that&apos;s a gap
          in the table, not a failure.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">Keyed by</span>
        {inputs.map((key) => (
          <span
            key={key}
            className="flex items-center gap-1 rounded-md bg-primary-tint px-2 py-1 text-sm font-medium text-primary"
          >
            {labelFor(key)}
            <button
              type="button"
              onClick={() => removeInput(key)}
              aria-label={`Remove ${labelFor(key)} column`}
              className="text-primary/70 transition-colors hover:text-primary"
            >
              <Trash2 size={12} />
            </button>
          </span>
        ))}
        <div className="w-56">
          <Dropdown
            searchable
            value=""
            onChange={addInput}
            placeholder="Add an attribute column…"
            options={inputOptions.filter(
              (option) => !inputs.includes(option.value),
            )}
          />
        </div>
      </div>

      {inputs.length === 0 ? (
        <p className="rounded-control border border-dashed border-hairline p-4 text-sm text-faint">
          Pick at least one attribute to key the table by — cable grade and
          link speed, for instance.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <thead>
              <tr className="border-b border-hairline text-left">
                {inputs.map((key) => (
                  <th
                    key={key}
                    className="px-2 py-2 text-sm font-semibold tracking-wide text-muted uppercase"
                  >
                    {labelFor(key)}
                  </th>
                ))}
                <th className="px-2 py-2 text-sm font-semibold tracking-wide text-muted uppercase">
                  Limit{limitUnit ? ` (${limitUnit})` : ""}
                </th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-b border-hairline">
                  {inputs.map((key) => (
                    <td key={key} className="px-2 py-2">
                      <div className="w-40">
                        <Dropdown
                          searchable
                          value={row.when[key] ?? ""}
                          onChange={(value) => setCell(index, key, value)}
                          placeholder="Any value…"
                          options={(valuesByKey[key] ?? []).map((value) => ({
                            value,
                            label: value,
                          }))}
                        />
                      </div>
                    </td>
                  ))}
                  <td className="px-2 py-2">
                    <div className="w-28">
                      <Input
                        type="number"
                        step="any"
                        value={String(row.limit)}
                        onChange={(event) =>
                          setLimit(index, Number(event.target.value))
                        }
                      />
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      aria-label={`Remove row ${index + 1}`}
                      className="rounded p-1.5 text-faint transition-colors hover:bg-page hover:text-danger"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button
        type="button"
        onClick={addRow}
        disabled={inputs.length === 0}
        className="flex w-fit items-center gap-1.5 rounded-control border border-hairline px-3 py-2 text-sm font-semibold text-ink transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus size={14} />
        Add row
      </button>
    </div>
  );
};
