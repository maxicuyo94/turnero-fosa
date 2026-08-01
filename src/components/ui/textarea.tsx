import type { TextareaHTMLAttributes } from "react";
import { cn } from "./cn";
import { inputBaseClass } from "./text-input";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

/**
 * Multi-line input styled to match `TextInput`, with a comfortable minimum height.
 */
export function Textarea({ className, ...rest }: TextareaProps) {
  return <textarea className={cn(inputBaseClass, "min-h-24 px-4 py-3", className)} {...rest} />;
}
