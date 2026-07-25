# Product

## Register

product

## Users

AgriSense operators and developers monitoring the production bdapps integration. They need to confirm real payment outcomes, trace provider callbacks, and investigate failures without reading server logs or querying PostgreSQL manually.

## Product Purpose

Provide a secure operational control desk for live bdapps subscriber, messaging, and CaaS workflows. Success means an authorized operator can quickly understand transaction health, locate a specific debit, inspect the exact persisted provider result, and correlate callbacks with database records.

## Brand Personality

Trustworthy, operational, grounded. The interface should feel calm under incident pressure and specific about money, identifiers, timestamps, and durable states.

## Anti-references

Do not resemble a demo dashboard, a generic analytics template, or a decorative fintech landing page. Avoid fabricated metrics, ornamental charts, glass effects, oversized KPI cards, and any UI that obscures the distinction between live provider data and local application state.

## Design Principles

1. Lead with durable truth from PostgreSQL and name the data source.
2. Make payment state, amount, subscriber, provider code, and attempt count scannable together.
3. Preserve exact identifiers and payloads for investigation without overwhelming the primary view.
4. Keep risky operator actions visually separate from read-only monitoring.
5. Prefer familiar controls, explicit empty/error states, and responsive data layouts.

## Accessibility & Inclusion

Target WCAG 2.1 AA contrast, full keyboard operation, visible focus states, semantic tables and controls, screen-reader status announcements, color-independent state labels, and reduced-motion support.
