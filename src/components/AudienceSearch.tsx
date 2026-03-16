import React, { useState, useEffect, useRef } from 'react';
import Fuse from 'fuse.js';
import { X } from 'lucide-react';

interface Audience {
  id: string;
  name: string;
}

interface AudienceSearchProps {
  label: string;
  clientId?: string;
  selectedAudiences: Audience[];
  onChange: (audiences: Audience[]) => void;
}

export default function AudienceSearch({ label, clientId, selectedAudiences = [], onChange }: AudienceSearchProps) {
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Audience[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const fuseRef = useRef<Fuse<Audience> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchAudiences = async () => {
      if (!clientId) {
        setAudiences([]);
        return;
      }
      
      setIsLoading(true);
      try {
        const url = `/api/audiences?clientId=${clientId}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch audiences');
        }

        const audienceList = Array.isArray(data) ? data : (data.data || []);
        setAudiences(audienceList);
        
        fuseRef.current = new Fuse(audienceList, {
          keys: ['name'],
          includeScore: true,
          threshold: 0.4,
          distance: 100,
          minMatchCharLength: 1
        });
      } catch (error) {
        console.error("Failed to fetch audiences:", error);
        setAudiences([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAudiences();
  }, [clientId]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if (value.trim() === '') {
      setResults([]);
      setIsOpen(false);
      return;
    }

    if (fuseRef.current) {
      const fuzzyResults = fuseRef.current.search(value)
        .map(result => result.item)
        .filter(item => !selectedAudiences.find(sa => sa.id === item.id)); 
        
      setResults(fuzzyResults);
      setIsOpen(true);
    }
  };

  const handleSelect = (audience: Audience) => {
    onChange([...selectedAudiences, audience]);
    setQuery('');
    setIsOpen(false);
  };

  const handleRemove = (audienceId: string) => {
    onChange(selectedAudiences.filter(a => a.id !== audienceId));
  };

  return (
    <div ref={wrapperRef} className="relative w-full font-sans col-span-2">
      <label className="block text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40 mb-2">
        {label}
      </label>

      {selectedAudiences.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {selectedAudiences.map((aud) => (
            <span 
              key={aud.id} 
              className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-medium bg-white border border-black/10 shadow-sm"
            >
              {aud.name}
              <button
                type="button"
                onClick={() => handleRemove(aud.id)}
                className="ml-2 text-[#5A5A40]/40 hover:text-red-500 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        type="text"
        value={query}
        onChange={handleSearch}
        onFocus={() => { if (query || results.length > 0) setIsOpen(true); }}
        placeholder={isLoading ? "Loading audiences..." : `Search ${label.toLowerCase()}...`}
        disabled={isLoading || !clientId}
        className="w-full bg-[#F5F5F0] border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-[#5A5A40] outline-none text-sm disabled:opacity-50"
      />

      {isOpen && results.length > 0 && (
        <ul className="absolute z-50 w-full bg-white border border-black/10 mt-2 max-h-60 overflow-auto rounded-xl shadow-2xl py-2">
          {results.map((audience) => (
            <li 
              key={audience.id}
              onClick={() => handleSelect(audience)}
              className="px-4 py-2 hover:bg-[#F5F5F0] cursor-pointer text-sm transition-colors flex justify-between items-center"
            >
              <span className="font-medium">{audience.name}</span>
              <span className="text-[10px] text-gray-400 font-mono">{audience.id}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
