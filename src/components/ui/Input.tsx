import { cn } from "@/lib/utils";

interface InputProps extends React.ComponentPropsWithoutRef<"input"> {
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  inputClassName?: string;
  ref?: React.Ref<HTMLInputElement>;
}

/** Hairline-bordered input with optional leading/trailing slots. */
export function Input({
  leading,
  trailing,
  className,
  inputClassName,
  ref,
  ...props
}: InputProps) {
  return (
    <div
      className={cn(
        "group flex h-11 items-center gap-2.5 rounded-full border border-line bg-white px-4 shadow-soft transition-colors focus-within:border-accent/60 focus-within:ring-4 focus-within:ring-accent/10",
        className,
      )}
    >
      {leading && <span className="text-silver">{leading}</span>}
      <input
        ref={ref}
        className={cn(
          "min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-silver focus:outline-none",
          inputClassName,
        )}
        {...props}
      />
      {trailing}
    </div>
  );
}

interface TextareaProps extends React.ComponentPropsWithoutRef<"textarea"> {
  ref?: React.Ref<HTMLTextAreaElement>;
}

export function Textarea({ className, ref, ...props }: TextareaProps) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink placeholder:text-silver shadow-soft transition-colors focus:border-accent/60 focus:outline-none focus:ring-4 focus:ring-accent/10",
        className,
      )}
      {...props}
    />
  );
}
