import type { InputHTMLAttributes } from "react";
import { forwardRef } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = "", ...props },
  ref
) {
  return <input ref={ref} className={`convive-input ${className}`.trim()} {...props} />;
});

