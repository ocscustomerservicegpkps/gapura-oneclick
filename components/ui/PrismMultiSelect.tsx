'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

interface Option {
    value: string;
    label: string;
    description?: string;
    icon?: React.ReactNode;
}

interface PrismMultiSelectProps {
    options: Option[];
    values: string[];
    onChange: (values: string[]) => void;
    placeholder?: string;
    label?: string;
    searchable?: boolean;
    required?: boolean;
    variant?: 'default' | 'white';
}

export function PrismMultiSelect({ 
    options, 
    values = [], 
    onChange, 
    placeholder = 'Select options', 
    label,
    searchable = true,
    required = false,
    variant = 'default'
}: PrismMultiSelectProps) {
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

    const toggleOption = (value: string) => {
        const newValues = values.includes(value)
            ? values.filter(v => v !== value)
            : [...values, value];
        onChange(newValues);
    };

    const removeValue = (e: React.MouseEvent, value: string) => {
        e.stopPropagation();
        onChange(values.filter(v => v !== value));
    };

    const selectedLabels = values.map(v => options.find(o => o.value === v)?.label || v);

    return (
        <div className="relative" ref={containerRef}>
            {label && (
                <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1.5 ml-1 ${variant === 'white' ? 'text-white/80' : 'text-[var(--text-secondary)]'}`}>
                    {label} {required && <span className="text-[var(--status-error)]">*</span>}
                </label>
            )}

            {}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    w-full flex items-center justify-between px-3 py-1.5 rounded-lg border transition-all duration-200 min-h-[38px]
                    ${variant === 'white'
                        ? isOpen 
                            ? 'border-white/40 bg-white/25 text-white shadow-lg' 
                            : 'border-white/10 bg-white/5 text-white/90 hover:bg-white/15 hover:border-white/20'
                        : isOpen 
                            ? 'border-[var(--brand-primary)] bg-[var(--surface-2)] border-2' 
                            : 'border-transparent bg-[var(--surface-3)] hover:bg-[var(--surface-4)] border-2'
                    }
                `}
            >
                {values.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 max-w-[calc(100%-24px)]">
                        {selectedLabels.slice(0, 3).map((label, i) => (
                            <span 
                                key={values[i]} 
                                className={`
                                    inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider
                                    ${variant === 'white' 
                                        ? 'bg-white/20 text-white' 
                                        : 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border border-[var(--brand-primary)]/20'
                                    }
                                `}
                            >
                                {label}
                                <span 
                                    className="cursor-pointer hover:opacity-70"
                                    onClick={(e) => removeValue(e, values[i])}
                                >
                                    <X size={10} />
                                </span>
                            </span>
                        ))}
                        {values.length > 3 && (
                            <span className={`text-xs font-medium self-center ${variant === 'white' ? 'text-white/80' : 'text-[var(--text-muted)]'}`}>
                                +{values.length - 3} more
                            </span>
                        )}
                    </div>
                ) : (
                    <span className={`text-sm ${variant === 'white' ? 'text-white/60' : 'text-[var(--text-muted)]'}`}>{placeholder}</span>
                )}
                <ChevronDown 
                    size={16} 
                    className={`${variant === 'white' ? 'text-white' : 'text-[var(--text-secondary)]'} transition-transform duration-300 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} 
                />
            </button>

            {}
            {isOpen && (
                <div 
                    className="absolute top-full left-0 right-0 mt-2 p-2 rounded-2xl bg-[var(--surface-2)] border border-[var(--surface-3)] shadow-xl z-50 animate-scale-in origin-top"
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
                            filteredOptions.map((opt) => {
                                const isSelected = values.includes(opt.value);
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => toggleOption(opt.value)}
                                        className={`
                                            w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors
                                            ${isSelected
                                                ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]' 
                                                : 'hover:bg-[var(--surface-3)] text-[var(--text-primary)]'
                                            }
                                        `}
                                    >
                                        <div className="flex items-center gap-3">
                                            {}
                                            <div className={`
                                                w-4 h-4 rounded border flex items-center justify-center transition-colors
                                                ${isSelected 
                                                    ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)]' 
                                                    : 'border-[var(--text-muted)] group-hover:border-[var(--text-primary)]'
                                                }
                                            `}>
                                                {isSelected && <Check size={12} className="text-white" />}
                                            </div>

                                            {opt.icon}
                                            <div>
                                                <div className="font-medium text-sm">{opt.label}</div>
                                                {opt.description && (
                                                    <div className={`text-xs ${isSelected ? 'text-[var(--brand-primary)]/80' : 'text-[var(--text-muted)]'}`}>
                                                        {opt.description}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
