"use client";

import type { ReactNode } from "react";
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";

// Shared field primitives for the candidature forms. They carry the design
// system's flat, hairline-underlined input style (see globals.css: no
// border-radius anywhere except pills) and the accessibility wiring — label
// association, aria-invalid, aria-describedby — so individual forms don't
// have to remember it per field.

export const inputClasses =
  "w-full bg-transparent border-b border-ink-dim/30 py-3 text-ink transition-all placeholder:text-ink-dim/50 focus:outline-none focus:border-terracotta focus:ring-1 focus:ring-terracotta aria-[invalid=true]:border-terracotta";
export const selectClasses = `${inputClasses} cursor-pointer`;
export const textareaClasses =
  "w-full resize-none bg-transparent border border-ink-dim/30 p-4 text-ink transition-all placeholder:text-ink-dim/50 focus:outline-none focus:border-terracotta focus:ring-1 focus:ring-terracotta aria-[invalid=true]:border-terracotta";
export const labelClasses =
  "block text-xs font-semibold uppercase tracking-[0.2em] text-ink-mid";
export const errorClasses = "text-xs text-terracotta";

function FieldShell({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className={labelClasses}>
        {label}
      </label>
      {children}
      {hint}
      {error && (
        <p id={`${id}-error`} className={errorClasses} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

type Registration = Record<string, unknown>;

export function TextField({
  id,
  label,
  placeholder,
  type = "text",
  error,
  hint,
  registration,
  inputMode,
}: {
  id: string;
  label: string;
  placeholder?: string;
  type?: string;
  error?: string;
  hint?: ReactNode;
  registration: Registration;
  inputMode?: "text" | "numeric" | "tel" | "email";
}) {
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        placeholder={placeholder}
        className={inputClasses}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        {...registration}
      />
    </FieldShell>
  );
}

export function SelectField({
  id,
  label,
  placeholder,
  options,
  error,
  hint,
  registration,
  defaultValue = "",
}: {
  id: string;
  label: string;
  placeholder: string;
  options: readonly { value: string; label: string }[];
  error?: string;
  hint?: ReactNode;
  registration: Registration;
  defaultValue?: string;
}) {
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <select
        id={id}
        defaultValue={defaultValue}
        className={selectClasses}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        {...registration}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function TextareaField({
  id,
  label,
  placeholder,
  rows = 6,
  error,
  hint,
  registration,
}: {
  id: string;
  label: string;
  placeholder?: string;
  rows?: number;
  error?: string;
  hint?: ReactNode;
  registration: Registration;
}) {
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <textarea
        id={id}
        rows={rows}
        placeholder={placeholder}
        className={textareaClasses}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        {...registration}
      />
    </FieldShell>
  );
}

/**
 * Yes/No radio group bound to a real boolean.
 *
 * Must NOT use `register(name, { setValueAs })`. React Hook Form's value
 * getter special-cases radio inputs — it returns `getRadioValue(refs).value`,
 * the raw string, and never runs it through `setValueAs`. A `z.boolean()`
 * field therefore received `"true"` and failed validation on every submit,
 * leaving "this field is required" showing under an answered question with
 * no way to proceed.
 *
 * `Controller` owns the value instead, so the string→boolean conversion
 * happens where it actually takes effect.
 */
export function BooleanRadioGroup<T extends FieldValues>({
  name,
  control,
  label,
  yesLabel,
  noLabel,
  error,
}: {
  name: FieldPath<T>;
  control: Control<T>;
  label: string;
  yesLabel: string;
  noLabel: string;
  error?: string;
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <fieldset className="space-y-3">
          <legend className={labelClasses}>{label}</legend>
          <div className="flex flex-wrap gap-x-8 gap-y-3 pt-1">
            {[
              { value: true, label: yesLabel },
              { value: false, label: noLabel },
            ].map((option) => (
              <label
                key={String(option.value)}
                className="flex cursor-pointer items-center gap-2 text-ink"
              >
                <input
                  type="radio"
                  name={field.name}
                  value={String(option.value)}
                  checked={field.value === option.value}
                  onChange={() => field.onChange(option.value)}
                  onBlur={field.onBlur}
                  className="h-4 w-4 accent-terracotta"
                  aria-invalid={!!error}
                  aria-describedby={error ? `${name}-error` : undefined}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          {error && (
            <p id={`${name}-error`} className={errorClasses} role="alert">
              {error}
            </p>
          )}
        </fieldset>
      )}
    />
  );
}

export function CheckboxField({
  id,
  label,
  error,
  registration,
}: {
  id: string;
  label: string;
  error?: string;
  registration: Registration;
}) {
  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-ink-mid"
      >
        <input
          id={id}
          type="checkbox"
          className="mt-1 h-4 w-4 shrink-0 accent-terracotta"
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          {...registration}
        />
        <span>{label}</span>
      </label>
      {error && (
        <p id={`${id}-error`} className={errorClasses} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Step progress indicator: "Étape 2 sur 3" plus a hairline segmented bar. */
export function StepProgress({
  current,
  total,
  label,
  stepTitle,
}: {
  current: number;
  total: number;
  label: string;
  stepTitle: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-blue">
          {label}
        </span>
        <span className="text-xs text-ink-dim">{stepTitle}</span>
      </div>
      <div
        className="flex gap-1"
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label={label}
      >
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`h-0.5 flex-1 transition-colors ${
              i < current ? "bg-terracotta" : "bg-ink-dim/20"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
