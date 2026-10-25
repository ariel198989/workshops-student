import type { InputHTMLAttributes } from 'react';
import k from './kit.module.css';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label: string;
  inputClassName?: string;
}

/** Labelled 52px input; the label wraps the input so taps on the text focus it. */
export function TextField({ label, inputClassName, ...input }: TextFieldProps) {
  return (
    <label className={k.field}>
      <span className={k.label}>{label}</span>
      <input {...input} className={inputClassName} />
    </label>
  );
}
