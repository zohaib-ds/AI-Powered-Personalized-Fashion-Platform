# WearSketch

Design a free-size T-shirt on a real 3D model, order one piece, get it printed in Delhi and delivered by Ekart.

## Pages

| Page | What it is |
| --- | --- |
| `/` | Home: spinning 3D shirt, how it works, print areas, pricing, FAQ |
| `/studio` | 3D design studio: draw, add text and images on the front, back and both sleeves, live price, checkout |
| `/order/<id>` | The customer's receipt, progress tracker and review form |
| `/track` | Find an order by its number and phone |
| `/help`, `/policies`, `/about` | FAQ and contact, shipping/reprint/privacy, story |
| `/printer` | Printer portal: each print partner signs in with an access code and sees their orders, print files, delivery address and customer reviews |
| `/admin` | Owner view (password): all orders, assign printers, add printers, reviews |

## Setup (one time)

1. **Supabase**: open your project → SQL Editor → paste `supabase/schema.sql` → Run. It is safe to run again after updates.
2. **Vercel**: add these environment variables (Supabase → Project settings → API keys):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (the secret key)
   - `ADMIN_PASSWORD` (any password; use it at `/admin` with any username)
3. Deploy. Every push to `main` redeploys.
4. In `/admin` → Printers, add each print partner and send them their access code and the `/printer` link.

## Order flow

Customer pays (sample payment for now) → order shows in `/admin` as **Paid** → you pick a printer → it appears in that printer's portal → printer downloads the 300 DPI PNGs, prints, ships with Ekart and adds the tracking number → customer sees each step and can leave a review → the printer and admin see the review.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in the three values
npm run dev
```

## Where to change things

| What | File |
| --- | --- |
| Brand name, logo, support email and WhatsApp | `lib/brand.ts` (logo file goes in `public/`) |
| Printer rates, delivery fee, 15% margin | `lib/pricing.ts` |
| Shirt colours, fonts, print area sizes | `lib/design.ts` |
| Real payment gateway | `lib/payments.ts` and `app/api/orders/[id]/pay/route.ts` |
| The 3D shirt model | `public/models/tee-mesh.json`, loaded by `lib/studio/shirt.ts` |
