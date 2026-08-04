'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';

interface Option {
    value: string;
    label: string;
    description?: string;
    icon?: React.ReactNode;
}

interface PrismSelectProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    label?: string;
    searchable?: boolean;
    required?: boolean;
    variant?: 'default' | 'white' | 'pill';
}

export function PrismSelect({ 
    options, 
    value, 
    onChange, 
    placeholder = 'Select option', 
    label,
    searchable = true,
    required = false,
    variant = 'default'
}: PrismSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = options.filter(opt => 
        opt.label.toLowerCase().includes(searchTerm.toLowerCase()) || 
        opt.value.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (opt.description && opt.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const selectedOption = options.find(opt => opt.value === value);

    return (
        <div className="relative" ref={containerRef}>
            {label && (
                <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1.5 ml-1 ${variant === 'white' ? 'text-white/80' : variant === 'pill' ? 'text-[var(--cf-ink-3,#a8a29e)]' : 'text-[var(--text-secondary)]'}`}>
                    {label} {required && <span className="text-[var(--status-error)]">*</span>}
                </label>
            )}

            {}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    w-full flex items-center justify-between transition-all duration-200
                    ${variant === 'pill'
                        ? `px-4 py-2 rounded-full border ${isOpen ? 'border-[var(--cf-teal,#0f766e)] bg-[var(--cf-card,#fffdf8)] shadow-[var(--cf-shadow-sm)]' : 'border-[var(--cf-line,#e9e2d0)] bg-[var(--cf-card,#fffdf8)] hover:border-[var(--cf-teal,#0f766e)]/50'}`
                        : `px-3 py-1.5 rounded-lg border ${
                            variant === 'white'
                                ? isOpen
                                    ? 'border-white/40 bg-white/25 text-white shadow-lg'
                                    : 'border-white/10 bg-white/5 text-white/90 hover:bg-white/15 hover:border-white/20'
                                : isOpen
                                    ? 'border-[var(--brand-primary)] bg-[var(--surface-2)] border-2'
                                    : 'border-transparent bg-[var(--surface-3)] hover:bg-[var(--surface-4)] border-2'
                        }`
                    }
                `}
            >
                {selectedOption ? (
                    <div className="flex flex-col items-start text-left min-w-0">
                        <span className={`font-semibold truncate w-full ${variant === 'white' ? 'text-sm text-white' : variant === 'pill' ? 'text-[13px] text-[var(--text-primary)]' : 'text-base text-[var(--text-primary)]'}`}>
                            {selectedOption.label}
                        </span>
                        {selectedOption.description && (
                            <span className="text-[10px] opacity-70 truncate w-full">{selectedOption.description}</span>
                        )}
                    </div>
                ) : (
                    <span className={`text-sm ${variant === 'white' ? 'text-white/60' : 'text-[var(--text-muted)]'}`}>{placeholder}</span>
                )}
                <ChevronDown
                    size={16}
                    className={`${variant === 'white' ? 'text-white' : variant === 'pill' ? 'text-[var(--cf-teal,#0f766e)]' : 'text-[var(--text-secondary)]'} transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {}
            {isOpen && (
                <div
                    className="absolute top-full left-0 right-0 mt-2 p-2 rounded-2xl bg-[var(--surface-1)] border border-[var(--border-subtle)] shadow-xl z-[100] animate-scale-in origin-top"
                    style={{ maxHeight: '300px', display: 'flex', flexDirection: 'column' }}
                >
                    {}
                    {searchable && (
                        <div className="sticky top-0 px-2 pb-2 mb-2 border-b border-[var(--surface-3)]">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] w-4 h-4" />
                                <input
                                    type="text"
                                    className="w-full pl-9 pr-4 py-2 rounded-lg bg-[var(--surface-1)] border border-transparent focus:border-[var(--brand-primary)] focus:outline-none text-sm transition-colors"
                                    placeholder="Search..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>
                    )}

                    {}
                    <div className="overflow-y-auto custom-scrollbar flex-1 space-y-1">
                        {filteredOptions.length === 0 ? (
                            <div className="p-4 text-center text-sm text-[var(--text-muted)]">
                                No results found.
                            </div>
                        ) : (
                            filteredOptions.map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => {
                                        onChange(opt.value);
                                        setIsOpen(false);
                                        setSearchTerm('');
                                    }}
                                    className={`
                                        w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors
                                        ${value === opt.value 
                                            ? 'bg-[var(--brand-primary)] text-white' 
                                            : 'hover:bg-[var(--surface-3)] text-[var(--text-primary)]'
                                        }
                                    `}
                                >
                                    <div className="flex items-center gap-3">
                                        {opt.icon}
                                        <div>
                                            <div className="font-medium text-sm">{opt.label}</div>
                                            {opt.description && (
                                                <div className={`text-xs ${value === opt.value ? 'text-white/80' : 'text-[var(--text-muted)]'}`}>
                                                    {opt.description}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {value === opt.value && <Check size={16} />}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
