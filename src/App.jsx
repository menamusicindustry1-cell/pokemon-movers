import React, { useMemo, useState } from "react";

const BASE_URL = "/api";

const DEMO_ROWS = [
  {
    id: "demo-1",
    name: "Umbreon ex",
    setName: "Prismatic Evolutions",
    number: "161",
    rarity: "Special Illustration Rare",
    condition: "Near Mint",
    printing: "Holofoil",
    price: 84.25,
    change24h: 3.1,
    change7d: 18.4,
    change30d: 31.2,
    min30d: 61.2,
    max30d: 88.9,
    avg30d: 74.1,
    priceChanges30d: 12,
    selectedMomentum: 18.4,
    buyWatchScore: 28.7,
    tcgplayerId: "",
  },
  {
    id: "demo-2",
    name: "Pikachu",
    setName: "Surging Sparks",
    number: "238",
    rarity: "Illustration Rare",
    condition: "Near Mint",
    printing: "Holofoil",
    price: 52.4,
    change24h: 1.8,
    change7d: 14.9,
    change30d: 22.7,
    min30d: 40.5,
    max30d: 55.1,
    avg30d: 47.8,
    priceChanges30d: 9,
    selectedMomentum: 14.9,
    buyWatchScore: 23.1,
    tcgplayerId: "",
  },
];

function currency(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return `$${Number(value).toFixed(2)}`;
}

function pct(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  const sign = Number(value) > 0 ? "+" : "";
  return `${sign}${Number(value).toFixed(1)}%`;
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function buildTcgplayerUrl(tcgplayerId) {
  if (!tcgplayerId) return null;
  return `https://www.tcgplayer.com/product/${tcgplayerId}`;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  let json = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }

  if (!response.ok) {
    const apiError = json?.error?.message || json?.error || json?.message;
    throw new Error(apiError || `API request failed with status ${response.status}`);
  }

  return json;
}

async function fetchTopMovers({ timeframe, maxPrice, minPrice, condition, printing, limit, offset }) {
  const params = new URLSearchParams({
    timeframe: String(timeframe),
    maxPrice: String(maxPrice),
    minPrice: String(minPrice),
    condition: String(condition),
    printing: String(printing),
    limit: String(limit),
    offset: String(offset),
  });

  const url = `${BASE_URL}/pokemon?${params.toString()}`;
  const json = await fetchJson(url);
  const rows = json?.data || [];

  return rows.sort((a, b) => safeNumber(b.buyWatchScore, 0) - safeNumber(a.buyWatchScore, 0));
}

