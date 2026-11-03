# Moore Supermarket — African & Caribbean Grocery Store

A full-stack e-commerce application for **Moore Supermarket**, an African and Caribbean specialty grocery store.
Customers can browse 66 products across 20 categories, search and filter, manage a persistent cart, check out with
**Stripe Checkout**, and track orders. Staff get a role-protected admin dashboard for products, inventory, categories,
orders and discount codes.

**Live site:** https://moore-supermarket.vercel.app (deployed on Vercel; every push to `main` redeploys automatically)

### Deploying on Vercel
The repo includes `vercel.json` and a serverless entry point (`api/index.js`). The React app is served as static files and `/api/*` runs the Express API as a Vercel Function. Set these in Vercel → Settings → Environment Variables:
`MONGODB_URI` (MongoDB Atlas, with network access `0.0.0.0/0`), `JWT_SECRET`, `SEED_ADMIN_PASSWORD`, `AUTO_SEED=true` (loads the sample catalogue into an empty database), `NODEJS_HELPERS=0` (needed for Stripe webhook signatures), plus the Stripe variables. Connect a **Vercel Blob** store (Storage → Blob) for admin image uploads. `CLIENT_URL` defaults to the production domain.

---

## Features

**Storefront**
- Homepage with hero, featured products, weekly deals, popular African and Caribbean products, best sellers, promotions, newsletter sign-up
- Header with logo, search, African and Caribbean category menus, live cart count and an account menu; a mobile drawer on small screens
- Catalogue with search by name, brand or tag, region and category filters, price presets and ranges, sorting (price ↑/↓, popularity, rating, newest), and featured, deals, best-seller and in-stock toggles. All filtering runs on the server against real data.
- Product pages with multiple package sizes, each with its own price and stock; low-stock warnings, a quantity selector capped at stock, and related products
- Cart: add, remove, increase and decrease; live subtotal, estimated delivery, tax and total; a free-delivery progress bar. The cart is saved to `localStorage` and re-checked against the server's current prices and stock on load.
- Checkout: contact and address validation on both client and server, home delivery or store pickup, discount codes, an order summary, and **PAY NOW**
- Order confirmation, loaded from the backend and verified with Stripe. It never trusts URL parameters alone.

**Accounts**
- Register, log in and log out. Passwords are hashed with bcrypt (12 rounds); sessions use a JWT in an **httpOnly** cookie.
- Profile and password change, saved addresses (add, edit, delete, set default), order history with statuses
- Checkout pre-fills from your default address

**Admin** (`/admin`, `admin` role only; enforced on every API route)
- Dashboard: revenue, paid orders, orders awaiting fulfilment, low stock, recent orders
- Products: create, edit and delete; image upload (JPG, PNG or WEBP up to 3 MB); multiple sizes per product with price, original price (for sale pricing) and stock; inline price and stock editing; visibility, featured and best-seller flags
- Categories: create, edit and delete. A category that still has products can't be deleted.
- Orders: search and filter by payment status and order status; detail drawer; status updates (processing → ready for pickup / out for delivery → completed); flags for orders that need review
- Promotions: percent or fixed-amount codes with minimum order, usage limit, expiry and an active toggle

**Payments (Stripe)**
- Server-side Stripe Checkout Sessions. **Every price comes from MongoDB**; prices or totals sent by the browser are ignored.
- Discounts are applied as single-use Stripe coupons; tax is a line item; delivery is a Stripe shipping rate
- The webhook verifies the signature against the raw body and handles `checkout.session.completed`, `async_payment_succeeded`, `async_payment_failed` and `expired`
- **Idempotent**: event IDs are recorded, and an order is marked paid by an atomic conditional update, so inventory is reduced exactly once even if Stripe retries
- Orders whose charged amount doesn't match the expected total, or that oversold during a race, are paid but flagged for admin review
- Canceled checkouts expire the Stripe session and mark the order canceled; expired and failed payments are recorded
- **Live keys are refused** unless `STRIPE_LIVE_MODE_ENABLED=true`

---

## Technology stack

| Layer | Tech |
|---|---|
| Frontend | React 19, React Router 7, Context API, Fetch API, Vite 8, plain CSS (custom design system) |
| Backend | Node.js 18.18+ (tested on 20), Express 5, REST |
| Database | MongoDB with Mongoose 9 |
| Payments | Stripe Node SDK, Stripe Checkout, Stripe Webhooks |
| Security | helmet (CSP), bcryptjs, jsonwebtoken (httpOnly cookie), express-rate-limit, input validation and NoSQL-injection sanitising |
| Tests | Backend: `node:test` + supertest + mongodb-memory-server · Frontend: Vitest + Testing Library + jsdom |

---

## Project structure

