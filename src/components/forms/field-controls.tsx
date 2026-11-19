import type {
  InputHTMLAttributes,
  ReactNode,
  Ref,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

/** Identifiant stable d'un champ : sert au label, aux messages et au focus sur erreur. */
export function fieldId(name: string): string {
  return `field-${name}`;
}

type BaseProps = {
  name: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  /** Les champs sont obligatoires par défaut ; on signale seulement les champs facultatifs. */
  optional?: boolean;
  className?: string;
};

function describedBy(id: string, hint: ReactNode, error?: string, extra?: string): string | undefined {
  const ids = [hint ? `${id}-hint` : "", error ? `${id}-error` : "", extra ?? ""].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

const ERROR_CLASS = "border-rose-500! focus:border-rose-600! focus:ring-rose-200!";
const SCROLL_CLASS = "scroll-mt-24 scroll-mb-32";

function FieldShell({
  id,
  label,
  hint,
  error,
  optional,
  className,
  children,
}: BaseProps & { id: string; children: ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="field-label">
        {label}
        {optional ? <span className="font-normal text-slate-600"> (facultatif)</span> : null}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="mt-0.5 text-sm text-slate-600">
          {hint}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm font-semibold text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type TextFieldProps = BaseProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, "name" | "id" | "required" | "className"> & {
    inputRef?: Ref<HTMLInputElement>;
    inputClassName?: string;
    /** Identifiants supplémentaires à relier au champ (aide, règles…). */
    describedByExtra?: string;
    /** Élément posé à droite, dans le champ (ex. bouton « Afficher »). */
    adornment?: ReactNode;
  };

export function TextField({
  name,
  label,
  hint,
  error,
  optional,
  className,
  inputRef,
  inputClassName,
  describedByExtra,
  adornment,
  ...rest
}: TextFieldProps) {
  const id = fieldId(name);
  const input = (
    <input
      {...rest}
      ref={inputRef}
      id={id}
      name={name}
      aria-required={optional ? undefined : true}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy(id, hint, error, describedByExtra)}
      className={`field ${SCROLL_CLASS} ${error ? ERROR_CLASS : ""} ${inputClassName ?? ""}`}
    />
  );
  return (
    <FieldShell id={id} name={name} label={label} hint={hint} error={error} optional={optional} className={className}>
      {adornment ? (
        <div className="relative">
          {input}
          <div className="absolute inset-y-0 right-1.5 flex items-center pt-1">{adornment}</div>
        </div>
      ) : (
        input
      )}
    </FieldShell>
  );
}

type TextAreaFieldProps = BaseProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "name" | "id" | "required" | "className">;

export function TextAreaField({ name, label, hint, error, optional, className, ...rest }: TextAreaFieldProps) {
  const id = fieldId(name);
  return (
    <FieldShell id={id} name={name} label={label} hint={hint} error={error} optional={optional} className={className}>
      <textarea
        {...rest}
        id={id}
        name={name}
        aria-required={optional ? undefined : true}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={`field ${SCROLL_CLASS} ${error ? ERROR_CLASS : ""}`}
      />
    </FieldShell>
  );
}

type SelectFieldProps = BaseProps &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, "name" | "id" | "required" | "className">;

export function SelectField({ name, label, hint, error, optional, className, children, ...rest }: SelectFieldProps) {
  const id = fieldId(name);
  return (
    <FieldShell id={id} name={name} label={label} hint={hint} error={error} optional={optional} className={className}>
      <select
        {...rest}
        id={id}
        name={name}
        aria-required={optional ? undefined : true}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={`field ${SCROLL_CLASS} ${error ? ERROR_CLASS : ""}`}
      >
        {children}
      </select>
    </FieldShell>
  );
}
