import React, { useState, useRef, useEffect } from 'react';

interface DropdownInputProps {
    value: string;
    onChange: (value: string) => void;
    options: string[];
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}

export const DropdownInput: React.FC<DropdownInputProps> = ({ value, onChange, options, placeholder, disabled, className }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

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

    return (
        <div className={`relative w-full h-full flex items-center ${className || ''}`} ref={wrapperRef}>
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                className="w-full h-full px-2 py-1 text-xs border border-transparent focus:outline-none bg-transparent truncate pr-6" // pr-6 to accommodate the arrow
            />
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className="absolute right-0 top-0 h-full px-1.5 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                disabled={disabled}
                tabIndex={-1}
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
            </button>

            {isOpen && (
                <ul
                    className="fixed z-[9999] bg-white border border-slate-300 rounded-md mt-0.5 max-h-60 overflow-y-auto shadow-2xl text-xs py-1"
                    style={{
                        top: `${coords.top}px`,
                        left: `${coords.left}px`,
                        width: `${Math.max(coords.width, 250)}px`
                    }}
                >
                    {options.length > 0 ? (
                        options.map((option, idx) => (
                            <li
                                key={idx}
                                className={`px-3 py-2 cursor-pointer hover:bg-slate-100 border-b border-slate-50 last:border-0 ${option === value ? 'bg-slate-50 font-semibold' : ''}`}
                                onClick={() => {
                                    onChange(option);
                                    setIsOpen(false);
                                }}
                            >
                                {option}
                            </li>
                        ))
                    ) : (
                        <li className="px-3 py-2 text-slate-500 italic">No options available</li>
                    )}
                </ul>
            )}
        </div>
    );
};
