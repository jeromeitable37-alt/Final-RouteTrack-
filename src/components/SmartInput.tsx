"use client";

import { useId } from "react";

export function SmartInput({
  label,
  value,
  options,
  onChange,
  placeholder,
  required,
  help,
  className,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  help?: string;
  className?: string;
}) {
  const id = useId().replaceAll(":", "");
  return (
    <label className={className}>
      {label}
      <input
        list={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
      />
      <datalist id={id}>{options.map((option) => <option value={option} key={option} />)}</datalist>
      {help && <span className="field-help">{help}</span>}
    </label>
  );
}