```
moore-supermarket/
├── client/                     React app (Vite)
│   ├── public/images/products/ Generated product packshots (SVG)
│   ├── scripts/                generate-product-art.js
│   └── src/
│       ├── components/         Header, Footer, ProductCard, OrderSummary, ui primitives, route guards…
│       ├── context/            StoreContext, AuthContext, CartContext, ToastContext
│       ├── hooks/              useApi, useDocumentTitle
│       ├── pages/              Home, Shop, Product, Cart, Checkout, OrderConfirmation, Auth, Account
│       │   └── admin/          Dashboard, Products, ProductForm, Categories, Orders, Promotions
│       ├── services/api.js     fetch wrapper
│       ├── styles/global.css   design system
│       ├── utils/              cart reducer, pricing estimate, validation, formatting
│       ├── test/               Vitest tests
│       ├── App.jsx
│       └── main.jsx
├── server/                     Express API
│   ├── config/                 env, db, stripe
│   ├── controllers/            auth, account, catalog, checkout, webhook, admin
│   ├── data/                   catalog.js (sample data), seed.js
│   ├── middleware/             auth, sanitize, upload, rateLimit, errorHandler
│   ├── models/                 User, Product, Category, Order, Promotion, ProcessedEvent, Subscriber
│   ├── routes/index.js
│   ├── services/               pricing, promotions, orders/inventory, stripe, tokens
│   ├── tests/                  API + pricing tests
│   ├── uploads/                admin-uploaded images
│   ├── app.js                  Express app (exported for tests)
│   └── server.js               entry point
├── .env.example
├── package.json                convenience scripts
└── README.md
```

---

## Getting started

### 1. Prerequisites
- **Node.js 18.18 or newer** (20 LTS recommended) and npm
- **MongoDB** (optional for local development; see below)
- A free **Stripe** account (for payments)
- The **Stripe CLI** (to receive webhooks locally): <https://docs.stripe.com/stripe-cli>

### 2. Install
```bash
git clone <your-repo-url> moore-supermarket
cd moore-supermarket
npm run install:all        # installs server/ and client/ dependencies
```

### 3. Configure environment
```bash
cp .env.example .env
```
Edit `.env` in the project root:

| Variable | Required | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | for payments | `sk_test_...` from the Stripe Dashboard → Developers → API keys. **Server only.** |
| `STRIPE_PUBLISHABLE_KEY` | optional | `pk_test_...`. Exposed through `/api/config`; Stripe Checkout doesn't need it in the browser. |
| `STRIPE_WEBHOOK_SECRET` | for payments | `whsec_...` from `stripe listen` or the Dashboard webhook endpoint |
| `STRIPE_LIVE_MODE_ENABLED` | no | Leave `false` until the owner is ready to take real payments |
| `MONGODB_URI` | production | Leave empty locally to use an in-memory database |
| `CLIENT_URL` | yes | URL of the React app. Used for Stripe redirects and CORS. **Must match the port Vite actually uses.** |
| `PORT` | no | API port (default `5000`) |
| `JWT_SECRET` | production | Long random string. Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `TAX_RATE`, `DELIVERY_FEE`, `FREE_DELIVERY_THRESHOLD`, `CURRENCY`, `STORE_ADDRESS` | no | Store pricing (defaults: 7%, $7.99, free over $75, USD) |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | no | Admin account created by `npm run seed` |

> 🔒 Never commit `.env`. It is already in `.gitignore`. Stripe secret keys are only read on the server.

### 4. MongoDB setup
Choose one:
- **Zero setup (development):** leave `MONGODB_URI` empty. The API starts an in-memory MongoDB and seeds it automatically. **Data resets whenever the server restarts.** (The first run downloads a MongoDB binary of about 100 MB.)
- **Local MongoDB:** install MongoDB Community Server, then set `MONGODB_URI=mongodb://127.0.0.1:27017/moore-supermarket`.
- **MongoDB Atlas (recommended for production):** create a free cluster, add a database user, allow your IP, and paste the connection string into `MONGODB_URI`.

