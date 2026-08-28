import type { EnquiryLabels } from "@/features/enquiries";
import { type Dictionary, interpolate } from "@/features/i18n";

/**
 * Bridges the dictionary to the enquiries slice.
 *
 * It lives in `app` because that is the only layer allowed to see both slices —
 * the form owns the interaction, the i18n slice owns the words, and neither may
 * import the other (docs/architecture/module-boundaries.md).
 *
 * `subject` is what the confirmation names back to the visitor (AC-6): the
 * property's title on a listing, nothing on the general contact page.
 */
export function enquiryLabels(
  dict: Dictionary,
  options: { reference?: string; subject?: string } = {},
): EnquiryLabels {
  const { reference, subject } = options;

  return {
    title: reference ? interpolate(dict.enquiry.titleFor, { reference }) : dict.enquiry.title,
    name: dict.enquiry.name,
    email: dict.enquiry.email,
    phoneOptional: dict.enquiry.phoneOptional,
    message: dict.enquiry.message,
    submit: dict.enquiry.submit,
    sending: dict.enquiry.sending,
    successTitle: dict.enquiry.successTitle,
    // Naming the property back is the whole point of AC-6's confirmation; with
    // no property there is nothing to name, so the general wording is used
    // rather than a sentence with a hole in it.
    successBody: subject
      ? interpolate(dict.enquiry.successBody, { subject })
      : dict.enquiry.successBodyGeneral,
    referenceNote: reference ? interpolate(dict.enquiry.referenceNote, { reference }) : undefined,
    errors: {
      name: dict.enquiry.errorName,
      email: dict.enquiry.errorEmail,
      phone: dict.enquiry.errorPhone,
      message: dict.enquiry.errorMessage,
    },
    errorGeneric: dict.enquiry.errorGeneric,
    errorThrottled: dict.enquiry.errorThrottled,
  };
}
