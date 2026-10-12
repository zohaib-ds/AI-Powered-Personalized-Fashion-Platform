# Tee Studio

Design a free-size T-shirt in 3D, order one piece, get it printed in Delhi and delivered by Ekart.

## What's in it

- **3D editor** (`/`): rotate the shirt, pick a colour, add images and text to the front or back, drag prints on the shirt, live price.
- **Checkout**: delivery details (Delhi pincodes only), then a **sample payment** that marks the order paid. No money is charged.
- **Print files**: the browser renders each printed side as a transparent PNG at 300 DPI and uploads it with the order.
- **Order page** (`/order/<id>`): the customer's receipt and status.
- **Admin** (`/admin`): every order with print-file downloads, printer, Ekart tracking and status. Password protected.

## Setup (one time)

1. **Supabase**: open your project → SQL Editor → paste `supabase/schema.sql` → Run.
2. **Vercel**: import this GitHub repo, then add these environment variables (Supabase → Project settings → API):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_PASSWORD` (any password; use it at `/admin` with any username)
3. Deploy. Every push to `main` redeploys.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in the three values
npm run dev
```

## Where to change things

| What | File |
| --- | --- |
| Brand name, logo, tagline | `lib/brand.ts` (logo file goes in `public/`) |
| Prices and delivery fee | `lib/pricing.ts` |
| Shirt colours, print area size | `lib/design.ts` |
| Real payment gateway | `lib/payments.ts` and `app/api/orders/[id]/pay/route.ts` |
