/**
 * Small counts spelled out, the way running text does it: "Four families", not
 * "4 families".
 *
 * Only up to twelve, which is where every style guide draws the line and also
 * where the words stop being shorter than the numeral.
 */
const WORDS = [
  "No",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
] as const;

/** "Four families" / "13 families" / "One family". */
export const countIn = (count: number, singular: string, plural: string) => {
  const noun = count === 1 ? singular : plural;
  const word =
    count >= 0 && count < WORDS.length ? WORDS[count] : String(count);
  return `${word} ${noun}`;
};
