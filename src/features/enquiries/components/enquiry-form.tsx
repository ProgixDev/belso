"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { submitEnquiryAction } from "../actions";
import type { EnquiryField, EnquiryResult } from "../types";

/**
 * The enquiry form (AC-6, AC-7).
 *
 * Built on `useActionState` and a real `<form action>`, so it submits and
 * repopulates without JavaScript. That is not a purity exercise: this form sits
 * at the bottom of a page carrying a 15-frame gallery, and the moment before
 * hydration is exactly when an impatient buyer types.
 *
 * All copy arrives as `labels` — the slice may not import the i18n slice, and
 * the action deliberately returns error *keys* rather than sentences so the
 * message can be in the language of the page (AC-7).
 */

export type EnquiryLabels = {
  title: string;
  name: string;
  email: string;
  phoneOptional: string;
  message: string;
  submit: string;
  sending: string;
  successTitle: string;
  successBody: string;
  referenceNote?: string;
  errors: Record<EnquiryField, string>;
  errorGeneric: string;
  errorThrottled: string;
};

function SubmitButton({ label, pending }: { label: string; pending: string }) {
  // `useFormStatus` has to read the status of a form it is *inside*, which is
  // why this is its own component rather than a branch in the parent.
  const { pending: isPending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={isPending}
      // `sm:w-auto` alone does nothing here: the form is a flex column, whose
      // items stretch to full width by default. `self-start` is what actually
      // lets the button shrink to its label.
      className="w-full sm:w-auto sm:self-start"
    >
      {isPending ? pending : label}
    </Button>
  );
}

export function EnquiryForm({
  labels,
  /** The listing being asked about. Absent on the general contact page. */
  reference,
  /** What the confirmation names back — the property title, or nothing. */
  subject,
  className,
}: {
  labels: EnquiryLabels;
  reference?: string;
  subject?: string;
  className?: string;
}) {
  const [state, formAction] = useActionState<EnquiryResult | null, FormData>(
    submitEnquiryAction,
    null,
  );

  if (state?.ok) {
    return (
      <div
        className={cn("border-border bg-muted/40 rounded-xl border p-6", className)}
        role="status"
        aria-live="polite"
      >
        <h2 className="text-lg font-semibold tracking-tight">{labels.successTitle}</h2>
        <p className="text-muted-foreground mt-2 text-sm">{labels.successBody}</p>
      </div>
    );
  }

  const errors = state?.ok === false ? state.fieldErrors : {};
  // Refill from what the visitor typed, so a rejected submit costs them one
  // correction rather than the whole form (AC-7).
  const values = state?.ok === false ? state.values : null;
  const errorFor = (field: EnquiryField) => (errors[field] ? labels.errors[field] : undefined);

  return (
    <form action={formAction} className={cn("flex flex-col gap-5", className)} noValidate>
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight">{labels.title}</h2>
        {reference && labels.referenceNote ? (
          <p className="text-muted-foreground text-sm">{labels.referenceNote}</p>
        ) : null}
      </div>

      {/* AC-6: the listing travels with the enquiry without the visitor typing it. */}
      {reference ? <input type="hidden" name="reference" value={reference} /> : null}
      {subject ? <input type="hidden" name="subject" value={subject} /> : null}

      <Field id="enquiry-name" label={labels.name} error={errorFor("name")} required>
        {(props) => (
          <Input {...props} name="name" defaultValue={values?.name ?? ""} autoComplete="name" />
        )}
      </Field>

      <Field id="enquiry-email" label={labels.email} error={errorFor("email")} required>
        {(props) => (
          <Input
            {...props}
            name="email"
            type="email"
            defaultValue={values?.email ?? ""}
            autoComplete="email"
          />
        )}
      </Field>

      <Field id="enquiry-phone" label={labels.phoneOptional} error={errorFor("phone")}>
        {(props) => (
          <Input
            {...props}
            name="phone"
            type="tel"
            defaultValue={values?.phone ?? ""}
            autoComplete="tel"
          />
        )}
      </Field>

      <Field id="enquiry-message" label={labels.message} error={errorFor("message")} required>
        {(props) => (
          <textarea
            {...props}
            name="message"
            rows={5}
            defaultValue={values?.message ?? ""}
            className="border-input placeholder:text-muted-foreground focus-visible:ring-ring focus-visible:ring-offset-background aria-invalid:border-destructive aria-invalid:ring-destructive/30 flex w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          />
        )}
      </Field>

      {state?.ok === false && state.formError ? (
        <p role="alert" className="text-destructive text-sm font-medium">
          {state.formError === "throttled" ? labels.errorThrottled : labels.errorGeneric}
        </p>
      ) : null}

      <SubmitButton label={labels.submit} pending={labels.sending} />
    </form>
  );
}
