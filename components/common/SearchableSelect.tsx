
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

  const selectedOption = options.find(option => option[idKey] === value);
  
  useEffect(() => {
    if (selectedOption) {
      setSearchTerm(String(selectedOption[displayKey]));
    } else {
       if (!onSearch) { // Do not clear search term if we are searching asynchronously
        setSearchTerm('');
       }
    }
  }, [selectedOption, displayKey, onSearch]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // Reset search term to selected value if dropdown is closed without selection
        if (selectedOption) {
            setSearchTerm(String(selectedOption[displayKey]));
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef, selectedOption, displayKey]);

  const filteredOptions = onSearch ? options : options.filter(option =>
    String(option[displayKey]).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (option: T) => {
    onChange(option[idKey]);
    setSearchTerm(String(option[displayKey]));
    setIsOpen(false);
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTerm = e.target.value;
    setSearchTerm(newTerm);
    if (onSearch) {
        onSearch(newTerm);
    }
    if (!newTerm) {
        onChange(null); // Clear selection if input is cleared
    }
    setIsOpen(true);
  }

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
          {isLoading && <li className="p-2 text-gray-500">Loading...</li>}
          {!isLoading && filteredOptions.length > 0 ? (
            filteredOptions.map(option => (
              <li
                key={option[idKey]}
                className={`p-2 cursor-pointer hover:bg-indigo-100 ${option[idKey] === value ? 'bg-indigo-200' : ''}`}
                onClick={() => handleSelect(option)}
              >
                {String(option[displayKey])}
              </li>
            ))
          ) : !isLoading && (
            <li className="p-2 text-gray-500">{searchTerm ? 'No results found' : 'Type to search'}</li>
          )}
        </ul>
      )}
    </div>
  );
};
