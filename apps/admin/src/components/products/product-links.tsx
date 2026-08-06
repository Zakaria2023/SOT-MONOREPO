"use client";

import {
  addCompatibility,
  addComposition,
  removeCompatibility,
  removeComposition,
} from "@/app/(dashboard)/products/action";
import { Field } from "@/components/shared/field";
import { Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import type { CompatibilityLink, CompositionLink } from "services";
import { Button, Checkbox, Dropdown, FormError, Input } from "ui";

// ---------------------------------------------------------------------------
// The two facts that are about TWO PRODUCTS rather than about one.
//
// Both tables were readable by the engine and writable by nobody, which is worse
// than not having them: the check ran, found nothing, and reported a clean
// design — indistinguishable from a design that was actually clean.
//
// They live on the product's own page rather than on the edit form, because they
// save on their own. Folded into that form they would share its dirty state and
// its single Save, so adding one part would mean committing every other unsaved
// change on the page at the same time.
//
// Deliberately NOT a bulk editor. The whole point of the compatibility list is
// that it stays small — everything derivable belongs in a rule, where it keeps
// working for the next product nobody has added yet. A screen built for entering
// hundreds of rows would be an invitation to do exactly the thing the model
// exists to avoid.
// ---------------------------------------------------------------------------

type LinkableProduct = { uuid: string; name: string; sku: string | null };

type ProductLinksProps = {
  productUuid: string;
  productName: string;
  compatibility: CompatibilityLink[];
  composition: CompositionLink[];
  linkable: LinkableProduct[];
};

const productOptions = (products: LinkableProduct[]) =>
  products.map((product) => ({
    value: product.uuid,
    label: product.sku ? `${product.name} · ${product.sku}` : product.name,
  }));

const VERDICT_OPTIONS = [
  { value: "incompatible", label: "Does NOT work with it" },
  { value: "compatible", label: "Works with it" },
];

/** A card with a title, matching the rest of the detail page. */
const Card = ({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col gap-4 rounded-card border border-hairline bg-surface p-6 shadow-[0_1px_2px_rgba(27,35,51,0.04)]">
    <div className="flex flex-col gap-1">
      <h2 className="font-heading text-lg text-ink">{title}</h2>
      <p className="text-xs text-muted">{hint}</p>
    </div>
    {children}
  </div>
);

export const ProductLinks = ({
  productUuid,
  productName,
  compatibility,
  composition,
  linkable,
}: ProductLinksProps) => {
  const options = productOptions(linkable);
  const [pending, startTransition] = useTransition();

  const [pairOpen, setPairOpen] = useState(false);
  const [pairOther, setPairOther] = useState("");
  const [pairVerdict, setPairVerdict] = useState("incompatible");
  const [pairNote, setPairNote] = useState("");
  const [pairSource, setPairSource] = useState("");
  const [pairError, setPairError] = useState("");

  const [partOpen, setPartOpen] = useState(false);
  const [partChild, setPartChild] = useState("");
  const [partQuantity, setPartQuantity] = useState("1");
  const [partIncluded, setPartIncluded] = useState(true);
  const [partNote, setPartNote] = useState("");
  const [partError, setPartError] = useState("");

  const savePair = (): void => {
    setPairError("");
    startTransition(async () => {
      const result = await addCompatibility({
        productUuidA: productUuid,
        productUuidB: pairOther,
        verdict: pairVerdict === "compatible" ? "compatible" : "incompatible",
        note: pairNote.trim() || null,
        source: pairSource,
      });
      if (result.error) {
        setPairError(result.error);
        return;
      }
      setPairOpen(false);
      setPairOther("");
      setPairNote("");
      setPairSource("");
    });
  };

  const savePart = (): void => {
    setPartError("");
    startTransition(async () => {
      const result = await addComposition({
        parentUuid: productUuid,
        childUuid: partChild,
        quantity: Number(partQuantity),
        included: partIncluded,
        note: partNote.trim() || null,
      });
      if (result.error) {
        setPartError(result.error);
        return;
      }
      setPartOpen(false);
      setPartChild("");
      setPartQuantity("1");
      setPartIncluded(true);
      setPartNote("");
    });
  };

  return (
    <>
      <Card
        title="Works with / does not work with"
        hint="Only for pairs no attribute can explain — a bracket that fits one casing, an antenna the datasheet gets wrong. Anything that follows from a spec belongs in a rule instead, where it keeps working for products nobody has added yet."
      >
        {compatibility.length === 0 ? (
          <p className="text-sm text-faint">
            Nothing recorded. That is the normal state.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {compatibility.map((link) => (
              <li
                key={link.uuid}
                className="flex flex-wrap items-start justify-between gap-2 rounded-card border border-hairline bg-hover/40 p-3"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm text-ink">
                    <span
                      className={
                        link.verdict === "incompatible"
                          ? "font-medium text-red-500"
                          : "font-medium text-success"
                      }
                    >
                      {link.verdict === "incompatible"
                        ? "Does not work with"
                        : "Works with"}
                    </span>{" "}
                    {link.other.name}
                  </span>
                  {link.note && (
                    <span className="text-xs text-muted">{link.note}</span>
                  )}
                  <span className="text-[11px] text-faint">
                    {link.source}
                    {/* A pair is one fact seen from both ends. Saying which end
                        it was written from stops somebody "adding" the mirror
                        image and meeting a refusal they cannot explain. */}
                    {link.reversed && ` · recorded on ${link.other.name}`}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await removeCompatibility(link.uuid, productUuid);
                    })
                  }
                  aria-label={`Remove the pair with ${link.other.name}`}
                  className="shrink-0 rounded-control p-1.5 text-faint hover:bg-hover hover:text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {pairOpen ? (
          <div className="flex flex-col gap-3 rounded-card border border-primary/40 p-3">
            <Field label="The other product">
              <Dropdown
                value={pairOther}
                onChange={setPairOther}
                options={options}
                placeholder="Pick a product"
                searchable
              />
            </Field>
            <Field label={`${productName}…`}>
              <Dropdown
                value={pairVerdict}
                onChange={setPairVerdict}
                options={VERDICT_OPTIONS}
              />
            </Field>
            <Input
              label="Why (shown to the buyer)"
              placeholder="The antenna does not fit this hub's casing."
              value={pairNote}
              onChange={(event) => setPairNote(event.target.value)}
            />
            {/* Required, and the service refuses without it. A pair nobody can
                trace is one nobody can re-check when the brand publishes a new
                compatibility list. */}
            <Input
              label="Where this came from"
              placeholder="Ajax device compatibility PDF 2026-08-06"
              value={pairSource}
              onChange={(event) => setPairSource(event.target.value)}
            />
            <FormError message={pairError} />
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={savePair}
                disabled={
                  pending || pairOther === "" || pairSource.trim() === ""
                }
              >
                {pending ? "Saving…" : "Record it"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setPairOpen(false);
                  setPairError("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPairOpen(true)}
            className="flex w-fit items-center gap-1 rounded-control px-2 py-1 text-xs text-primary hover:bg-hover"
          >
            <Plus size={13} />
            Record a pair
          </button>
        )}
      </Card>

      <Card
        title="In the box / sold separately"
        hint="What ships with this product, and what it needs that does not. A part marked sold separately warns the buyer when their basket is short of it."
      >
        {composition.length === 0 ? (
          <p className="text-sm text-faint">Nothing listed.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {composition.map((part) => (
              <li
                key={part.uuid}
                className="flex flex-wrap items-start justify-between gap-2 rounded-card border border-hairline bg-hover/40 p-3"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm text-ink">
                    {part.quantity} × {part.child.name}
                  </span>
                  <span
                    className={
                      part.included
                        ? "text-xs text-success"
                        : "text-xs text-amber-500"
                    }
                  >
                    {part.included ? "In the box" : "Sold separately"}
                  </span>
                  {part.note && (
                    <span className="text-xs text-muted">{part.note}</span>
                  )}
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await removeComposition(part.uuid, productUuid);
                    })
                  }
                  aria-label={`Remove ${part.child.name}`}
                  className="shrink-0 rounded-control p-1.5 text-faint hover:bg-hover hover:text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {partOpen ? (
          <div className="flex flex-col gap-3 rounded-card border border-primary/40 p-3">
            <Field label="The part">
              <Dropdown
                value={partChild}
                onChange={setPartChild}
                options={options}
                placeholder="Pick a product"
                searchable
              />
            </Field>
            <Input
              label="How many"
              type="number"
              min={1}
              value={partQuantity}
              onChange={(event) => setPartQuantity(event.target.value)}
            />
            {/* Default ON, matching the column. The ordinary row is a bundle
                listing its contents, and the safe default is the one that claims
                nothing is missing — the opposite would turn every half-entered
                bundle into a basket full of warnings. */}
            <Checkbox
              label="Comes in the box"
              checked={partIncluded}
              onChange={(event) => setPartIncluded(event.target.checked)}
            />
            <Input
              label="Why it is needed"
              placeholder="The Holder is what fixes the button to a wall."
              value={partNote}
              onChange={(event) => setPartNote(event.target.value)}
            />
            <FormError message={partError} />
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={savePart}
                disabled={pending || partChild === ""}
              >
                {pending ? "Saving…" : "Add part"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setPartOpen(false);
                  setPartError("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPartOpen(true)}
            className="flex w-fit items-center gap-1 rounded-control px-2 py-1 text-xs text-primary hover:bg-hover"
          >
            <Plus size={13} />
            Add a part
          </button>
        )}
      </Card>
    </>
  );
};
