"use client";

import { useEffect, useMemo, useState } from "react";
import type { ProjectAnswersInput } from "validators";
import {
  checkCartDesign,
  type DesignFinding,
  type DesignQuestion,
} from "./actions";

type SelectionLine = {
  productUuid: string;
  quantity: number;
};

type DesignState = {
  blockers: DesignFinding[];
  warnings: DesignFinding[];
  // Checks that could not run. The service has always returned these and the
  // state was already carrying them at runtime — the type just did not say so,
  // so no caller could reach them and the buyer never saw one.
  unknowns: DesignFinding[];
  // Project questions this basket needs answered. The engine has always refused
  // to run a rule whose input was unanswered and said so in the finding, but
  // nothing collected the answer, so the buyer was told to "tell us X" with
  // nowhere to tell us.
  questions: DesignQuestion[];
};

const EMPTY: DesignState = {
  blockers: [],
  warnings: [],
  unknowns: [],
  questions: [],
};

/**
 * Debounced design check over the current cart lines — requires-companion
 * (Presence) plus compatibility rules. Quantities change in quick bursts
 * (+/- steppers), so it waits for the cart to settle before calling the engine.
 * Returns blockers (must fix), warnings (advisory), the checks that could not be
 * run at all — the last of which must never be mistaken for a pass — and the
 * questions whose answers would change any of them.
 *
 * Answers re-run the check through the same debounce as the lines: a magnitude is
 * typed digit by digit, and a request per keystroke would put the connection pool
 * under a load one buyer should not be able to create.
 */
export const useCompatibility = (
  lines: SelectionLine[],
  answers: ProjectAnswersInput = {},
): DesignState => {
  const [state, setState] = useState<DesignState>(EMPTY);

  // One entry per product, quantities summed — a product can appear both as
  // a solution line and an individual line.
  const selectionKey = useMemo(() => {
    const byProduct = new Map<string, number>();
    for (const line of lines) {
      byProduct.set(
        line.productUuid,
        (byProduct.get(line.productUuid) ?? 0) + line.quantity,
      );
    }
    return [...byProduct.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([productUuid, quantity]) => `${productUuid}:${quantity}`)
      .join(",");
  }, [lines]);

  // Keyed on the answers themselves rather than the object identity, so a parent
  // re-render with the same answers does not re-check.
  const answersKey = useMemo(
    () =>
      Object.entries(answers)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([uuid, value]) => `${uuid}=${value}`)
        .join(","),
    [answers],
  );

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (!selectionKey) {
        setState(EMPTY);
        return;
      }
      const selection = selectionKey.split(",").map((entry) => {
        const [productUuid, quantity] = entry.split(":");
        return { productUuid, quantity: Number(quantity) };
      });
      const variables: ProjectAnswersInput = {};
      for (const entry of answersKey ? answersKey.split(",") : []) {
        const [uuid, raw] = entry.split("=");
        // Rebuilt from the key, so the types have to come back as they went in:
        // handing the engine the string "12" for a number it compares would fail
        // the comparison rather than the check.
        variables[uuid] =
          raw === "true" ? true : raw === "false" ? false : Number(raw);
      }
      void checkCartDesign(selection, variables).then((result) => {
        if (active) {
          setState(result);
        }
      });
    }, 400);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [selectionKey, answersKey]);

  return state;
};
