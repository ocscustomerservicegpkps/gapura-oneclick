'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, Filter, Loader2, FileText, Box } from 'lucide-react';
import { PrismMultiSelect } from '@/components/ui/PrismMultiSelect';

interface CustomerFeedbackFilterModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (filters: {
        dateFrom: string;
        dateTo: string;
        title?: string;
        filters: {
            hubs: string[];
            branches: string[];
            airlines: string[];
            categories: string[];
        };
        folder?: string;
    }) => void;
    loading?: boolean;
    availableHubs: string[];
    availableBranches: string[];
    availableAirlines: string[];
    availableCategories: string[];
    existingFolders?: string[];
    initialDateRange?: { from: string; to: string };
}

export function CustomerFeedbackFilterModal({
    isOpen,
    onClose,
    onApply,
    loading = false,
    availableHubs,
    availableBranches,
    availableAirlines,
    availableCategories,
    existingFolders = [],
    initialDateRange
}: CustomerFeedbackFilterModalProps) {
    const [dateFrom, setDateFrom] = useState(initialDateRange?.from || '');
    const [dateTo, setDateTo] = useState(initialDateRange?.to || '');
    const [customTitle, setCustomTitle] = useState('');
    const [folder, setFolder] = useState('');

    const [selectedHubs, setSelectedHubs] = useState<string[]>([]);
    const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
    const [selectedAirlines, setSelectedAirlines] = useState<string[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

    useEffect(() => {
        if (isOpen) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setCustomTitle('');
            setFolder('');
            if (initialDateRange) {
                setDateFrom(initialDateRange.from);
                setDateTo(initialDateRange.to);
            }
        }
    }, [isOpen, initialDateRange]);

    if (!isOpen) return null;
    if (typeof document === 'undefined') return null;

    const handleApply = () => {
        onApply({
            dateFrom,
            dateTo,
            title: customTitle,
            filters: {
                hubs: selectedHubs,
                branches: selectedBranches,
                airlines: selectedAirlines,
                categories: selectedCategories
            },
            folder: folder.trim() || undefined
        });
    };

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden animate-scale-in mx-4">
                {}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                            <Filter size={18} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">Filter Dashboard</h3>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {}
                <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">

                    {}
                    <div className="space-y-3">
                        <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                            <Calendar size={14} /> Date Period
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            <div>
                                <label className="block text-[10px] sm:text-xs font-medium text-gray-500 mb-1">Dari</label>
                                <input 
                                    type="date" 
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] sm:text-xs font-medium text-gray-500 mb-1">Sampai</label>
                                <input 
                                    type="date" 
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="h-px bg-gray-100" />

                    {}
                    <div>
                        <h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                            <FileText size={14} /> Judul Dashboard (Opsional)
                        </h4>
                        <input 
                            type="text" 
                            value={customTitle}
                            onChange={(e) => setCustomTitle(e.target.value)}
                            placeholder="Example: Q1 2024 Report Station CGK"
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm"
                        />
                    </div>

                    <div className="h-px bg-gray-100" />

                    {}
                    {}
                    <div>
                        <h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                            <Box size={14} /> Simpan di Folder (Opsional)
                        </h4>
                        <input 
                            type="text" 
                            value={folder}
                            onChange={(e) => setFolder(e.target.value)}
                            placeholder="Example: Quarterly Reports, Station Analytics"
                            list="filter-folder-list"
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm"
                        />
                        <datalist id="filter-folder-list">
                            {existingFolders.map(f => (
                                <option key={f} value={f} />
                            ))}
                        </datalist>
                    </div>

                    <div className="h-px bg-gray-100" />

                    {}
                    <div className="space-y-4">
                        <PrismMultiSelect
                            label="Hub"
                            placeholder="Select Hub..."
                            options={availableHubs.map(h => ({ label: h, value: h }))}
                            values={selectedHubs}
                            onChange={setSelectedHubs}
                        />

                        <PrismMultiSelect
                            label="Station"
                            placeholder="Select Station..."
                            options={availableBranches.map(b => ({ label: b, value: b }))}
                            values={selectedBranches}
                            onChange={setSelectedBranches}
                        />

                        <PrismMultiSelect
                            label="Airline"
                            placeholder="Select Airline..."
                            options={availableAirlines.map(a => ({ label: a, value: a }))}
                            values={selectedAirlines}
                            onChange={setSelectedAirlines}
                        />

                        <PrismMultiSelect
                            label="Kategori"
                            placeholder="Select Category..."
                            options={availableCategories.map(c => ({ label: c, value: c }))}
                            values={selectedCategories}
                            onChange={setSelectedCategories}
                        />
                    </div>
                </div>

                {}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        Batal
                    </button>
                    <button 
                        onClick={handleApply}
                        disabled={loading}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow-sm transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {loading && <Loader2 size={16} className="animate-spin" />}
                        Terapkan Filter
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
