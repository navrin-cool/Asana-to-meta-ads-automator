import React, { useState, useEffect, useRef } from 'react';
import Fuse from 'fuse.js';
import { X } from 'lucide-react';

interface LocationSearchProps {
  onLocationsChange: (locations: string[]) => void;
  initialLocations?: string[];
}

export default function LocationSearch({ onLocationsChange, initialLocations = [] }: LocationSearchProps) {
  const [locations, setLocations] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLocations, setSelectedLocations] = useState<string[]>(initialLocations);
  
  const fuseRef = useRef<Fuse<string> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const response = await fetch('/api/locations');
        const data = await response.json();
        setLocations(data);
        
        fuseRef.current = new Fuse(data, {
          includeScore: true,
          threshold: 0.3,
          ignoreLocation: true,
        });
      } catch (error) {
        console.error("Failed to fetch locations:", error);
      }
    };
    
    fetchLocations();
  }, []);

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
        .filter(item => !selectedLocations.includes(item)); 
        
      setResults(fuzzyResults);
      setIsOpen(true);
    }
  };

  const handleSelect = (location: string) => {
    const updatedLocations = [...selectedLocations, location];
    setSelectedLocations(updatedLocations);
    setQuery('');
    setIsOpen(false);
    onLocationsChange(updatedLocations); 
  };

  const handleRemove = (locationToRemove: string) => {
    const updatedLocations = selectedLocations.filter(loc => loc !== locationToRemove);
    setSelectedLocations(updatedLocations);
    onLocationsChange(updatedLocations);
  };

  return (
    <div ref={wrapperRef} className="relative w-full font-sans">
      <label className="block text-xs font-semibold text-[#141414]/50 uppercase tracking-wider mb-2">
        Target Locations
      </label>

      {selectedLocations.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {selectedLocations.map((loc) => (
            <span 
              key={loc} 
              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-[#5A5A40]/10 text-[#5A5A40] border border-[#5A5A40]/20"
            >
              {loc}
              <button
                type="button"
                onClick={() => handleRemove(loc)}
                className="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-[#5A5A40]/20 transition-colors"
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
        onFocus={() => { if (query) setIsOpen(true); }}
        placeholder="Search for locations (e.g. rai, como, astor...)"
        className="w-full bg-white border border-[#141414]/10 px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/20 focus:border-[#5A5A40] transition-all"
      />

      {isOpen && results.length > 0 && (
        <ul className="absolute z-50 w-full bg-white border border-[#141414]/10 mt-2 max-h-60 overflow-auto rounded-xl shadow-2xl py-2">
          {results.map((location, index) => (
            <li 
              key={index}
              onClick={() => handleSelect(location)}
              className="px-4 py-2 hover:bg-[#F5F5F0] cursor-pointer text-sm text-[#141414] transition-colors"
            >
              {location}
            </li>
          ))}
        </ul>
      )}
      
      {isOpen && query && results.length === 0 && (
        <div className="absolute z-50 w-full bg-white border border-[#141414]/10 mt-2 rounded-xl shadow-2xl p-4 text-sm text-[#141414]/50 text-center">
          No locations found matching "{query}"
        </div>
      )}
    </div>
  );
}
