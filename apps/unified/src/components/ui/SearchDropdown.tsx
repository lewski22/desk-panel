import React, { useState, useRef, useEffect } from 'react';

interface SearchDropdownProps<T> {
  placeholder:     string;
  items:           T[];
  filterFn:        (item: T, query: string) => boolean;
  renderItem:      (item: T) => React.ReactNode;
  onSelect:        (item: T) => void;
  maxSuggestions?: number;
  disabled?:       boolean;
}

export function SearchDropdown<T extends { id: string }>({
  placeholder,
  items,
  filterFn,
  renderItem,
  onSelect,
  maxSuggestions = 5,
  disabled = false,
}: SearchDropdownProps<T>) {
  const [query,   setQuery]   = useState('');
  const [open,    setOpen]    = useState(false);
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const suggestions = (
    query.trim()
      ? items.filter(i => filterFn(i, query))
      : items.slice(0, maxSuggestions)
  ).slice(0, maxSuggestions);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (item: T) => {
    onSelect(item);
    setQuery('');
    setOpen(false);
    setFocused(false);
  };

  const showDropdown = open && focused && !disabled;

  return (
    <div ref={containerRef} className="relative">
      <div className={`flex items-center gap-2 border rounded-xl px-3 py-2.5 bg-white transition-all ${
        focused ? 'border-brand ring-2 ring-brand/10' : 'border-zinc-200 hover:border-zinc-300'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
        <svg className="w-4 h-4 text-zinc-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0Z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { setFocused(true); setOpen(true); }}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 text-sm outline-none bg-transparent text-zinc-700 placeholder-zinc-400"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setOpen(true); }}
            className="text-zinc-300 hover:text-zinc-500 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-zinc-200
          rounded-xl shadow-lg overflow-hidden">
          {suggestions.length === 0 ? (
            <div className="px-4 py-3 text-sm text-zinc-400 text-center">
              {query ? 'Brak wyników' : 'Wszyscy już dodani'}
            </div>
          ) : (
            <ul className="divide-y divide-zinc-50">
              {suggestions.map(item => (
                <li key={item.id}>
                  <button
                    onMouseDown={e => { e.preventDefault(); handleSelect(item); }}
                    className="w-full px-4 py-2.5 text-left hover:bg-zinc-50 transition-colors
                      flex items-center gap-3 group"
                  >
                    {renderItem(item)}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {items.length > maxSuggestions && !query && (
            <div className="px-4 py-1.5 text-[11px] text-zinc-400 bg-zinc-50 border-t border-zinc-100">
              Wpisz aby zawęzić wyniki ({items.length} dostępnych)
            </div>
          )}
        </div>
      )}
    </div>
  );
}
