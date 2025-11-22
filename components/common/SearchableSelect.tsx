import React, { useState, useRef, useEffect } from 'react';

interface SearchableSelectProps<T> {
  options: T[];
  value: string | number | null;
  onChange: (value: string | number | null) => void;
  idKey: keyof T;
  displayKey: keyof T;
  placeholder?: string;
  onSearch?: (term: string) => void;
  isLoading?: boolean;
  onOpen?: () => void;
}

export const SearchableSelect = <T extends Record<string, any>,>(
  { options, value, onChange, idKey, displayKey, placeholder = 'Select...', onSearch, isLoading, onOpen }: SearchableSelectProps<T>
) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const prevValueRef = useRef(value);
  const isAsync = !!onSearch;

  useEffect(() => {
    // Only update searchTerm if the external value prop has changed
    if (prevValueRef.current !== value) {
        prevValueRef.current = value;
        const selectedOption = options.find(option => option[idKey] === value);
        if (selectedOption) {
            setSearchTerm(String(selectedOption[displayKey]));
        } else {
            setSearchTerm('');
        }
    } else {
        // If value hasn't changed but options have (e.g. initial load), 
        // ensure label is set if we are NOT currently searching/typing
        if (!isOpen) {
            const selectedOption = options.find(option => option[idKey] === value);
            if (selectedOption) {
                setSearchTerm(String(selectedOption[displayKey]));
            }
        }
    }
  }, [value, options, idKey, displayKey, isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // Reset search term to selected value if dropdown is closed without selection
        const selectedOption = options.find(option => option[idKey] === value);
        setSearchTerm(selectedOption ? String(selectedOption[displayKey]) : '');
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef, options, value, idKey, displayKey]);

  // Calculate position for Fixed dropdown
  useEffect(() => {
    if (isOpen && wrapperRef.current) {
        const updatePosition = () => {
             if (wrapperRef.current) {
                const rect = wrapperRef.current.getBoundingClientRect();
                setCoords({
                    top: rect.bottom,
                    left: rect.left,
                    width: rect.width
                });
             }
        };
        updatePosition();
        window.addEventListener('scroll', updatePosition, true);
        window.addEventListener('resize', updatePosition);
        return () => {
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
        }
    }
  }, [isOpen]);
  
  const handleFocus = () => {
    setIsOpen(true);
    if (onOpen) {
      onOpen();
    }
  };

  const handleSelect = (option: T) => {
    onChange(option[idKey]);
    setSearchTerm(String(option[displayKey]));
    setIsOpen(false);
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSearchTerm = e.target.value;
    setSearchTerm(newSearchTerm);
    if (isAsync && onSearch) {
      onSearch(newSearchTerm);
    }
    if (!newSearchTerm) {
        onChange(null); // Clear selection if input is cleared
    }
    setIsOpen(true);
  }

  const optionsToDisplay = isAsync ? options : options.filter(option =>
    String(option[displayKey]).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="relative w-full h-full" ref={wrapperRef}>
      <input
        type="text"
        className="w-full h-full px-2 py-1 text-xs border border-transparent hover:border-gray-300 focus:border-gray-300 focus:outline-none bg-transparent truncate"
        value={searchTerm}
        onChange={handleInputChange}
        onFocus={handleFocus}
        placeholder={placeholder}
      />
      {isOpen && (
        <ul 
            className="fixed z-[9999] bg-white border border-gray-300 rounded-md mt-0.5 max-h-60 overflow-y-auto shadow-2xl text-xs"
            style={{
                top: `${coords.top}px`,
                left: `${coords.left}px`,
                width: `${Math.max(coords.width, 250)}px` // Ensure minimum width for readability
            }}
        >
          {isLoading ? (
            <li className="p-2 text-gray-500">Loading...</li>
          ) : optionsToDisplay.length > 0 ? (
            optionsToDisplay.map(option => (
              <li
                key={option[idKey]}
                className={`p-2 cursor-pointer hover:bg-indigo-100 border-b border-gray-100 last:border-0 ${option[idKey] === value ? 'bg-indigo-200' : ''}`}
                onClick={() => handleSelect(option)}
              >
                <div className="font-medium">{String(option[displayKey])}</div>
                {option.description && <div className="text-[10px] text-gray-500 truncate">{option.description}</div>}
              </li>
            ))
          ) : (
            <li className="p-2 text-gray-500">{searchTerm ? 'No results found' : isAsync ? 'Type to search' : 'No options'}</li>
          )}
        </ul>
      )}
    </div>
  );
};