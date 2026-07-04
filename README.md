# Weather App — Web (GitHub Pages)

A browser weather dashboard using the free [Open-Meteo](https://open-meteo.com)
API. No API key, no build step, no server. Two files: `index.html` and `app.js`.

Works on any device — desktop, phone, tablet — because it's just a web page.

---

## Deploy to GitHub Pages (step by step)

### 1. Create a GitHub repository

1. Go to [github.com](https://github.com) and sign in.
2. Click **+** → **New repository**.
3. Name it whatever you like, e.g. `weather-app`.
4. Leave it **Public** (GitHub Pages is free for public repos).
5. Click **Create repository**.

### 2. Push the files

If you have Git installed:

```bash
cd weather-web          # this folder
git init
git add index.html app.js README.md
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/weather-app.git
git push -u origin main
```

Or use **GitHub Desktop** — drag the folder in, commit, push.

Or just upload manually: on your repo page click **Add file → Upload files**,
drag both `index.html` and `app.js`, then commit.

### 3. Enable GitHub Pages

1. In your repo, go to **Settings → Pages** (left sidebar).
2. Under **Source**, select **Deploy from a branch**.
3. Branch: **main**, folder: **/ (root)**. Click **Save**.
4. Wait ~60 seconds, then refresh the page.
5. You'll see: `Your site is live at https://YOUR_USERNAME.github.io/weather-app/`

That URL works on any browser, any device. Share it freely.

---

## Running locally (no internet host needed)

Just open `index.html` directly in a browser — it works from the filesystem
for most browsers (Firefox, Edge, Chrome). If `fetch()` is blocked locally
by CORS policy, run a tiny local server instead:

```bash
# Python 3
python -m http.server 8080
# then open http://localhost:8080
```

---

## Files

| File | What it does |
|------|-------------|
| `index.html` | Full app — HTML structure + all CSS inline in `<style>` |
| `app.js` | All JavaScript — geocoding, forecast fetch, scene/theme engine |

No `package.json`, no `node_modules`, no build step. It's a static site.

---

## How it works

- **Search** hits Open-Meteo's geocoding endpoint to turn a city name into
  lat/lon coordinates. Multiple matches show a pick-list.
- **Forecast** fetches current conditions + 4 days from Open-Meteo's
  forecast endpoint (`is_day` included so day/night themes work correctly).
- **Theme engine** maps each WMO weather code to a condition group
  (sunny / cloudy / fog / rainy / snow / storm) and combines it with
  `is_day` to choose one of 8 gradient + sky scene combos. The hill
  silhouette is the constant signature — only its palette and the sky
  above it change.
- **Animations** are per-condition: rotating sun rays, moon glow pulse,
  wind-scrolling clouds (seamless tile — see `windCluster()` in `app.js`),
  falling rain, drifting snow, and a flickering storm bolt. All respect
  `prefers-reduced-motion`.
- Forecast list below the hero stays static (animations frozen via CSS)
  so the eye isn't pulled away from the main dashboard.
