# ENGAZ Clinic Demo

This public GitHub Pages site is a synthetic, browser-local Clinic V2 simulation for demonstration only. It contains no real patient data, has no API or external service integration, and does not persist entries or send messages. Do not enter real patient information.

Open `index.html` in a browser (or publish this folder with GitHub Pages) to explore the simulation.

## What the demo covers

Seven views, all driven by one in-memory data set:

- **نظرة اليوم** — readiness gauge, six KPIs with sparklines, a half-hour day strip, and an alert feed generated from the current state.
- **المواعيد** — searchable, sortable schedule with status/doctor filters, multi-select and bulk actions.
- **ملفات المرضى** — patient directory with a side-drawer profile: visits, adherence, balance, tags and linked invoices.
- **الفوترة والتحصيل** — invoices by paid / pending / overdue, revenue split by service, collection-quality bars.
- **المخزون** — consumable stock levels, days-to-empty estimates, reorder alerts and a restock cost estimate.
- **المساعد الذكي** — an explainable no-show score that shows each contributing factor and its weight, a smart waitlist, and a "what-if" simulator for reminder timing, deposits and overbooking.
- **التقارير** — weekly/monthly trend chart, per-doctor performance, before/after indicators and a printable summary.

Light and dark themes follow the visitor's system setting and can be toggled in the header. The layout is responsive down to phone widths.

## Safety constraints

The demo is deliberately inert, and `.github/workflows/validate.yml` enforces it on every push:

- no network APIs (`fetch`, `XMLHttpRequest`, `WebSocket`), no storage APIs, no cookies, no `eval`
- no markup-injection sinks — every node is built with `createElement` / `createElementNS` and `textContent`
- no external assets or fonts; only the four ENGAZ demo domains may be linked
- only the files listed in the workflow may exist in the repository

All names, phone codes, prices and figures are fabricated placeholders.
