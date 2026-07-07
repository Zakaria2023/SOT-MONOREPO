import { cn } from "@/lib/utils";
import type { ComponentType } from "react";

type IconType = ComponentType<{ size?: number; className?: string }>;

type FieldLabelProps = {
  htmlFor: string;
  label: string;
  required?: boolean;
};

type TextFieldProps = {
  id: string;
  name: string;
  label: string;
  placeholder: string;
  icon: IconType;
  type?: string;
  required?: boolean;
  autoComplete?: string;
};

type TextareaFieldProps = {
  id: string;
  name: string;
  label: string;
  placeholder: string;
  rows?: number;
  required?: boolean;
};

const inputBase =
  "font-grotesk peer w-full rounded-xl border border-[#E3E4E9] bg-white text-sm text-ink transition-all placeholder:text-[#9A9DA5] focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15";

const FieldLabel = ({ htmlFor, label, required }: FieldLabelProps) => (
  <label
    htmlFor={htmlFor}
    className="font-grotesk mb-2 block text-xs font-semibold text-ink"
  >
    {label}
    {required && <span className="text-primary"> *</span>}
  </label>
);

export const TextField = ({
  id,
  name,
  label,
  placeholder,
  icon: Icon,
  type = "text",
  required,
  autoComplete,
}: TextFieldProps) => (
  <div>
    <FieldLabel htmlFor={id} label={label} required={required} />
    <div className="relative">
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className={cn(inputBase, "py-3 pl-10 pr-3.5")}
      />
      <Icon
        size={16}
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A8F98] transition-colors peer-focus:text-primary"
      />
    </div>
  </div>
);

export const TextareaField = ({
  id,
  name,
  label,
  placeholder,
  rows = 3,
  required,
}: TextareaFieldProps) => (
  <div>
    <FieldLabel htmlFor={id} label={label} required={required} />
    <textarea
      id={id}
      name={name}
      rows={rows}
      required={required}
      placeholder={placeholder}
      className={cn(inputBase, "resize-y px-3.5 py-3 leading-relaxed")}
    />
  </div>
);
