"use client";

import { useState } from "react";
import { Search, Loader2, MapPin, Building2 } from "lucide-react";
import { toast } from "@/components/ui/Toaster";

const BUSINESS_TYPES = [
  "restaurant",
  "hotel",
  "hospital",
  "shopping mall",
  "factory",
  "warehouse",
  "school",
  "supermarket",
  "office building",
  "car dealership",
  "gym",
  "church",
  "gas station",
  "custom",
];

interface ScrapedResult {
  count: number;
}

export function LeadScraper() {
  const [query, setQuery] = useState("restaurant");
  const [customQuery, setCustomQuery] = useState("");
  const [location, setLocation] = useState("");
  const [maxResults, setMaxResults] = useState(20);
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<ScrapedResult | null>(null);

  async function handleScrape(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setLastResult(null);

    const finalQuery = query === "custom" ? customQuery : query;

    try {
      const res = await fetch("/api/leads/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: finalQuery, location, maxResults }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast(data.error || "Scraping failed", "error");
        return;
      }

      setLastResult({ count: data.count });
      toast(`Found ${data.count} businesses in ${location}`, "success");
      window.location.reload();
    } catch {
      toast("Network error. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-5">
        <Search className="w-5 h-5 text-orange-400" />
        <h2 className="text-lg font-semibold text-white">Scrape Leads from Google Maps</h2>
      </div>

      <form onSubmit={handleScrape} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Business type */}
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">
              <Building2 className="w-3.5 h-3.5 inline mr-1" />
              Business type
            </label>
            <select
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500"
            >
              {BUSINESS_TYPES.map((t) => (
                <option key={t} value={t} className="capitalize">
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Custom query (shown when "custom" selected) */}
          {query === "custom" && (
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Custom search term</label>
              <input
                required
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500"
                placeholder="e.g. textile factory"
              />
            </div>
          )}

          {/* Location */}
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">
              <MapPin className="w-3.5 h-3.5 inline mr-1" />
              Area / City
            </label>
            <input
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500"
              placeholder="e.g. Mumbai, Maharashtra"
            />
          </div>

          {/* Max results */}
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Max results (1–20)</label>
            <input
              type="number"
              min={1}
              max={20}
              value={maxResults}
              onChange={(e) => setMaxResults(Number(e.target.value))}
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-medium rounded-lg transition-colors text-sm"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Scraping Google Maps...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Scrape leads
              </>
            )}
          </button>

          {lastResult && (
            <p className="text-sm text-emerald-400">
              ✓ Found {lastResult.count} businesses
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
