# Privacy and store disclosures (working draft)

This document is an engineering inventory, not legal advice. Confirm it against production before submitting either store questionnaire.

## Data the app appears to collect

- Account identifiers: name, email address, Supabase user ID, and role
- User content: service requests, descriptions, city/country, and messages
- Purchase information: request fee, payment method/status, Stripe Checkout session metadata, and request ID
- Operational data: assigned agent, request status, timestamps, completion and payout information

## Purposes

- Account creation and authentication
- Delivering and administering requested real-world services
- Client-agent communication
- Payment processing and fraud prevention
- Customer support, record keeping, and legal compliance

## Processors visible in this repository

- Supabase: authentication, database, and potentially storage
- Stripe: payment processing
- Vercel: web hosting and serverless API hosting

## Submission cautions

- Do not claim that data is encrypted, not retained, or not linked to identity unless production configuration and contracts support that claim.
- Determine whether Vercel Analytics, Supabase logs, Stripe fraud tooling, or any other production service adds diagnostics, device identifiers, coarse location, or tracking.
- Add retention periods, deletion procedures, international-transfer language, controller identity, and a contact address to the public privacy policy after legal review.
- Both stores expect an accessible account-deletion path when an app supports account creation. Deleting only the local app or signing out is not sufficient.
