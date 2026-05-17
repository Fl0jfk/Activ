import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export const formLabelClass = "flex flex-col gap-1 text-sm font-medium text-slate-700";
export const formInputClass = "rounded-xl border border-slate-300 px-3 py-2 font-normal";

type FormFieldProps = {
  label: string;
  children: ReactNode;
  className?: string;
};

export function FormField({ label, children, className }: FormFieldProps) {
  return (
    <label className={`${formLabelClass}${className ? ` ${className}` : ""}`}>
      {label}
      {children}
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
