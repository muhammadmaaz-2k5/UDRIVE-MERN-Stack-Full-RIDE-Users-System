import { useEffect, useRef, useState } from "react";
import { MapPin, Loader2, X } from "lucide-react";
import type { LatLng, PlaceResult } from "@/types";
import { searchPlaces } from "@/lib/geo";

interface PlaceSearchProps {
  label: string;
  placeholder?: string;
  value?: string;
  near?: LatLng;
  onSelect: (place: PlaceResult) => void;
  onClear?: () => void;
  iconColor?: "teal" | "red" | "blue" | "slate";
}

export function PlaceSearch({
  label,
  placeholder = "Search a place",
  value,
  near,
  onSelect,
  onClear,
  iconColor = "teal",
}: PlaceSearchProps) {
  const [query, setQuery] = useState(value ?? "");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value ?? "");
  }, [value]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      const r = await searchPlaces(query, near);
      setResults(r);
      setLoading(false);
      setOpen(true);
    }, 350);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, near]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const colorMap = {
    teal: "text-udrive-700 bg-udrive-50",
    red: "text-red-600 bg-red-50",
    blue: "text-blue-600 bg-blue-50",
    slate: "text-slate-600 bg-slate-100",
  };

  return (
    <div className="relative" ref={boxRef}>
      {label && (
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        <div
          className={`absolute left-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center ${colorMap[iconColor]}`}
        >
          <MapPin className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          placeholder={placeholder}
          className="w-full pl-12 pr-10 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-udrive-500 focus:ring-2 focus:ring-udrive-100 transition"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
        )}
        {!loading && query && (
          <button
            onClick={() => {
              setQuery("");
              setResults([]);
              onClear?.();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-floating max-h-64 overflow-y-auto udrive-fade-in">
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                onSelect(r);
                setQuery(r.label);
                setOpen(false);
              }}
              className="w-full text-left px-4 py-2.5 hover:bg-slate-50 border-b border-slate-50 last:border-0 flex items-start gap-2"
            >
              <MapPin className="w-4 h-4 text-udrive-600 mt-0.5 shrink-0" />
              <span className="text-sm text-slate-700 line-clamp-2">
                {r.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
