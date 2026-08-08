import { classifySupply, type BoqDetailItem } from "services";
import { Clock, TriangleAlert } from "lucide-react";

// P11 on a BOQ line, for the person about to put a price on it.
//
// A free-text or service line has no product, so `productIsAvailable` is null and
// there is nothing to say — those are labour and notes, which have no stock to
// have run out of. Treating a null as unavailable would flag every service line
// on every quote.

type BoqLineSupplyProps = {
  item: BoqDetailItem;
};

export const BoqLineSupply = ({ item }: BoqLineSupplyProps) => {
  if (item.productIsAvailable === null) {
    return null;
  }

  const { state, note } = classifySupply({
    status: item.productStatus,
    isAvailable: item.productIsAvailable,
  });
  if (note === null) {
    return null;
  }

  return (
    <p
      className={`mt-1 flex items-center gap-1.5 text-xs ${
        state === "unavailable" ? "text-red-600" : "text-amber-700"
      }`}
    >
      {state === "unavailable" ? (
        <TriangleAlert size={12} className="shrink-0" />
      ) : (
        <Clock size={12} className="shrink-0" />
      )}
      {state === "unavailable"
        ? `Cannot be supplied — ${note.charAt(0).toLowerCase()}${note.slice(1)} Quoting this will block the order.`
        : note}
    </p>
  );
};
