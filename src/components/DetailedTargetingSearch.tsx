import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2, Plus } from 'lucide-react';

interface TargetingOption {
  id: string;
  name: string;
  type: string;
  audience_size_lower_bound?: number;
}

interface DetailedTargetingSearchProps {
  clientId: string;
  selectedOptions: TargetingOption[];
  onChange: (options: TargetingOption[]) => void;
}

export const DetailedTargetingSearch: React.FC<DetailedTargetingSearchProps> = ({
  clientId,
  selectedOptions,
  onChange
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TargetingOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length > 1) {
        searchTargeting();
      } else {
        setResults([]);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [query]);

  const searchTargeting = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/search-targeting?clientId=${clientId}&q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setResults(data);
        setShowDropdown(true);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (option: TargetingOption) => {
    if (!selectedOptions.find(o => o.id === option.id)) {
      onChange([...selectedOptions, option]);
    }
    setQuery('');
    setShowDropdown(false);
  };

  const handleRemove = (id: string) => {
    onChange(selectedOptions.filter(o => o.id !== id));
  };

  const formatType = (type: string) => {
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <div className="space-y-3">
      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Detailed Targeting (Interests, Behaviors, Demographics)
      </label>
      
      <div className="relative" ref={dropdownRef}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => query.trim().length > 1 && setShowDropdown(true)}
            placeholder="Search for interests, behaviors, or demographics..."
            className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-10 pr-4 text-sm transition-all focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-zinc-400" />
          )}
        </div>

        {showDropdown && results.length > 0 && (
          <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-xl">
            {results
              .filter(r => !selectedOptions.find(o => o.id === r.id))
              .map((result) => (
                <button
                  key={result.id}
                  onClick={() => handleSelect(result)}
                  className="flex w-full items-center justify-between px-4 py-2 text-left hover:bg-zinc-50"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-zinc-900">{result.name}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                      {formatType(result.type)}
                    </span>
                  </div>
                  {result.audience_size_lower_bound && (
                    <span className="text-[10px] text-zinc-400">
                      ~{(result.audience_size_lower_bound / 1000000).toFixed(1)}M
                    </span>
                  )}
                  <Plus className="h-3 w-3 text-zinc-300" />
                </button>
              ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {selectedOptions.map((option) => (
          <div
            key={option.id}
            className="group flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 py-1 pl-3 pr-2 transition-colors hover:border-zinc-300"
          >
            <div className="flex flex-col leading-none">
              <span className="text-xs font-medium text-zinc-700">{option.name}</span>
              <span className="text-[8px] font-bold uppercase tracking-tighter text-zinc-400">
                {formatType(option.type)}
              </span>
            </div>
            <button
              onClick={() => handleRemove(option.id)}
              className="rounded-full p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
