# Shomvob (সম্ভব) — Run Frontend & Backend + Fix Dashboard

## Plan (Dashboard)

- [x] Inspect existing dashboard pages/layout.
- [x] Confirm layout issue: sidebar has **Settings** link but no route/page.
- [x] Update `frontend/src/app/dashboard/layout.tsx` to remove Settings menu item.
- [x] Update `frontend/src/app/dashboard/page.tsx` to fetch real dashboard numbers + lists from backend.
  - [x] Call `/applications` + `/applications/stats`
  - [x] Call `/resume/generated` (or relevant endpoint) for resume count
  - [x] Call `/jobs?limit=...` and/or recommendations for recent matches
- [x] Run both apps and verify dashboard renders correctly.
