// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
let CONFIG = { defaultCity: "", cacheTTL: 1800000, units: "celsius" };

async function loadConfig() {
  try {
    const res = await fetch("config.json");
    if (res.ok) Object.assign(CONFIG, await res.json());
  } catch {}
}

// ---------------------------------------------------------------------------
// Cache (localStorage with TTL)
// ---------------------------------------------------------------------------
const Cache = {
  prefix: "wx_",
  get(key) {
    try {
      const raw = localStorage.getItem(this.prefix + key);
      if (!raw) return null;
      const entry = JSON.parse(raw);
      if (Date.now() > entry.expires) {
        localStorage.removeItem(this.prefix + key);
        return null;
      }
      return entry.data;
    } catch { return null; }
  },
  set(key, data, ttl) {
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify({ data, expires: Date.now() + ttl }));
    } catch {}
  },
  clear() {
    Object.keys(localStorage).filter(k => k.startsWith(this.prefix)).forEach(k => localStorage.removeItem(k));
  },
};

const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

const WEATHER_CODES = {
  0: ["Clear sky", "sunny"],
  1: ["Mainly clear", "sunny"],
  2: ["Partly cloudy", "cloudy"],
  3: ["Overcast", "cloudy"],
  45: ["Fog", "fog"],
  48: ["Freezing fog", "fog"],
  51: ["Light drizzle", "rainy"],
  53: ["Drizzle", "rainy"],
  55: ["Dense drizzle", "rainy"],
  56: ["Freezing drizzle", "rainy"],
  57: ["Dense freezing drizzle", "rainy"],
  61: ["Light rain", "rainy"],
  63: ["Rain", "rainy"],
  65: ["Heavy rain", "rainy"],
  66: ["Freezing rain", "rainy"],
  67: ["Heavy freezing rain", "rainy"],
  71: ["Light snow", "snow"],
  73: ["Snow", "snow"],
  75: ["Heavy snow", "snow"],
  77: ["Snow grains", "snow"],
  80: ["Light showers", "rainy"],
  81: ["Showers", "rainy"],
  82: ["Violent showers", "rainy"],
  85: ["Light snow showers", "snow"],
  86: ["Heavy snow showers", "snow"],
  95: ["Thunderstorm", "storm"],
  96: ["Thunderstorm, hail", "storm"],
  99: ["Thunderstorm, heavy hail", "storm"],
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function weatherInfo(code) {
  return WEATHER_CODES[code] || ["Unknown", "cloudy"];
}

// ---------------------------------------------------------------------------
// Weather icons from icon-set
// ---------------------------------------------------------------------------

const WMO_ICON_FILES = {
  0: "sunny",
  1: "mostly_sunny",
  2: "partly_cloudy",
  3: "cloudy",
  45: "windy",
  48: "windy",
  51: "drizzle",
  53: "drizzle",
  55: "heavy_rain",
  56: "drizzle",
  57: "heavy_rain",
   61: "drizzle",
  63: "heavy_rain",
  65: "heavy_rain",
  66: "icy",
  67: "icy",
  71: "flurries",
  73: "snow",
  75: "heavy_snow",
  77: "flurries",
  80: "drizzle",
  81: "heavy_rain",
  82: "heavy_rain",
  85: "flurries",
  86: "heavy_snow",
  95: "strong_thunderstorms",
  96: "sleet_hail",
  99: "sleet_hail",
};

const NIGHT_MAP = {
  sunny: "clear_night",
  mostly_sunny: "mostly_clear_night",
  partly_cloudy: "partly_cloudy_night",
  cloudy: "mostly_cloudy_night",
};

function popEl(el) {
  if (!el) return;
  el.classList.remove("pop");
  void el.offsetWidth;
  el.classList.add("pop");
}

function iconFile(code, isNight) {
  const base = WMO_ICON_FILES[code] || "cloudy";
  if (isNight && NIGHT_MAP[base]) return NIGHT_MAP[base];
  return base;
}

function iconTag(code, alt, folder, isNight) {
  return `<img src="icon-set/${folder}/${iconFile(code, isNight)}.svg" alt="${alt}" class="weather-img">`;
}

function iconFolder(group, isDay) {
  if (isDay === false) return "dark";
  return group === "sunny" ? "light" : "dark";
}

function windDirLabel(deg) {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

const MASCOT_MAP = {
  "sunny-day": "clear sunny.png",
  "sunny-night": "clear night.png",
  "cloudy-day-2": "cloudy sunny.png",
  "cloudy-day-3": "cloudy.png",
  "cloudy-night": "night cloudy.png",
  fog: "haze.png",
  rainy: "rainy.png",
  snow: "rainy.png",
  storm: "thunderstorm.png",
};

function mascotFile(group, isDay, code) {
  if (group === "cloudy" && isDay) {
    const key = code === 2 ? "cloudy-day-2" : "cloudy-day-3";
    return MASCOT_MAP[key];
  }
  if (group === "cloudy" && !isDay) return MASCOT_MAP["cloudy-night"];
  const key = isDay ? `${group}-day` : `${group}-night`;
  return MASCOT_MAP[key] || MASCOT_MAP[group] || "";
}

function formatTime(timeStr) {
  if (!timeStr) return "—";
  const parts = timeStr.split("T")[1].split(":");
  const h = parseInt(parts[0], 10);
  const m = parts[1];
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${m} ${ampm}`;
}

function formatHour(timeStr) {
  const hour = parseInt(timeStr.split("T")[1].split(":")[0], 10);
  if (hour === 0) return "12AM";
  if (hour === 12) return "12PM";
  return hour < 12 ? `${hour}AM` : `${hour - 12}PM`;
}

// ---------------------------------------------------------------------------
// Theme system: every condition + time of day maps to a gradient
// ---------------------------------------------------------------------------

const THEMES = {
  "sunny-day": {
    top: "#3e6e8e", mid: "#f2876b", bottom: "#ffd9a0",
    label: "Sunny",
  },
  "sunny-night": {
    top: "#16213c", mid: "#3b3168", bottom: "#c98a5b",
    label: "Clear",
  },
  "cloudy-day": {
    top: "#5b6b7c", mid: "#8fa3b8", bottom: "#d7dee5",
    label: "Cloudy",
  },
  "cloudy-night": {
    top: "#15202c", mid: "#283848", bottom: "#52677a",
    label: "Cloudy",
  },
  fog: {
    top: "#3f4c58", mid: "#6b7c8a", bottom: "#aab8c2",
    label: "Foggy",
  },
  rainy: {
    top: "#1f2a38", mid: "#2e4a63", bottom: "#5b8fb0",
    label: "Rainy",
  },
  snow: {
    top: "#5c7691", mid: "#9ab4cc", bottom: "#e8eef4",
    label: "Snowy",
  },
  storm: {
    top: "#150f26", mid: "#2e2350", bottom: "#5b4a7a",
    label: "Stormy",
  },
};

function heroThemeKey(group, isDay) {
  if (group === "sunny") return isDay ? "sunny-day" : "sunny-night";
  if (group === "cloudy") return isDay ? "cloudy-day" : "cloudy-night";
  return group;
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

// ---------------------------------------------------------------------------
// Sky scene SVG (ambient background, simplified)
// ---------------------------------------------------------------------------

function windCluster(innerMarkup, durationSec, delaySec) {
  return `
    <g class="wind-cluster" style="animation-duration:${durationSec}s; animation-delay:${delaySec}">
      ${innerMarkup}
      <g transform="translate(400,0)">${innerMarkup}</g>
    </g>
  `;
}

function windLinesMarkup(count) {
  let lines = "";
  for (let i = 0; i < count; i++) {
    const y = rand(18, 88);
    const len = rand(18, 34);
    const x = rand(0, 400);
    const op = rand(0.12, 0.26).toFixed(2);
    const dur = rand(5, 9).toFixed(1);
    const delay = `-${rand(0, 6).toFixed(1)}s`;
    const style = `animation-duration:${dur}s; animation-delay:${delay}`;
    lines += `<line class="wind-line" x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x + len).toFixed(1)}" y2="${y.toFixed(1)}" stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity="${op}" style="${style}"/>`;
    lines += `<line class="wind-line" x1="${(x + 400).toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x + 400 + len).toFixed(1)}" y2="${y.toFixed(1)}" stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity="${op}" style="${style}"/>`;
  }
  return lines;
}

