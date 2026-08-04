import { Kicker } from "@/components/ui/editorial";

type EyebrowProps = {
  label: string;
};

/**
 * Kept as a name so the screens that already say `Eyebrow` keep reading, but it
 * is the editorial Kicker now: a short gold rule and letterspaced gold caps.
 *
 * The old version was a filled accent dot beside 13px bold uppercase — a dot is a
 * bullet, and it read as a list item rather than as a section opening.
 */
export const Eyebrow = ({ label }: EyebrowProps) => <Kicker label={label} />;
