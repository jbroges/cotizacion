import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ id, label, error, className = "", ...props }: InputProps) {
  return (
    <label className="block space-y-1.5" htmlFor={id}>
      {label && <span className="text-sm font-medium text-slate-700">{label}</span>}
      <input
        id={id}
        className={`block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15 ${error ? "border-red-400 focus:border-red-500 focus:ring-red-500/15" : ""} ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </label>
  );
}