function sunMarkup() {
  const cx = 305, cy = 92;
  let rays = "";
  for (let i = 0; i < 8; i++) {
    const angle = (i * 45 * Math.PI) / 180;
    const x1 = cx + 16 * Math.cos(angle);
    const y1 = cy + 16 * Math.sin(angle);
    const x2 = cx + 23 * Math.cos(angle);
    const y2 = cy + 23 * Math.sin(angle);
    rays += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#fff6d8" stroke-width="2" stroke-linecap="round" opacity="0.8"/>`;
  }
  return `
    <g>
      <circle cx="${cx}" cy="${cy}" r="34" fill="#fff" opacity="0.06"/>
      <circle cx="${cx}" cy="${cy}" r="22" fill="#fff" opacity="0.1"/>
    </g>
    <g class="sun-rays">${rays}</g>
    <circle cx="${cx}" cy="${cy}" r="11" fill="#fff6d8"/>
  `;
}

function moonMarkup(count) {
  let stars = "";
  for (let i = 0; i < count; i++) {
    const cx = rand(15, 385);
    const cy = rand(15, 80);
    const r = rand(0.7, 1.6);
    const delay = rand(0, 3.2).toFixed(2);
    stars += `<circle class="star twinkle" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(2)}" fill="#fff" style="animation-delay:${delay}s"/>`;
  }
  return `
    <g>${stars}</g>
    <circle class="moon-glow" cx="298" cy="58" r="20" fill="#f4f1e8"/>
    <g>
      <circle cx="298" cy="58" r="16" fill="#f4f1e8"/>
      <circle cx="303" cy="54" r="14" fill="var(--c-top, #16213c)"/>
    </g>
  `;
}

