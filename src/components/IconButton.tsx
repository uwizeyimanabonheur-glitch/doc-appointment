"use client";

// Square icon button used in table "Actions" columns.
// Always has an accessible label (aria-label + title tooltip).

type Variant = "default" | "primary" | "success" | "danger";

const VARIANTS: Record<Variant, string> = {
  default: "border-slate-300 text-slate-600 hover:bg-slate-100",
  primary: "border-brand text-brand hover:bg-brand/10",
  success: "border-emerald-300 text-emerald-600 hover:bg-emerald-50",
  danger: "border-red-200 text-red-600 hover:bg-red-50",
};

export default function IconButton({
  label,
  onClick,
  disabled,
  variant = "default",
  children,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: Variant;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md border bg-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]}`}
    >
      {children}
    </button>
  );
}