With a persistent database, load the sample catalogue once:
```bash
npm run seed
```
This replaces categories, products and promotions, and creates the admin account (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`). In development it also creates the demo customer. Existing users and orders are kept.
To promote another registered user to admin: `npm run make-admin --prefix server -- someone@example.com`

### 5. Run the app (two terminals)
```bash
# Terminal 1 — API on http://localhost:5000
npm run dev:server

# Terminal 2 — React app on http://localhost:5173 (proxies /api to the server)
npm run dev:client
```
If port 5173 is taken, Vite picks the next free port (for example 5174). **Update `CLIENT_URL` in `.env` to match**, so Stripe redirects back to the right place.

**Demo accounts** (created automatically in development):

| Role | Email | Password |
|---|---|---|
| Admin | `admin@mooresupermarket.com` | `MooreAdmin123` (or `SEED_ADMIN_PASSWORD`) |
| Customer | `customer@example.com` | `Customer123` |

**Demo discount codes:** `WELCOME10` (10% off) · `JERK5` ($5 off over $40) · `HARVEST15` (15% off over $100)

---

## Stripe setup and test payments

1. Create a Stripe account and stay in **Test mode** (toggle in the Dashboard).
2. Copy the test **Secret key** into `STRIPE_SECRET_KEY` (and optionally the publishable key into `STRIPE_PUBLISHABLE_KEY`).
3. Forward webhooks to your local API with the Stripe CLI:
   ```bash
   stripe login
   stripe listen --forward-to localhost:5000/api/webhooks/stripe
   ```
   Copy the printed `whsec_...` value into `STRIPE_WEBHOOK_SECRET`, then **restart the API**.
4. Test the checkout:
   1. Add products to the cart, go to **Checkout**, fill in the form and choose delivery or pickup.
   2. Click **PAY NOW**. You're redirected to Stripe's hosted payment page.
   3. Pay with a test card:

      | Card | Result |
      |---|---|
      | `4242 4242 4242 4242` | Success |
      | `4000 0025 0000 3155` | Requires 3-D Secure authentication |
      | `4000 0000 0000 9995` | Declined (insufficient funds) |

      Use any future expiry date, any 3-digit CVC and any ZIP.
   4. After payment you land on `/order-confirmation`, which shows the order number, items, total paid and payment status. The `stripe listen` terminal shows `checkout.session.completed` → `[200]`.
   5. Check **Admin → Orders**: the order is **Paid / Processing**, and product stock went down.
   6. Click the back arrow on the Stripe page instead to test cancellation. You return to checkout with your cart intact, and the order is recorded as canceled.

**Production webhooks:** in the Dashboard go to Developers → Webhooks → Add endpoint, use `https://your-domain/api/webhooks/stripe`, and select the events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` and `checkout.session.expired`. Put that endpoint's signing secret in `STRIPE_WEBHOOK_SECRET`.

**Going live:** this only happens when the business owner decides to accept real payments. Replace the keys with live ones (`sk_live_...`), set up the live webhook endpoint, and set `STRIPE_LIVE_MODE_ENABLED=true`. Until then, live keys are refused.

> If the webhook is delayed or not configured, the confirmation page asks Stripe's API directly whether the session was paid and records the payment then. Configure webhooks anyway: they also cover customers who close the tab before the redirect.

---

## Testing

```bash
npm test                    # runs both suites
npm test --prefix server    # 26 API tests (in-memory MongoDB, mocked Stripe network calls)
npm test --prefix client    # 13 UI/logic tests (Vitest + jsdom)
```

Backend tests cover: search, filters and sorting; product details; register, login and logout; NoSQL-injection attempts; admin authorisation (401/403); address management; admin product CRUD and inventory; promo validation; checkout validation; stock limits; **checkout sessions built from database prices even when the request contains tampered prices**; **real Stripe webhook signature verification**; payment → order paid → inventory reduced; duplicate and retried webhooks not double-counting; confirmation-page reconciliation; cancel and expire handling; order history; and admin status updates.

Frontend tests cover: the cart reducer (stock caps, merging, server sync), add-to-cart and the live count, localStorage persistence, quantity buttons and line and order totals on the cart page, pricing estimates matching the server, and checkout validation.

---

## Production build

```bash
npm run build                          # builds client/dist
NODE_ENV=production npm start          # Express serves the API and the built React app on PORT
```
Required in production: `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL` (your public https URL) and the Stripe variables. Serve over HTTPS; the auth cookie is marked `Secure` in production.

---

## Security notes
- Stripe secret keys stay on the server; card data never touches this application (Stripe-hosted Checkout).
- Totals are calculated on the server in integer cents from database prices; client-side totals are display-only estimates.
- Webhook signatures are verified with the raw request body before anything changes.
- Passwords are hashed with bcrypt; JWTs live in httpOnly, SameSite=Lax cookies; roles are re-read from the database on every request; public registration always creates customer accounts.
- Request bodies are stripped of `$` and dot-containing keys; search input is regex-escaped; IDs are validated; uploads are limited by type and size.
- Login, registration and checkout are rate limited; helmet sets security headers, including a Content Security Policy.

## Product images
The sample catalogue ships with generated, on-brand SVG packshots (`client/public/images/products`), so the store looks complete with no external image dependencies. Replace any of them with a real product photo from **Admin → Products → Edit → Upload image**. If you add products to `server/data/catalog.js`, regenerate the artwork with `npm run generate:art --prefix client`.
# moore-super-market-project