function cloudMarkup() {
  const front = `
    <ellipse cx="60" cy="55" rx="40" ry="14" fill="#fff" opacity="0.5"/>
    <ellipse cx="95" cy="47" rx="26" ry="11" fill="#fff" opacity="0.45"/>
  `;
  const back = `
    <ellipse cx="220" cy="40" rx="34" ry="12" fill="#fff" opacity="0.35"/>
    <ellipse cx="250" cy="46" rx="22" ry="9" fill="#fff" opacity="0.3"/>
  `;
  return windCluster(front, 55, "0s") + windCluster(back, 80, "-25s");
}

function buildFogBands() {
  let bands = "";
  for (let i = 0; i < 4; i++) {
    const y = 38 + i * 22;
    const op = (0.18 + i * 0.05).toFixed(2);
    const band = `<rect x="0" y="${y}" width="170" height="14" rx="7" fill="#fff" opacity="${op}"/>`;
    bands += windCluster(band, 38 + i * 9, `-${i * 7}s`);
  }
  return bands;
}

function rainMarkup(count) {
  let drops = "";
  for (let i = 0; i < count; i++) {
    const x = rand(10, 390);
    const y = rand(60, 100);
    const delay = rand(0, 1).toFixed(2);
    drops += `<line class="drop" x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x - 4).toFixed(1)}" y2="${(y + 12).toFixed(1)}" stroke="#dbe9f2" stroke-width="2" stroke-linecap="round" style="animation-delay:${delay}s"/>`;
  }
  const clouds = `
    <ellipse cx="55" cy="50" rx="42" ry="15" fill="#1b2733" opacity="0.5"/>
    <ellipse cx="230" cy="45" rx="46" ry="16" fill="#1b2733" opacity="0.45"/>
  `;
  return `
    ${windCluster(clouds, 60, "0s")}
    ${windLinesMarkup(3)}
    <g>${drops}</g>
  `;
}

function snowMarkup(count) {
  let flakes = "";
  for (let i = 0; i < count; i++) {
    const x = rand(10, 390);
    const y = rand(50, 100);
    const delay = rand(0, 5).toFixed(2);
    const r = rand(1.3, 2.4).toFixed(2);
    flakes += `<circle class="flake" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="#fff" style="animation-delay:${delay}s"/>`;
  }
  const clouds = `
    <ellipse cx="80" cy="48" rx="40" ry="14" fill="#fff" opacity="0.5"/>
    <ellipse cx="115" cy="44" rx="36" ry="13" fill="#fff" opacity="0.4"/>
  `;
  return `
    ${windCluster(clouds, 90, "0s")}
    <g>${flakes}</g>
  `;
}

function stormMarkup(count) {
  const clouds = `
    <ellipse cx="70" cy="48" rx="50" ry="17" fill="#0d0a18" opacity="0.6"/>
    <ellipse cx="200" cy="44" rx="56" ry="18" fill="#0d0a18" opacity="0.55"/>
  `;
  return `
    ${windCluster(clouds, 45, "0s")}
    ${windLinesMarkup(4)}
    <path class="bolt" d="M212,52 L196,86 L210,86 L198,118 L230,80 L214,80 Z" fill="#ffe9a8"/>
    ${rainMarkup(count)}
  `;
}

