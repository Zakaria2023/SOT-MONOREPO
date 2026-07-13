type BusinessLineChipsProps = {
  lines: string[] | null | undefined;
  className?: string;
};

// Display labels mirror db/label.ts BUSINESS_LINE_LABELS. The client has no
// @/db path alias, so — like the other storefront label maps — it's local.
const BUSINESS_LINE_LABELS: Record<string, string> = {
  consumer: "Consumer",
  smb_sme_channels: "SMB & SME Channels",
  smb_sme_projects: "SMB & SME Projects",
  enterprise: "Enterprise",
};

export const BusinessLineChips = ({
  lines,
  className = "",
}: BusinessLineChipsProps) => {
  if (!lines || lines.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {lines.map((line) => (
        <span
          key={line}
          className="inline-flex items-center rounded-full bg-primary-tint px-3 py-1 text-xs font-semibold text-primary"
        >
          {BUSINESS_LINE_LABELS[line] ?? line}
        </span>
      ))}
    </div>
  );
};
