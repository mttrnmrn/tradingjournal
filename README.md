# Personal Trading Journal & Performance Analytics

A single-user trading journal for **NQ, MNQ and NAS100** with a performance analytics suite.
React + TypeScript + Vite + Tailwind CSS, Recharts, Supabase (Postgres, Auth, Storage).

## Features

- **Dashboard**: 10 headline stats, date filter (Today / Week / Month / Year / All / Custom), cumulative P&L (daily / weekly / monthly), daily P&L bars, win/loss donut, performance by instrument, trading statistics.
- **Trading Journal**: add / edit / delete / duplicate, detail view, search, filters (instrument, direction, session, result, tag, date), sortable columns, 17 ICT / price action tags (multi-select), before-entry and after-exit screenshots (PNG/JPG/JPEG, private storage).
- **Analytics**: overall, by instrument, by session, long vs short, winning/losing analysis, monthly P&L calendar with per-day trade list, tag performance (multi-tag aware).
- **Calculation engine** (`src/lib/calc.ts`): NQ $20/pt, MNQ $2/pt, NAS100 uses your configured $/pt per lot; fractional NAS100 lots; commissions and fees; R-multiple, planned R:R, holding time; manual overrides; tick-size and stop/target-side validation.
- **Security**: Supabase Auth + Row Level Security on every table; private storage bucket scoped to your user id.

## 1. Install

```bash
cd trading-journal
npm install
```

Requires Node 18+.

## 2. Supabase setup

1. Create a project at https://supabase.com.
2. Open **SQL Editor → New query**, paste the full contents of `supabase/schema.sql`, and **Run**. This creates the tables, enums, the seeded tag list, RLS policies and the private `trade-screenshots` storage bucket.
3. **Project Settings → API**: copy the Project URL and the `anon` public key.
4. Copy the env file and fill it in:
   ```bash
   cp .env.example .env
   ```
   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR-ANON-PUBLIC-KEY
   ```
5. (Optional) **Authentication → Providers → Email**: turn off "Confirm email" for instant sign-in while developing.

### Updating an existing database

**Accounts update:** if you ran `schema.sql` before accounts existed, run `supabase/migration_accounts.sql` once in the SQL Editor. It creates the accounts table, links trades to accounts, tightens the security policy, and moves your existing trades into a new "Main Account" (using your Settings starting balance). Run it before the app update, or the app will show a load error until you do.


If you ran `schema.sql` before the "optional entry/exit time and price" update, run `supabase/migration_optional_fields.sql` once in the SQL Editor. Without it, saving a trade with those fields blank will fail. New projects don't need it, because `schema.sql` already includes the change.

## 3. Run locally

```bash
npm run dev        # http://localhost:5173
```

Open the app, choose **Create your account**, then sign in. You land on the Dashboard.

**After you have created your account, disable public sign-ups** (Authentication → Sign In / Providers → turn off "Allow new users to sign up") so nobody else can register against your project. RLS already prevents other users from seeing your data, but this keeps it single-user.

Other scripts:

```bash
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
npm test           # calculation + analytics unit checks
```

## Project structure

```
supabase/schema.sql          Database, RLS, storage policies
src/
  lib/calc.ts                P&L, R-multiple, validation (the calculation engine)
  lib/analytics.ts           Stats, series, grouping, drawdown, streaks, calendar
  lib/dates.ts               Range presets in the trading time zone
  services/                  Supabase access (trades, tags, settings, screenshots)
  context/                   Auth + data providers
  hooks/                     useRangedTrades
  components/                ui/ (shadcn-style), charts/, journal/, analytics/, layout/
  pages/                     Dashboard, Journal, Analytics, Settings, Login
scripts/test-calc.ts         Numeric checks
```

## Data model

`trades` (1) ─< `trade_tags` >─ (1) `tags` · `trades` (1) ─< `trade_screenshots` (max one `before` and one `after` per trade) · `settings` (one row per user).
Each trade stores the point value, gross/net P&L, R-multiple and holding time it was saved with, so editing Settings later never rewrites history.

## Calculation conventions

- Long P&L = (Exit − Entry) × Point value × Contracts; Short = (Entry − Exit) × …; Net = Gross − Commission − Other fees.
- **R-multiple** = Net P&L ÷ risk. Risk = the Risk Amount you enter, otherwise |Entry − Stop| × point value × quantity. No stop and no risk amount means no R.
- **Planned R:R** = |Target − Entry| ÷ |Entry − Stop|.
- **Result** is Win / Loss / Breakeven from net P&L unless you override it. Counts and win rate use the Result field (so overrides count); win rate = wins ÷ total trades.
- **Gross Profit / Gross Loss** are the sums of positive / negative *net* trade P&L, so they add up to Total Net P&L, and Profit Factor = Gross Profit ÷ |Gross Loss|.
- **Max drawdown** is the largest peak-to-trough fall of the trade-by-trade equity curve (starting balance included for the % figure).
- **Streaks** are ordered by date and entry time; a breakeven trade ends a streak.
- **Entry/exit time and entry/exit price are optional.** With both prices blank, P&L cannot be derived, so it saves as $0 unless you enter a Gross P&L override. Holding time is 0 and excluded from the average when a time is missing.
- **Times** are wall-clock times in your trading time zone; an exit earlier than the entry is treated as passing midnight.
- The **time zone setting** (default Asia/Manila) decides what "Today", "This Week" (Mon–Sun) and so on mean.

## Accounts and loss limits

- Add accounts on the **Accounts** page with a starting balance and optional **max loss limit** and **daily loss limit**.
- The **account filter** (Dashboard, Journal, Analytics) is multi-select: pick one account, several, or all. Stats, charts, calendar and the trade list all follow it, and the choice is remembered. "Only" next to an account selects just that one.
- **Balance** = starting balance + net P&L of the account's trades.
- **Max loss, static**: breached when balance <= starting balance - limit. **Trailing**: the floor follows your highest balance, so it is breached when balance <= peak - limit. A trailing floor that stops rising at the starting balance (some prop firms) is not modelled.
- **Daily loss**: breached when a trading day's net P&L (by trade date, in your trading time zone) <= -limit. "Today" uses your time zone setting.
- Limits are measured over the account's whole history and ignore the date filter. Bars turn amber at 80% and red when breached.
- Deleting an account keeps its trades as "Unassigned". New trades pre-select the filtered account, or the last one you used.
- "Starting balance" in Settings is now the default for new accounts, and counts for trades that have no account.

## Dashboard and Trader Score

The dashboard follows a TradeZella-style layout: KPI row (with current day/trade streaks), Trader Score radar, cumulative and daily P&L, progress tracker heatmap, account balance chart, calendar with weekly totals and monthly stats, and recent/largest trades.

The Trader Score is my own definition, not TradeZella's. It is the average of five 0-100 scores:
- Win: win rate.
- Profit factor: 3.0 or more = 100.
- Risk: average win / average loss, 2:1 or more = 100.
- Discipline: average of % of trades with a stop loss and % documented.
- Resilience: % of losses followed by a non-loss.

Streaks, balance and the heatmap use full history of the selected accounts; the other widgets follow the date filter.

## Notes

- NAS100 point value has no default you can trust: set it in **Settings** to your broker's $ per point per 1.0 lot before logging NAS100 trades.
- Screenshots are stored in a private bucket and shown through short-lived signed URLs. Max 10 MB each.
- Supabase returns at most 1000 rows per request; the app pages through automatically.
