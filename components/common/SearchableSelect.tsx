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
}

export const SearchableSelect = <T extends Record<string, any>,>(
  { options, value, onChange, idKey, displayKey, placeholder = 'Select...', onSearch, isLoading }: SearchableSelectProps<T>
) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isAsync = !!onSearch;

  const selectedOption = options.find(option => option[idKey] === value);
  
  useEffect(() => {
    if (selectedOption) {
      setSearchTerm(String(selectedOption[displayKey]));
    } else {
      setSearchTerm('');
    }
  }, [selectedOption, displayKey]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // Reset search term to selected value if dropdown is closed without selection
        setSearchTerm(selectedOption ? String(selectedOption[displayKey]) : '');
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef, selectedOption, displayKey]);

  const handleSelect = (option: T) => {
    onChange(option[idKey]);
    setSearchTerm(String(option[displayKey]));
    setIsOpen(false);
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSearchTerm = e.target.value;
    setSearchTerm(newSearchTerm);
    if (isAsync) {
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
    <div className="relative w-full" ref={wrapperRef}>
      <input
        type="text"
        className="w-full p-1 border border-transparent hover:border-gray-300 focus:border-gray-300 focus:outline-none"
        value={searchTerm}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
      />
      {isOpen && (
        <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 max-h-60 overflow-y-auto shadow-lg">
          {isLoading ? (
            <li className="p-2 text-gray-500">Loading...</li>
          ) : optionsToDisplay.length > 0 ? (
            optionsToDisplay.map(option => (
              <li
                key={option[idKey]}
                className={`p-2 cursor-pointer hover:bg-indigo-100 ${option[idKey] === value ? 'bg-indigo-200' : ''}`}
                onClick={() => handleSelect(option)}
              >
                {String(option[displayKey])}
              </li>
            ))
          ) : (
            <li className="p-2 text-gray-500">{searchTerm ? 'No results found' : 'Type to search'}</li>
          )}
        </ul>
      )}
    </div>
  );
};