export default function PokemonTopMoversApp() {
  const [timeframe, setTimeframe] = useState("7d");
  const [maxPrice, setMaxPrice] = useState(100);
  const [minPrice, setMinPrice] = useState(5);
  const [condition, setCondition] = useState("NM");
  const [printing, setPrinting] = useState("Any");
  const [limit, setLimit] = useState(100);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [sortConfig, setSortConfig] = useState([
    { key: "buyWatchScore", direction: "desc" },
  ]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [demoMode, setDemoMode] = useState(false);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();

    let result = rows;

    if (q) {
      result = rows.filter((row) =>
        [row.name, row.setName, row.rarity, row.condition, row.printing]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }

    const sorted = [...result].sort((a, b) => {
      for (const sort of sortConfig) {
        const aRaw = a[sort.key];
        const bRaw = b[sort.key];

        const aNum = Number(aRaw);
        const bNum = Number(bRaw);
        const bothNumeric = Number.isFinite(aNum) && Number.isFinite(bNum);

        let comparison = 0;

        if (bothNumeric) {
          comparison = aNum - bNum;
        } else {
          comparison = String(aRaw || "").localeCompare(String(bRaw || ""));
        }

        if (comparison !== 0) {
          return sort.direction === "asc" ? comparison : -comparison;
        }
      }

      return 0;
    });

    return sorted;
  }, [rows, query, sortConfig]);

  const stats = useMemo(() => {
    const positive = rows.filter((r) => safeNumber(r.selectedMomentum, 0) > 0).length;
    const avgPrice = rows.length ? rows.reduce((sum, r) => sum + safeNumber(r.price, 0), 0) / rows.length : 0;
    return { positive, avgPrice };
  }, [rows]);

  async function handleFetch() {
    setError("");
    setLoading(true);
    setDemoMode(false);

    try {
      const data = await fetchTopMovers({
        timeframe,
        maxPrice: Number(maxPrice),
        minPrice: Number(minPrice),
        condition,
        printing,
        limit: Number(limit),
        offset: Number(offset),
      });
      setRows(data);
      if (!data.length) {
        setError("No matching cards found. Raise API Limit, lower Min Price, or choose Any condition/printing.");
      }
    } catch (err) {
      setError(String(err.message || err || "Something went wrong."));
    } finally {
      setLoading(false);
    }
  }

  function toggleSort(key, event) {
    const isMultiSort = event?.shiftKey;

    setSortConfig((prev) => {
      const baseSorts = isMultiSort ? prev : [];
      const existing = prev.find((s) => s.key === key);

      if (!existing) {
        return [...baseSorts, { key, direction: "desc" }];
      }

      if (existing.direction === "desc") {
        const updatedSort = { key, direction: "asc" };
        return isMultiSort
          ? prev.map((s) => (s.key === key ? updatedSort : s))
          : [updatedSort];
      }

      return isMultiSort ? prev.filter((s) => s.key !== key) : [];
    });
  }

  function clearSort() {
    setSortConfig([{ key: "buyWatchScore", direction: "desc" }]);
  }

  function getSortIndicator(key) {
    const sort = sortConfig.find((s) => s.key === key);

    if (!sort) return "";

    const priority = sortConfig.findIndex((s) => s.key === key) + 1;
    return `${sort.direction === "desc" ? " ↓" : " ↑"}${priority > 1 ? priority : ""}`;
  }

  function loadDemo() {
    setRows(DEMO_ROWS);
    setDemoMode(true);
    setError("");
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-slate-100 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-orange-500/10 px-3 py-1 text-sm text-orange-200 ring-1 ring-orange-400/20">
              📈 Pokémon market scanner
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-5xl">Top Pokémon Movers Under $100</h1>
            <p className="mt-3 max-w-2xl text-slate-300">
              Finds Pokémon card variants under your max price and ranks them by recent price movement, trend slope, price-change activity, and momentum.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button onClick={loadDemo} className="rounded-2xl border border-slate-700 bg-slate-900 px-5 py-3 font-semibold text-slate-100 hover:bg-slate-800">
              Load Demo Data
            </button>
            <button onClick={handleFetch} disabled={loading} className="rounded-2xl bg-orange-500 px-5 py-3 font-semibold text-slate-950 shadow-lg hover:bg-orange-400 disabled:opacity-60">
              {loading ? "Scanning..." : "Scan Movers"}
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl md:p-6">
          <div className="mb-4 text-lg font-semibold text-slate-100">Filters</div>
          <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-7">
            <label>
              <span className="text-sm text-slate-400">Mover Window</span>
              <select value={timeframe} onChange={(e) => setTimeframe(e.target.value)} className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none focus:border-orange-400">
                <option value="7d">7 Day</option>
                <option value="30d">30 Day</option>
              </select>
            </label>

            <label>
              <span className="text-sm text-slate-400">Max Price</span>
              <input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none focus:border-orange-400" />
            </label>

            <label>
              <span className="text-sm text-slate-400">Min Price</span>
              <input type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none focus:border-orange-400" />
            </label>

            <label>
              <span className="text-sm text-slate-400">Condition</span>
              <select value={condition} onChange={(e) => setCondition(e.target.value)} className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none focus:border-orange-400">
                <option>Any</option>
                <option value="NM">Near Mint</option>
                <option value="LP">Lightly Played</option>
                <option value="MP">Moderately Played</option>
                <option value="HP">Heavily Played</option>
                <option value="DMG">Damaged</option>
              </select>
            </label>

            <label>
              <span className="text-sm text-slate-400">Printing</span>
              <select value={printing} onChange={(e) => setPrinting(e.target.value)} className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none focus:border-orange-400">
                <option>Any</option>
                <option>Normal</option>
                <option>Holofoil</option>
                <option>Reverse Holofoil</option>
                <option>1st Edition</option>
                <option>Unlimited</option>
              </select>
            </label>

            <label>
              <span className="text-sm text-slate-400">API Limit</span>
              <input type="number" value={limit} onChange={(e) => setLimit(e.target.value)} className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none focus:border-orange-400" />
            </label>

            <label>
              <span className="text-sm text-slate-400">Offset</span>
              <input type="number" value={offset} onChange={(e) => setOffset(e.target.value)} className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none focus:border-orange-400" />
            </label>
          </div>
        </div>

        {demoMode && (
          <div className="rounded-3xl border border-yellow-500/30 bg-yellow-950/30 p-4 text-yellow-100">
            Demo mode is on. These rows are sample placeholders, not live market data.
          </div>
        )}

        {error && (
          <div className="rounded-3xl border border-red-500/30 bg-red-950/40 p-4 text-red-100">
            <div className="font-semibold">Scanner error</div>
            <div className="mt-1 text-sm text-red-100/80">{error}</div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="text-sm text-slate-400">Cards Found</div>
            <div className="mt-1 text-3xl font-bold">{rows.length}</div>
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="text-sm text-slate-400">Positive Movers</div>
            <div className="mt-1 text-3xl font-bold">{stats.positive}</div>
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="text-sm text-slate-400">Average Price</div>
            <div className="mt-1 text-3xl font-bold">{currency(stats.avgPrice)}</div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl md:p-6">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold">Ranked Watchlist</h2>
              <p className="text-sm text-slate-400">Use this as a watchlist. Click a header to sort. Shift-click additional headers for multi-sort. Click Reset Sort to return to Score ranking.</p>
            </div>
            <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
              <button
                onClick={clearSort}
                className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-semibold text-slate-100 hover:bg-slate-800"
              >
                Reset Sort
              </button>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search card, set, rarity..."
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none focus:border-orange-400 md:w-80"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="bg-slate-950 text-slate-300">
                <tr>
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">Card</th>
                  <th className="px-4 py-3">Variant</th>
                  <th onClick={(e) => toggleSort("price", e)} className="cursor-pointer px-4 py-3 text-white hover:text-orange-300">Price{getSortIndicator("price")}</th>
                  <th onClick={(e) => toggleSort("change24h", e)} className="cursor-pointer px-4 py-3 text-white hover:text-orange-300">24h{getSortIndicator("change24h")}</th>
                  <th onClick={(e) => toggleSort("change7d", e)} className="cursor-pointer px-4 py-3 text-white hover:text-orange-300">7d{getSortIndicator("change7d")}</th>
                  <th onClick={(e) => toggleSort("change30d", e)} className="cursor-pointer px-4 py-3 text-white hover:text-orange-300">30d{getSortIndicator("change30d")}</th>
                  <th className="px-4 py-3">30d Range</th>
                  <th onClick={(e) => toggleSort("priceChanges30d", e)} className="cursor-pointer px-4 py-3 hover:text-orange-300">Changes{getSortIndicator("priceChanges30d")}</th>
                  <th onClick={(e) => toggleSort("buyWatchScore", e)} className="cursor-pointer px-4 py-3 hover:text-orange-300">Score{getSortIndicator("buyWatchScore")}</th>
                  <th className="px-4 py-3">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredRows.map((row, index) => {
                  const url = buildTcgplayerUrl(row.tcgplayerId);
                  return (
                    <tr key={row.id} className="hover:bg-slate-800/50">
                      <td className="px-4 py-4 text-slate-400">#{index + 1}</td>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-slate-100">{row.name}</div>
                        <div className="text-xs text-slate-400">{row.setName} · {row.rarity || "Unknown rarity"} · #{row.number || "N/A"}</div>
                      </td>
                      <td className="px-4 py-4 text-slate-300">{row.condition || "—"} / {row.printing || "—"}</td>
                      <td className="px-4 py-4 font-semibold text-white">{currency(row.price)}</td>
                      <td className="px-4 py-4 text-white">{pct(row.change24h)}</td>
                      <td className="px-4 py-4 text-white">{pct(row.change7d)}</td>
                      <td className="px-4 py-4 text-white">{pct(row.change30d)}</td>
                      <td className="px-4 py-4 text-slate-300">{currency(row.min30d)} – {currency(row.max30d)}</td>
                      <td className="px-4 py-4 text-slate-300">{row.priceChanges30d ?? "—"}</td>
                      <td className="px-4 py-4">
                        <span className="inline-flex rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                          {safeNumber(row.buyWatchScore, 0).toFixed(1)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        {url ? <a href={url} target="_blank" rel="noreferrer" className="text-orange-300 hover:text-orange-200">View</a> : <span className="text-slate-500">—</span>}
                      </td>
                    </tr>
                  );
                })}
                {!filteredRows.length && (
                  <tr>
                    <td colSpan="11" className="px-4 py-10 text-center text-slate-400">
                      Click Scan Movers, or click Load Demo Data to test the interface.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
