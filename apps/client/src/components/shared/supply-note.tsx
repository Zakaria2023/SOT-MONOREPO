import type { SupplyVerdict } from "services";
import { Clock, TriangleAlert } from "lucide-react";

// P11, on whichever line is carrying it. In `shared` because the cart, the guest
// cart and the product page all need to say the same thing about the same fact,
// and three copies of the sentence is three chances for one of them to disagree
// with the gate that refuses the order.
//
// Takes the VERDICT, not the product's columns. Deciding here would mean the
// classifier — and with it the whole services barrel, mysql2 included — being
// pulled into the browser bundle by the two cart screens, which are client
// components. The server decides; this renders.
//
// Renders NOTHING for a plainly available product. A badge on every line reading
// "in stock" is noise that trains people to stop reading the line, which is
// exactly the wrong habit for the one line that says something else.

type SupplyNoteProps = {
  supply: SupplyVerdict;
};

export const SupplyNote = ({ supply }: SupplyNoteProps) => {
  if (supply.note === null) {
    return null;
  }

  return (
    <p
      className={`font-grotesk mt-1 flex items-center gap-1.5 text-xs ${
        supply.state === "unavailable" ? "text-red-600" : "text-amber-700"
      }`}
    >
      {supply.state === "unavailable" ? (
        <TriangleAlert size={12} className="shrink-0" />
      ) : (
        <Clock size={12} className="shrink-0" />
      )}
      {supply.note}
    </p>
  );
};
