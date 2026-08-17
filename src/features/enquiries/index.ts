/**
 * Public API of the enquiries slice — the only file other layers may import
 * (docs/architecture/module-boundaries.md).
 */

export { EnquiryForm, type EnquiryLabels } from "./components/enquiry-form";
export { submitEnquiryAction } from "./actions";
export { enquirySchema } from "./types";
export type { EnquiryField, EnquiryInput, EnquiryResult, EnquiryValues } from "./types";
