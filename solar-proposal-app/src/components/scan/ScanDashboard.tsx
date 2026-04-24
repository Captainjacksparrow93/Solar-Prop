"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Radar, Play, Loader2, CheckCircle, XCircle, Clock, ChevronRight, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/Toaster";

// Load leaflet map client-side only (leaflet needs window)
const PolygonMap = dynamic(
  () => import("./PolygonMap").then((m) => ({ default: m.PolygonMap })),
  { ssr: false, loading: () => (
    <div className="h-[380px] rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
      <p className="text-slate-500 text-sm">Loading map…</p>
    </div>
  )}
);

interface LatLng { lat: number; lng: number }

interface ScanJob {
  id: string;
  name: string;
  method: string;
  status: string;
  totalFound: number;
  totalScored: number;
  error: string | null;
  createdAt: Date | string;
  _count: { leads: number };
}

interface Props { initialJobs: ScanJob[] }

const BUSINESS_TYPES = [
  // Commercial / Industrial
  "warehouse", "manufacturing plant", "factory", "industrial building",
  "office building", "shopping mall", "supermarket", "hotel", "hospital",
  "school", "church", "storage facility", "distribution center",
  // Residential
  "residential complex", "apartment complex", "housing society", "apartments",
];

export function ScanDashboard({ initialJobs }: Props) {
  const router = useRouter();
  const [jobs, setJobs] = useState<ScanJob[]>(initialJobs);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"RADIUS" | "POLYGON" | "CSV">("RADIUS");
  const [phase, setPhase] = useState<"idle" | "finding" | "done">("idle");

  const [jobName, setJobName] = useState("");
  const [query, setQuery] = useState("warehouse");
  const [customQuery, setCustomQuery] = useState("");
  const [centerAddress, setCenterAddress] = useState("");
  const [radiusMiles, setRadiusMiles] = useState(5);
  const [maxResults, setMaxResults] = useState(30);
  const [csvText, setCsvText] = useState("");
  const [polygon, setPolygon] = useState<LatLng[]>([]);

  const effectiveQuery = query === "custom" ? customQuery : query;

  const handlePolygonChange = useCallback((pts: LatLng[]) => setPolygon(pts), []);

  async function startScan() {
    if (!jobName) { toast("Enter a scan name", "error"); return; }
    if (activeTab === "RADIUS" && !centerAddress) { toast("Enter a center address", "error"); return; }
    if (activeTab === "POLYGON" && polygon.length < 3) { toast("Draw at least 3 points on the map", "error"); return; }
    if (activeTab === "CSV" && !csvText) { toast("Paste CSV content", "error"); return; }

    setPhase("finding");
    try {
      const body: Record<string, unknown> = {
        method: activeTab,
        name: jobName,
        query: effectiveQuery,
        maxResults,
      };
      if (activeTab === "RADIUS") {
        body.centerAddress = centerAddress;
        body.radiusMiles = radiusMiles;
      }
      if (activeTab === "POLYGON") {
        body.polygon = polygon;
      }
      if (activeTab === "CSV") {
        body.csvText = csvText;
      }

      const res = await fetch("/api/scan/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) { toast(data.error || "Scan failed", "error"); setPhase("idle"); return; }

      if (data.totalFound === 0) {
        toast("No buildings found — try a broader area or different business type", "error");
        setPhase("idle");
        const r = await fetch("/api/scan/jobs");
        const d = await r.json();
        setJobs(d.jobs ?? []);
        return;
      }

      toast(`Found ${data.totalFound} buildings — scoring now…`, "success");
      setPhase("done");
      router.push(`/scan/${data.jobId}`);
    } catch {
      toast("Network error", "error");
      setPhase("idle");
    }
  }

  async function deleteJob(jobId: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this scan and detach its leads?")) return;
    setDeletingId(jobId);
    try {
      const res = await fetch(`/api/scan/jobs/${jobId}`, { method: "DELETE" });
      if (res.ok) {
        setJobs(prev => prev.filter(j => j.id !== jobId));
        toast("Scan deleted", "success");
      } else {
        toast("Failed to delete scan", "error");
      }
    } catch {
      toast("Network error", "error");
    } finally {
      setDeletingId(null);
    }
  }

  const isStartDisabled =
    phase !== "idle" ||
    (activeTab === "POLYGON" && polygon.length < 3);

  const statusIcon = (s: string) => {
    if (s === "COMPLETED") return <CheckCircle className="w-4 h-4 text-green-400" />;
    if (s === "FAILED")    return <XCircle className="w-4 h-4 text-red-400" />;
    if (s === "RUNNING" || s === "SCORING") return <Loader2 className="w-4 h-4 text-orange-400 animate-spin" />;
    return <Clock className="w-4 h-4 text-slate-500" />;
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Radar className="w-6 h-6 text-orange-400" />
          <h1 className="text-2xl font-bold text-white">Area Scanner</h1>
        </div>
        <p className="text-slate-400 text-sm">
          Discover commercial rooftops, auto-score solar potential, and generate panel visuals — all on autopilot.
        </p>
      </div>

      {/* Scanner form */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-5">Configure Scan</h2>

        <div className="mb-4">
          <label className="block text-sm text-slate-400 mb-1.5">Scan Name</label>
          <input value={jobName} onChange={e => setJobName(e.target.value)}
            placeholder="e.g. Mumbai Industrial Belt"
            disabled={phase !== "idle"}
            className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500 disabled:opacity-60" />
        </div>

        {/* Method tabs */}
        <div className="flex gap-1 mb-5 bg-slate-800/50 rounded-lg p-1">
          {(["RADIUS", "POLYGON", "CSV"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} disabled={phase !== "idle"}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors disabled:opacity-60 ${
                activeTab === tab ? "bg-orange-500 text-white" : "text-slate-400 hover:text-white"
              }`}>
              {tab === "RADIUS" ? "📍 Radius" : tab === "POLYGON" ? "🗺️ Draw Area" : "📄 CSV Upload"}
            </button>
          ))}
        </div>

        {activeTab === "RADIUS" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Business Type</label>
                <select value={query} onChange={e => setQuery(e.target.value)} disabled={phase !== "idle"}
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500 disabled:opacity-60">
                  {BUSINESS_TYPES.map(t => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                  <option value="custom">Custom...</option>
                </select>
              </div>
              {query === "custom" && (
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Custom Query</label>
                  <input value={customQuery} onChange={e => setCustomQuery(e.target.value)}
                    placeholder="e.g. car dealership" disabled={phase !== "idle"}
                    className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500 disabled:opacity-60" />
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">City / Address</label>
              <input value={centerAddress} onChange={e => setCenterAddress(e.target.value)}
                placeholder="e.g. Mumbai, India  or  New York, USA" disabled={phase !== "idle"}
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500 disabled:opacity-60" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Radius (miles)</label>
                <select value={radiusMiles} onChange={e => setRadiusMiles(Number(e.target.value))} disabled={phase !== "idle"}
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500 disabled:opacity-60">
                  {[1, 2, 3, 5, 10, 15, 20, 25].map(r => (
                    <option key={r} value={r}>{r} mile{r > 1 ? "s" : ""}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Max Buildings</label>
                <select value={maxResults} onChange={e => setMaxResults(Number(e.target.value))} disabled={phase !== "idle"}
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500 disabled:opacity-60">
                  {[10, 20, 30, 50, 100].map(n => (
                    <option key={n} value={n}>{n} buildings</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {activeTab === "POLYGON" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Business Type</label>
                <select value={query} onChange={e => setQuery(e.target.value)} disabled={phase !== "idle"}
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500 disabled:opacity-60">
                  {BUSINESS_TYPES.map(t => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                  <option value="custom">Custom...</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Max Buildings</label>
                <select value={maxResults} onChange={e => setMaxResults(Number(e.target.value))} disabled={phase !== "idle"}
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500 disabled:opacity-60">
                  {[10, 20, 30, 50, 100].map(n => (
                    <option key={n} value={n}>{n} buildings</option>
                  ))}
                </select>
              </div>
            </div>

            <PolygonMap onPolygonChange={handlePolygonChange} />
          </div>
        )}

        {activeTab === "CSV" && (
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">
              CSV Content <span className="text-slate-600">(one address per line, or "Name, Address")</span>
            </label>
            <textarea value={csvText} onChange={e => setCsvText(e.target.value)} rows={6}
              placeholder={"Acme Warehouse, 123 Industrial Blvd, Mumbai\nMetro Storage, 456 Commerce St, Mumbai"}
              disabled={phase !== "idle"}
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-orange-500 resize-none disabled:opacity-60" />
          </div>
        )}

        <button onClick={startScan} disabled={isStartDisabled}
          className="mt-5 flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-medium rounded-lg transition-colors text-sm">
          {phase === "finding" ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Finding buildings…</>
          ) : (
            <><Play className="w-4 h-4" /> Start Scan</>
          )}
        </button>
        {activeTab === "POLYGON" && polygon.length < 3 && (
          <p className="mt-2 text-xs text-slate-500">Draw at least 3 points on the map to enable scanning.</p>
        )}
      </div>

      {/* Past jobs */}
      {jobs.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800">
            <h2 className="text-base font-semibold text-white">Scan History</h2>
          </div>
          <div className="divide-y divide-slate-800">
            {jobs.map(job => (
              <div key={job.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-800/30 transition-colors group">
                <Link href={`/scan/${job.id}`} className="flex items-center gap-4 flex-1 min-w-0">
                  {statusIcon(job.status)}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm truncate">{job.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {job.method} · {job.totalFound} found · {job.totalScored} scored ·{" "}
                      {new Date(job.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                    job.status === "COMPLETED" ? "bg-green-500/10 text-green-400" :
                    job.status === "FAILED"    ? "bg-red-500/10 text-red-400" :
                                                "bg-orange-500/10 text-orange-400"
                  }`}>{job.status}</span>
                  <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
                </Link>
                <button
                  onClick={(e) => deleteJob(job.id, e)}
                  disabled={deletingId === job.id}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0 disabled:opacity-50"
                  title="Delete scan"
                >
                  {deletingId === job.id
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
