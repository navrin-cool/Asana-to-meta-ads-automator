import React, { useState, useEffect, useRef } from 'react';
import Fuse from 'fuse.js';
import { X } from 'lucide-react';

interface LocationSearchProps {
  onLocationsChange: (locations: string[]) => void;
  onGeoLocationsChange?: (geoLocations: any) => void;
  initialLocations?: string[];
  geoLocations?: any;
  brandId?: string;
}

export default function LocationSearch({ 
  onLocationsChange, 
  onGeoLocationsChange,
  initialLocations = [], 
  geoLocations,
  brandId 
}: LocationSearchProps) {
  const [locations, setLocations] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLocations, setSelectedLocations] = useState<string[]>(initialLocations);
  const [isLoading, setIsLoading] = useState(false);
  
  const fuseRef = useRef<Fuse<string> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedLocations(initialLocations);
  }, [initialLocations]);

  useEffect(() => {
    const fetchLocations = async () => {
      if (!brandId) {
        setLocations([]);
        return;
      }
      
      setIsLoading(true);
      try {
        const url = `/api/locations?brandId=${brandId}`;
        const response = await fetch(url);
        const data = await response.json();
        setLocations(data);
        
        fuseRef.current = new Fuse(data, {
          includeScore: true,
          threshold: 0.4, // Slightly more lenient
          distance: 100,
          minMatchCharLength: 1
        });
      } catch (error) {
        console.error("Failed to fetch locations:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchLocations();
  }, [brandId]);

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

  const handleAddAll = () => {
    setSelectedLocations(locations);
    onLocationsChange(locations);
  };

  const handleClearAll = () => {
    setSelectedLocations([]);
    onLocationsChange([]);
    if (onGeoLocationsChange) onGeoLocationsChange(undefined);
  };

  const hasCustomTargeting = geoLocations && (geoLocations.custom_locations?.length > 0 || geoLocations.countries?.length > 0);

  return (
    <div ref={wrapperRef} className="relative w-full font-sans">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <label className="block text-xs font-semibold text-[#141414]/50 uppercase tracking-wider">
            Target Locations
          </label>
          {hasCustomTargeting && (
            <span className="bg-emerald-100 text-emerald-700 text-[8px] font-bold uppercase px-2 py-0.5 rounded-full border border-emerald-200">
              Imported Targeting Active
            </span>
          )}
        </div>
        <div className="flex gap-3">
          {brandId && brandId !== '' && locations.length > 0 && (
            <button
              type="button"
              onClick={handleAddAll}
              className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40] hover:underline transition-all"
            >
              Add All Brand Locations ({locations.length})
            </button>
          )}
          {(selectedLocations.length > 0 || hasCustomTargeting) && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-[10px] font-bold uppercase tracking-widest text-red-400 hover:underline transition-all"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {hasCustomTargeting && (
        <div className="mb-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-[10px] text-emerald-800 font-medium">
          Targeting imported from Meta campaign is active. Adding new locations below will replace it.
        </div>
      )}

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
        value={query || ''}
        onChange={handleSearch}
        onFocus={() => { if (query || results.length > 0) setIsOpen(true); }}
        placeholder={isLoading ? "Loading locations..." : "Search for locations (e.g. Balwyn, Astor, Como...)"}
        disabled={isLoading}
        className="w-full bg-white border border-[#141414]/10 px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/20 focus:border-[#5A5A40] transition-all disabled:opacity-50"
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
