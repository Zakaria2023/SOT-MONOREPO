import { Plus } from "lucide-react";
import Link from "next/link";

type PageHeaderProps = {
  title: string;
  // Sits under the title. Only some screens carry one — a list whose columns
  // explain themselves does not need a sentence saying so.
  description?: string;
  // The screen's one primary action. Every current use is a link to a create
  // form, so it is typed as one rather than taking arbitrary children: the
  // point of this component is that the button cannot drift page to page.
  action?: { href: string; label: string };
};

// The heading row every dashboard screen opens with. It existed eleven times,
// spelled three ways — title alone, title over a description, title beside an
// Add button — with the button's nine classes copied out in full each time.
export const PageHeader = ({ title, description, action }: PageHeaderProps) => (
  <div className="flex items-center justify-between gap-4">
    <div className="flex flex-col gap-1">
      <h1 className="font-heading text-2xl text-ink">{title}</h1>
      {description && <p className="text-sm text-muted">{description}</p>}
    </div>

    {action && (
      <Link
        href={action.href}
        className="flex shrink-0 items-center gap-1.5 rounded-control bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
      >
        <Plus size={16} />
        {action.label}
      </Link>
    )}
  </div>
);