function skyMarkup(skyType) {
  switch (skyType) {
    case "sun": return sunMarkup();
    case "moon": return moonMarkup(20);
    case "cloud": return cloudMarkup();
    case "fog": return buildFogBands();
    case "rain": return rainMarkup(18);
    case "snow": return snowMarkup(22);
    case "storm": return stormMarkup(12);
    default: return "";
  }
}

function buildSceneSvg(themeKey) {
  const theme = THEMES[themeKey] || THEMES["cloudy-day"];
  return `
    <svg viewBox="0 0 400 200" preserveAspectRatio="none">
      ${skyMarkup(theme.sky)}
    </svg>
  `;
}

function applyHeroTheme(themeKey) {
  const theme = THEMES[themeKey] || THEMES["cloudy-day"];
  els.app.style.setProperty("--c-top", theme.top);
  els.app.style.setProperty("--c-mid", theme.mid);
  els.app.style.setProperty("--c-bottom", theme.bottom);
  els.scene.innerHTML = buildSceneSvg(themeKey);
}

// ---------------------------------------------------------------------------
// Geolocation
// ---------------------------------------------------------------------------

function getUserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  });
}

async function reverseGeocode(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`;
  const res = await fetch(url, { headers: { "Accept-Language": "en" } });
  if (!res.ok) throw new Error("Reverse geocoding failed");
  const data = await res.json();
  const addr = data.address || {};
  return {
    name: addr.city || addr.town || addr.village || addr.municipality || addr.county || addr.state,
    state: addr.state,
    country: addr.country,
  };
}

async function detectLocation() {
  const btn = els.locateBtn;
  btn.classList.add("loading");
  setStatus("Detecting location…");
  try {
    const coords = await getUserLocation();
    const place = await reverseGeocode(coords.latitude, coords.longitude);
    if (place.name) {
      els.input.value = place.name;
      await loadForecast({
        name: place.name,
        country: place.country || "",
        state: place.state || "",
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
    } else {
      setStatus("Could not determine location.");
    }
  } catch (err) {
    if (err.code === 1) {
      setStatus("Location permission denied.");
    } else {
      setStatus(`Location failed: ${err.message}`);
    }
  } finally {
    btn.classList.remove("loading");
  }
}

// ---------------------------------------------------------------------------
// DOM wiring
// ---------------------------------------------------------------------------

const els = {
  app: document.getElementById("app"),
  hero: document.getElementById("hero"),
  scene: document.getElementById("scene"),
  form: document.getElementById("search-form"),
  input: document.getElementById("city-input"),
  locateBtn: document.getElementById("locate-btn"),
  mascotBanner: document.getElementById("mascot-banner"),
  resultsList: document.getElementById("results-list"),
  status: document.getElementById("status"),
  weatherDisplay: document.getElementById("weather-display"),
  emptyState: document.getElementById("empty-state"),
  locationName: document.getElementById("location-name"),
  cityName: document.getElementById("city-name"),
  countryName: document.getElementById("country-name"),
  weatherIcon: document.getElementById("weather-icon"),
  conditionText: document.getElementById("condition-text"),
  feelsLike: document.getElementById("feels-like"),
  currentTemp: document.getElementById("current-temp"),
  feelsValue: document.getElementById("feels-value"),
  humidityValue: document.getElementById("humidity-value"),
  windValue: document.getElementById("wind-value"),
  forecast: document.getElementById("forecast"),
  hourlySection: document.getElementById("hourly-section"),
  hourlyScroll: document.getElementById("hourly-scroll"),
  forecastList: document.getElementById("forecast-list"),
  windArrow: document.getElementById("wind-arrow"),
  windDirValue: document.getElementById("wind-dir-value"),
  pressureValue: document.getElementById("pressure-value"),
  extrasUvValue: document.getElementById("extras-uv-value"),
  sunriseSunsetValue: document.getElementById("sunrise-sunset-value"),
};

function setStatus(text) {
  els.status.textContent = text;
}



els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const city = els.input.value.trim();
  if (!city) return;

  setStatus("Searching…");
  els.resultsList.classList.add("hidden");
  els.resultsList.innerHTML = "";
  els.emptyState.classList.add("hidden");

  try {
    const cacheKey = "geo_" + city.toLowerCase().replace(/\s+/g, "_");
    let results = Cache.get(cacheKey);

    if (!results) {
      const url = `${GEOCODE_URL}?name=${encodeURIComponent(city)}&count=5&language=en&format=json`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
      const data = await res.json();
      results = data.results || [];
      Cache.set(cacheKey, results, CONFIG.cacheTTL);
    }

    if (results.length === 0) {
      setStatus("No matching city found.");
      return;
    }
    if (results.length === 1) {
      setStatus("");
      await loadForecast(results[0]);
      return;
    }
    setStatus("Multiple matches — pick one:");
    showResults(results);
  } catch (err) {
    setStatus(`Search failed: ${err.message}`);
  }
});

els.locateBtn.addEventListener("click", detectLocation);

function showResults(results) {
  els.resultsList.innerHTML = "";
  results.forEach((r) => {
    const li = document.createElement("li");
    const parts = [r.name];
    if (r.admin1) parts.push(r.admin1);
    if (r.country) parts.push(r.country);
    li.textContent = parts.join(", ");
    li.tabIndex = 0;
    li.addEventListener("click", () => {
      els.resultsList.classList.add("hidden");
      setStatus("");
      loadForecast(r);
    });
    li.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        li.click();
      }
    });
    els.resultsList.appendChild(li);
  });
  els.resultsList.classList.remove("hidden");
}

async function loadForecast(geo) {
  setStatus("Loading forecast…");
  try {
    const cacheKey = `fc_${geo.latitude}_${geo.longitude}`;
    const cached = Cache.get(cacheKey);
    if (cached) {
      renderDashboard(geo, cached);
      setStatus("Loaded from cache");
      return;
    }

    const params = new URLSearchParams({
      latitude: geo.latitude,
      longitude: geo.longitude,
      current: "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,is_day,uv_index",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset",
      hourly: "temperature_2m,weather_code,precipitation_probability",
      timezone: "auto",
      forecast_days: "7",
    });
    const res = await fetch(`${FORECAST_URL}?${params.toString()}`);
    if (!res.ok) throw new Error(`Forecast failed (${res.status})`);
    const data = await res.json();
    Cache.set(cacheKey, data, CONFIG.cacheTTL);
    renderDashboard(geo, data);
    setStatus("");
  } catch (err) {
    setStatus(`Forecast failed: ${err.message}`);
  }
}

function renderDashboard(geo, data) {
  const current = data.current || {};
  const daily = data.daily || {};
  const [label, group] = weatherInfo(current.weather_code ?? 0);
  const isDay = (current.is_day ?? 1) === 1;
  const themeKey = heroThemeKey(group, isDay);

  applyHeroTheme(themeKey);

  els.cityName.textContent = geo.name || "—";
  els.countryName.textContent = geo.country || "";

  els.weatherIcon.innerHTML = iconTag(current.weather_code ?? 0, label, iconFolder(group, isDay), !isDay);
  updateMascot(group, isDay, current.weather_code ?? 0);
  els.conditionText.textContent = label;
  els.currentTemp.textContent = `${Math.round(current.temperature_2m ?? 0)}°`;

  const feels = Math.round(current.apparent_temperature ?? 0);
  els.feelsLike.textContent = `Feels like ${feels}°`;
  els.feelsValue.textContent = `${feels}°`;
  popEl(els.feelsValue);
  els.humidityValue.textContent = `${current.relative_humidity_2m ?? "—"}%`;
  popEl(els.humidityValue);
  els.windValue.textContent = `${current.wind_speed_10m ?? "—"} km/h`;
  popEl(els.windValue);

  els.emptyState.classList.add("hidden");
  els.weatherDisplay.classList.remove("hidden");

  renderHourlyForecast(data.hourly, current.time, group);
  renderExtras(current, daily);
  renderForecastList(daily);
}

function updateMascot(group, isDay, code) {
  const file = mascotFile(group, isDay, code);
  if (file) {
    els.mascotBanner.src = `mascot/${file}`;
    els.mascotBanner.alt = `${group} mascot`;
    els.mascotBanner.classList.remove("hidden");
  } else {
    els.mascotBanner.classList.add("hidden");
  }
}

function renderHourlyForecast(hourly, currentTime, heroGroup) {
  if (!hourly || !hourly.time || !currentTime) return;

  const today = currentTime.split("T")[0];
  const currentHour = parseInt(currentTime.split("T")[1].split(":")[0], 10);

  let startIdx = -1;
  for (let i = 0; i < hourly.time.length; i++) {
    const t = hourly.time[i];
    if (!t.startsWith(today)) continue;
    const h = parseInt(t.split("T")[1].split(":")[0], 10);
    if (h >= currentHour) { startIdx = i; break; }
  }

  if (startIdx === -1) return;

  els.hourlyScroll.innerHTML = "";

  const maxItems = Math.min(24, hourly.time.length - startIdx);
  for (let j = 0; j < maxItems; j++) {
    const idx = startIdx + j;
    const t = hourly.time[idx];
    const h = parseInt(t.split("T")[1].split(":")[0], 10);
    const isNow = h === currentHour && t.startsWith(today);
    const label = isNow ? "Now" : formatHour(t);
    const temp = Math.round(hourly.temperature_2m[idx]);
    const code = hourly.weather_code[idx];
    const [condName, group] = weatherInfo(code);

    const el = document.createElement("div");
    el.className = `hourly-item${isNow ? " now" : ""}`;
    el.innerHTML = `
      <span class="hourly-time">${label}</span>
      <div class="hourly-icon">${iconTag(code, condName, "light", false)}</div>
      <span class="hourly-temp">${temp}°</span>
    `;
    els.hourlyScroll.appendChild(el);
  }

  const nowEl = els.hourlyScroll.querySelector(".now");
  if (nowEl) nowEl.scrollIntoView({ block: "nearest", inline: "center" });
}

function windArrowFile(speed) {
  if (speed == null) return "arrow_3";
  if (speed < 10) return "arrow_3";
  if (speed < 20) return "arrow_4";
  return "arrow_5";
}

function renderExtras(current, daily) {
  const wd = current.wind_direction_10m;
  if (wd != null) {
    els.windArrow.style.transform = `rotate(${wd}deg)`;
    els.windDirValue.textContent = `${windDirLabel(wd)} (${Math.round(wd)}°)`;
    els.windArrow.src = `icon-set/dark/${windArrowFile(current.wind_speed_10m)}.svg`;
  } else {
    els.windArrow.style.display = "none";
    els.windDirValue.textContent = "—";
  }

  const p = current.pressure_msl;
  els.pressureValue.textContent = p != null ? `${Math.round(p)} hPa` : "—";

  els.extrasUvValue.textContent = current.uv_index != null ? `${current.uv_index}` : "—";

  const sunrise = daily.sunrise ? formatTime(daily.sunrise[0]) : "—";
  const sunset = daily.sunset ? formatTime(daily.sunset[0]) : "—";
  els.sunriseSunsetValue.textContent = `↑ ${sunrise}  ↓ ${sunset}`;
}

function renderForecastList(daily) {
  const times = daily.time || [];
  const codes = daily.weather_code || [];
  const highs = daily.temperature_2m_max || [];
  const lows = daily.temperature_2m_min || [];
  const rain = daily.precipitation_probability_max || [];

  els.forecastList.innerHTML = "";

  for (let i = 1; i < Math.min(times.length, 6); i++) {
    const [label, group] = weatherInfo(codes[i]);
    const dayName = DAY_NAMES[new Date(times[i]).getDay()];

    const row = document.createElement("div");
    row.className = "day-row";
    row.innerHTML = `
      <div class="day-left">
        <div class="day-icon">${iconTag(codes[i], label, "light", false)}</div>
        <div>
          <p class="day-name">${dayName}</p>
          <p class="day-condition">${label}</p>
        </div>
      </div>
      <div class="day-right">
        <span class="day-temp">${Math.round(highs[i])}°</span>
        <span class="day-hilo">H:${Math.round(highs[i])}° L:${Math.round(lows[i])}°</span>
        ${rain[i] != null ? `<span class="day-rain">\u{1F4A7} ${Math.round(rain[i])}%</span>` : ""}
      </div>
    `;
    els.forecastList.appendChild(row);
  }
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

(async function init() {
  await loadConfig();
  if (CONFIG.defaultCity) {
    els.input.value = CONFIG.defaultCity;
    els.form.dispatchEvent(new Event("submit"));
  } else {
    detectLocation();
  }
})();
