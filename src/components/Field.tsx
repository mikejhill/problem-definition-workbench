import { useState, type ReactNode } from "react";

type TextFieldProps = {
  readonly label: string;
  readonly value: string;
  readonly onCommit: (value: string) => void;
  readonly multiline?: boolean;
  readonly placeholder?: string;
  readonly hint?: string;
  readonly required?: boolean;
  readonly children?: ReactNode;
};

export function TextField({
  label,
  value,
  onCommit,
  multiline = false,
  placeholder,
  hint,
  required,
  children,
}: TextFieldProps) {
  return (
    <TextFieldDraft
      key={value}
      label={label}
      value={value}
      onCommit={onCommit}
      multiline={multiline}
      {...(placeholder === undefined ? {} : { placeholder })}
      {...(hint === undefined ? {} : { hint })}
      {...(required === undefined ? {} : { required })}
    >
      {children}
    </TextFieldDraft>
  );
}

function TextFieldDraft({
  label,
  value,
  onCommit,
  multiline = false,
  placeholder,
  hint,
  required,
  children,
}: TextFieldProps) {
  const [draft, setDraft] = useState(value);
  const commit = () => {
    if (draft !== value && (!required || draft.trim())) onCommit(draft);
  };
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </span>
      {multiline ? (
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          placeholder={placeholder}
          rows={7}
        />
      ) : (
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          placeholder={placeholder}
          required={required}
        />
      )}
      {hint ? <span className="field-hint">{hint}</span> : null}
      {children}
    </label>
  );
}

type SelectFieldProps<T extends string> = {
  readonly label: string;
  readonly value: T;
  readonly options: readonly { readonly value: T; readonly label: string }[];
  readonly onChange: (value: T) => void;
};

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: SelectFieldProps<T>) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
