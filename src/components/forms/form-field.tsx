import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export const formLabelClass = "block";
export const formInputClass = "field";

type FormFieldProps = {
  label: string;
  children: ReactNode;
  className?: string;
  /** Aide courte affichée sous le champ. */
  hint?: string;
};

export function FormField({ label, children, className, hint }: FormFieldProps) {
  return (
    <label className={`${formLabelClass}${className ? ` ${className}` : ""}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-slate-600">{hint}</span> : null}
    </label>
  );
}

export function FormInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${formInputClass}${props.className ? ` ${props.className}` : ""}`} />;
}

export function FormSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${formInputClass}${props.className ? ` ${props.className}` : ""}`} />;
}

export function FormTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${formInputClass}${props.className ? ` ${props.className}` : ""}`} />;
}
