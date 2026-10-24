# WearSketch

Design free-size T-shirts on a real 3D model, put several designs in one cart, and we print them and deliver them to the customer's door. Delivery is Delhi only for now (pincodes starting 110); the customer sees that in a pop-up at checkout.

## Pages

| Page | What it is |
| --- | --- |
| `/` | Home: spinning 3D shirt, how it works, print areas, pricing, FAQ |
| `/studio` | 3D design studio: draw, add text and images on the front, back and both sleeves, live price, add to cart |
| `/cart` | Every design added, quantities, delivery fee, then the delivery details (10-digit mobile, house, floor, landmark and so on) |
| `/order/<id>` | The customer's receipt, progress tracker and review form |
| `/track` | Find an order by its number and phone |
| `/help`, `/policies`, `/about` | FAQ and contact, shipping and reprints, about us |
| `/privacy`, `/terms` | Privacy policy and terms and conditions (drafts: have them checked before launch) |
| `/printer` | Merchant portal: each print partner signs in with the login ID and password you give them. They see their orders, the 3D views and print files, the delivery address, a Request pickup button, their numbers and customer reviews |
| `/admin` | Owner view (password): sales and money, returns and refunds, pickup requests, all orders, merchants and their passwords, reviews |

## Setup (one time)

1. **Supabase**: open your project → SQL Editor → paste `supabase/schema.sql` → Run. It is safe to run again after updates.
2. **Vercel**: add these environment variables (Supabase → Project settings → API keys):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (the secret key)
   - `ADMIN_PASSWORD` (any password; use it at `/admin` with any username)
3. Deploy. Every push to `main` redeploys.
4. In `/admin` → Merchants, add each print partner. The login ID and password show once; send them with the `/printer` link. Use New password if one is lost.

After every update that changes `supabase/schema.sql`, run it again **before** merging, so the new columns exist when the new code goes live.

## Order flow

Customer pays (sample payment for now) → order shows in `/admin` as **Paid** → you pick a merchant → it appears in that merchant's portal → the merchant downloads the 300 DPI PNGs, prints and taps **Request pickup** → the request shows in `/admin`; you book the courier and mark it shipped with the tracking number → customer sees each step and can leave a review → the merchant and admin see the review. Reprints, returns and refunds are recorded on the order in `/admin`.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in the three values
npm run dev
```

## Where to change things

| What | File |
| --- | --- |
| Brand name, support email and WhatsApp | `lib/brand.ts` |
| Logo and favicon | `public/logo.png` is the original. The site uses smaller copies made from it: `public/logo-mark.png`, `public/logo-mark-light.png` (for the dark footer), `app/icon.png`, `app/favicon.ico`, `app/apple-icon.png`. Remake them if the logo changes. |
| Colours, fonts, layout | `app/globals.css` (flat colours, square corners, no shadows or gradients) |
| Prices (₹359, 409, 439, 459 by number of print areas), delivery (₹49, plus ₹30 for every 4 shirts after the first 4), printer rates | `lib/pricing.ts` |
| Shirt colours, fonts, print area sizes | `lib/design.ts` |
| Real payment gateway | `lib/payments.ts` and `app/api/orders/[id]/pay/route.ts` |
| The 3D shirt model | `public/models/tee-mesh.json`, loaded by `lib/studio/shirt.ts` |
