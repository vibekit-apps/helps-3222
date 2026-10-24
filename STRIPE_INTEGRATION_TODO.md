# Stripe Checkout integration

## Values to Replace

No placeholder values are present in the existing Checkout call.

**Files containing the live subscription configuration:**
- [server.js](server.js)

| Field | Current Value | What to Set |
|---|---|---|
| mode | `subscription` | This matches the weekly, monthly, and yearly recurring plans. Keep it unless the product changes to one-time purchases. |
| successUrl | App origin with `?paid=1&plan=<plan>` | A real app return URL is already generated from the current request origin. Add payment confirmation handling before using subscription status to gate premium content. |
| cancelUrl | App origin with `?billing=cancelled` | A real app return URL is already generated from the current request origin. |
| items | Inline plan name, amount, USD, and interval | These are the active weekly ($9), monthly ($29), and yearly ($249) subscription definitions. Replace with Stripe Price IDs only if the catalog moves into Stripe Dashboard-managed products. |

## Configured Parameters

**Files containing these parameters:**
- [server.js](server.js)

| Parameter | Value |
|---|---|
| ui_mode | `hosted_page` |
| billing_address_collection | `auto` |
| phone_number_collection.enabled | `true` |
| automatic_tax.enabled | `false` |
| allow_promotion_codes | `false` |
| payment_method_collection | `always` |
| submit_type | `auto` |
| consent_collection.terms_of_service | `required` |
| consent_collection.promotions | `auto` |
| name_collection.individual.enabled | `true` |
| name_collection.individual.optional | `true` |
| name_collection.business.enabled | `true` |
| name_collection.business.optional | `true` |
| saved_payment_method_options.payment_method_save | `enabled` |
| integration_identifier | `hosted_mobile_app_0001` |
| origin_context | `mobile_app` |

## Setup and next steps

- Stripe is connected through VibeKit, so no Stripe API key is stored in this repository.
- The app creates a Hosted Stripe Checkout subscription through `POST /api/payments/checkout` in `server.js`, then opens the returned URL in the customer’s browser.
- Confirming payment is handled by `POST /api/payments/confirm`; call it with the returned Checkout Session ID before relying on subscription status to unlock paid-only features.
- Test checkout in Stripe test mode with `4242 4242 4242 4242`, any future expiry date, and any three-digit CVC. Do not use a real card while testing.
- Before public launch, complete one end-to-end test for each subscription interval, including successful payment, cancellation, and a return to the app.
- Add a terms-of-service page before launch because Checkout now requires acceptance of terms.
- Decide which screens or actions require a paid subscription, then enforce that server-side after payment confirmation.

## Project structure

- `server.js` — existing payment status, checkout, and payment-confirmation endpoints.
- `STRIPE_INTEGRATION_TODO.md` — this setup and testing checklist.

## Resources

- https://support.stripe.com
- https://docs.stripe.com/mcp
