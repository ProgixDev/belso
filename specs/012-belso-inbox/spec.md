# Spec 012 — The agency is told when someone writes

- **Status:** draft
- **Type:** feature
- **Requested by / owner:** Houssem Ferrani
- **Date:** 2026-08-29
- **Slice / areas touched:** `src/features/enquiries` (reading, notification), routes `/admin/enquiries` <!-- used for conflict detection across active specs -->

## Problem (the why)

Spec 010 stopped the contact form discarding leads and put them in a table. Nobody reads that
table. The contact page tells every visitor **"réponse sous 24 heures"**, and the only mechanism
behind that promise is a person remembering to open an SSH tunnel and type SQL — which is to say,
no mechanism at all.

The painted door lost the lead immediately and visibly. This loses it quietly, which is worse:
the visitor believes an agent has their message, so they stop looking, and nobody ever learns the
enquiry existed. For a business whose entire proposition is being the agency that answers, an
unread enquiry is the most expensive object in the system.

Split from [spec 011](../011-belso-back-office/spec.md) because the notification needs a mail
provider nobody has chosen, and the client should not wait to publish a property while that
choice is made.

## Desired behavior (the what)

When a visitor sends an enquiry, **the agency is emailed**: who wrote, which property they were
looking at, and what they said, with a way to reply that lands in the visitor's inbox from an
address they recognise.

Signed in, she reads the enquiries in one place — newest first, each showing the listing it came
from — and marks one handled once she has replied. Handled ones stop competing for her attention
without disappearing.

**If the mail provider is down, the enquiry is still stored and the visitor is still told it
arrived.** The notification is a second promise, not a precondition; failing it must never turn
into losing the message. And an enquiry the provider failed to deliver must be sent later rather
than forgotten — otherwise "the mail was down for an hour" quietly means "nobody was ever told".

## Acceptance criteria

- **AC-1:** Given a visitor sends a valid enquiry, when it is stored, then the agency receives an
  email naming the sender, the listing reference if there is one, and the message.
- **AC-2:** Given the mail provider fails or times out, when a visitor sends an enquiry, then the
  enquiry is stored, the visitor is told it was received, and the failure is recorded so it can be
  retried — the visitor's experience must not change because our provider is unwell.
- **AC-3:** Given an enquiry that failed to notify, when the retry runs, then the agency is
  emailed and it is not sent a second time once it succeeds.
- **AC-4:** Given she is signed out, when she requests the inbox or posts to its actions, then
  both refuse and no enquiry data appears in the response.
- **AC-5:** Given an enquiry in the list, when she marks it handled, then it is distinguishable
  from the unhandled ones on her next visit, and marking it twice changes nothing.
- **AC-6:** Given the inbox, when she opens it, then enquiries are newest first and each shows
  which listing it concerns — including one whose listing has since been archived.
- **AC-7:** Given the mail is sent, then it contains no more personal data than the enquiry itself
  and is addressed only to the agency — never to the visitor, who has not asked to hear from a
  robot.

## Out of scope

- **Replying from the back-office.** She replies in her own mail client, where her signature and
  the conversation already are. This spec makes replying possible, not automated.
- **Templates, sequences, a CRM.** One email, to one address, when one enquiry arrives.
- **Notifying the visitor.** No autoresponder. The contact page already tells them it was
  received, and a second machine-written message adds nothing.
- **Deleting enquiries by hand.** Retention already expires them (spec 010); a delete button over
  someone's personal data is a separate decision with its own audit questions.
- **Search and filtering.** At the volume a private agency in Marrakech generates, newest-first
  and a handled marker is the whole product.

## CUJ impact

- Registers **CUJ-07 — Answer an enquiry**: receive the email → open the back-office → read the
  enquiry with its listing → mark it handled.
- Must leave CUJ-01, 03, 04, 05 and 06 unchanged.

## Open questions

- [ ] **Which mail provider, and who owns the account?** This is the site's first external runtime
      dependency and wants its own ADR, which must say what happens when it fails. The choice also
      decides whether replies come from an address the buyer recognises — which matters more to a
      luxury agency than deliverability statistics do.
- [ ] **Which address receives them?** One shared agency mailbox, or per-agent routing. Shared is
      the obvious start; per-agent needs a decision about who owns which listing that this product
      does not currently have.
- [ ] **The privacy notice still has no owner**, carried from spec 010 and now more pressing: this
      spec turns the enquiry table from something nothing reads into something a person reads
      daily, and emails its contents to a third party in transit.
- [ ] **Retention is assumed at 24 months from collection**; CNIL guidance for prospect data is
      three years from last contact. Unchanged from spec 010 and unaffected by the split.
