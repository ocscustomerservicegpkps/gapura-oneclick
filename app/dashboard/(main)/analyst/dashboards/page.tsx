'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
    Folder, 
    FileBarChart, 
    MoreVertical, 
    Search, 
    ArrowUpDown, 
    FolderPlus, 
    Plus,
    Trash2,
    Pencil,
    ExternalLink,
    Clock,
    LayoutGrid,
    List,
    Loader2,
    Move,
    Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { CustomerFeedbackFilterModal } from '@/components/dashboard/analyst/CustomerFeedbackFilterModal';

interface SavedDashboard {
    id: string;
    name: string;
    description: string | null;
    slug: string;
    folder: string | null;
    created_at: string;
    updated_at: string;
}

export default function DashboardManagerPage() {
    const router = useRouter();
    const [dashboards, setDashboards] = useState<SavedDashboard[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFolder, setSelectedFolder] = useState<string | null>('all');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [sortBy, setSortBy] = useState<'name' | 'date'>('date');

    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');

    const [activeDashboardMenu, setActiveDashboardMenu] = useState<string | null>(null);
    const [activeFolderMenu, setActiveFolderMenu] = useState<string | null>(null);

    const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
    const [renamingDashboardId, setRenamingDashboardId] = useState<string | null>(null);
    const [movingDashboardId, setMovingDashboardId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');

    const [showFilterModal, setShowFilterModal] = useState(false);
    const [filterLoading, setFilterLoading] = useState(false);
    const [metadata, setMetadata] = useState<{
        hubs: string[];
        branches: string[];
        airlines: string[];
        categories: string[];
    }>({ hubs: [], branches: [], airlines: [], categories: [] });

    useEffect(() => {
        fetchDashboards();
        fetchMetadata();
    }, []);

    const fetchMetadata = async () => {
        try {
            const res = await fetch('/api/dashboards/filter-options?fields=hub,branch,airlines,main_category');
            if (res.ok) {
                const options = await res.json() as Record<string, string[]>;

                setMetadata({
                    hubs: options.hub || [],
                    branches: options.branch || [],
                    airlines: options.airlines || [],
                    categories: options.main_category || []
                });
            }
        } catch (err) {
            console.error('Failed to fetch metadata:', err);
        }
    };

    const fetchDashboards = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/dashboards');
            if (res.ok) {
                const data = await res.json();
                setDashboards(data.dashboards || []);
            }
        } catch (err) {
            console.error('Failed to fetch dashboards:', err);
        } finally {
            setLoading(false);
        }
    };

    const folders = useMemo(() => {
        const uniqueFolders = Array.from(new Set(dashboards.map(d => d.folder).filter(Boolean))) as string[];
        return uniqueFolders.sort();
    }, [dashboards]);

    const filteredDashboards = useMemo(() => {
        let result = dashboards;

        if (selectedFolder !== 'all') {
            result = result.filter(d => d.folder === (selectedFolder === 'root' ? null : selectedFolder));
        }

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(d => 
                d.name.toLowerCase().includes(query) || 
                d.description?.toLowerCase().includes(query)
            );
        }

        return result.sort((a, b) => {
            if (sortBy === 'name') return a.name.localeCompare(b.name);
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
    }, [dashboards, selectedFolder, searchQuery, sortBy]);

    const handleDeleteDashboard = async (id: string) => {
        if (!confirm('Yakin ingin menghapus dashboard ini?')) return;

        setDashboards(prev => prev.filter(d => d.id !== id));
        setActiveDashboardMenu(null);

        try {
            const res = await fetch(`/api/dashboards?id=${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Delete failed');
        } catch (err) {
            console.error('Delete error:', err);
            fetchDashboards();
        }
    };

    const handleRenameDashboard = async (id: string, newName: string) => {
        const name = newName.trim();
        if (!name) return;

        setDashboards(prev => prev.map(d => d.id === id ? { ...d, name } : d));
        setRenamingDashboardId(null);

        try {
            await fetch('/api/dashboards', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, name }),
            });
        } catch (err) {
            console.error('Rename error:', err);
            fetchDashboards();
        }
    };

    const handleMoveDashboard = async (id: string, folder: string | null) => {
        const finalFolder = folder?.trim() || null;

        setDashboards(prev => prev.map(d => d.id === id ? { ...d, folder: finalFolder } : d));
        setMovingDashboardId(null);

        try {
            await fetch('/api/dashboards', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, folder: finalFolder }),
            });
        } catch (err) {
            console.error('Move error:', err);
            fetchDashboards();
        }
    };

    const handleRenameFolder = async (oldName: string, newName: string) => {
        const name = newName.trim();
        if (!name || name === oldName) {
            setRenamingFolder(null);
            return;
        }

        setDashboards(prev => prev.map(d => d.folder === oldName ? { ...d, folder: name } : d));
        if (selectedFolder === oldName) setSelectedFolder(name);
        setRenamingFolder(null);

        try {
            await fetch('/api/dashboards', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'rename', oldFolder: oldName, newFolder: name }),
            });
        } catch (err) {
            console.error('Rename folder error:', err);
            fetchDashboards();
        }
    };

    const handleDeleteFolder = async (folderName: string) => {
        if (!confirm(`Delete folder "${folderName}"? Dashboards will be moved to "Root".`)) return;

        setDashboards(prev => prev.map(d => d.folder === folderName ? { ...d, folder: null } : d));
        if (selectedFolder === folderName) setSelectedFolder('all');
        setActiveFolderMenu(null);

        try {
            await fetch('/api/dashboards', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete', folder: folderName }),
            });
        } catch (err) {
            console.error('Delete folder error:', err);
            fetchDashboards();
        }
    };

    const handleCreateFolder = async () => {
        const name = newFolderName.trim();
        if (!name) return;
        setIsCreatingFolder(false);
        setNewFolderName('');
        setSelectedFolder(name);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleApplyFilter = async (filterData: any) => {
        setFilterLoading(true);
        try {
            const res = await fetch('/api/dashboards/customer-feedback-generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(filterData),
            });

            if (!res.ok) throw new Error('Failed to generate dashboard');

            const data = await res.json();
            if (data.dashboard) {

                await fetchDashboards();
                if (data.dashboard.folder) setSelectedFolder(data.dashboard.folder);
                setShowFilterModal(false);
            }
        } catch (err) {
            console.error('Filter apply error:', err);
            alert('Failed to create filtered dashboard');
        } finally {
            setFilterLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-2rem)] animate-fade-in bg-[var(--surface-1)] relative overflow-hidden">
            {}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] brightness-100 contrast-150 z-50"></div>

            {}
            <div className="flex items-center justify-between px-8 py-6 border-b border-dashed border-gray-100 bg-[oklch(0.99_0_0/0.4)] backdrop-blur-xl z-20">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Custom Dashboards</h1>
                    <p className="text-sm text-[var(--text-muted)]">Organize and manage your specialized analytics views</p>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setShowFilterModal(true)}
                        className="btn-secondary px-4 py-2 text-sm border-gray-200"
                    >
                        <Filter size={16} />
                        Filter & Generate
                    </button>
                    <button 
                        onClick={() => router.push('/dashboard/analyst/builder')}
                        className="btn-primary px-4 py-2 text-sm"
                    >
                        <Plus size={16} />
                        New Dashboard
                    </button>
                </div>
            </div>

            <div className="flex flex-1 min-h-0">
                {}
                <div className="w-64 border-r border-dashed border-gray-100 p-6 flex flex-col gap-8 overflow-y-auto">
                    <div>
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-4">Navigasi</h3>
                        <div className="space-y-1">
                            {[
                                { id: 'all', label: 'All Dashboards', icon: LayoutGrid },
                                { id: 'root', label: 'Tanpa Folder', icon: Folder },
                            ].map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => setSelectedFolder(item.id)}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all",
                                        selectedFolder === item.id 
                                            ? "bg-[var(--surface-2)] text-[var(--brand-primary)] font-bold shadow-sm ring-1 ring-gray-100" 
                                            : "text-[var(--text-secondary)] hover:bg-[var(--surface-2)]"
                                    )}
                                >
                                    <item.icon size={16} />
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Folders</h3>
                            <button onClick={() => setIsCreatingFolder(true)} className="p-1 hover:bg-gray-100 rounded text-[var(--brand-primary)]">
                                <FolderPlus size={14} />
                            </button>
                        </div>
                        <div className="space-y-1">
                            <AnimatePresence>
                                {isCreatingFolder && (
                                    <motion.div 
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="mb-2"
                                    >
                                        <input
                                            autoFocus
                                            value={newFolderName}
                                            onChange={(e) => setNewFolderName(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                                            onBlur={() => !newFolderName.trim() && setIsCreatingFolder(false)}
                                            placeholder="Nama folder..."
                                            className="w-full px-3 py-1.5 text-sm rounded-lg border border-[var(--brand-primary)] bg-white focus:outline-none"
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {folders.map(folder => (
                                <div key={folder} className="relative group">
                                    <button
                                        onClick={() => setSelectedFolder(folder)}
                                        className={cn(
                                            "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all",
                                            selectedFolder === folder 
                                                ? "bg-[var(--surface-2)] text-[var(--brand-primary)] font-bold shadow-sm ring-1 ring-gray-100" 
                                                : "text-[var(--text-secondary)] hover:bg-[var(--surface-2)]"
                                        )}
                                    >
                                        <Folder size={16} className={cn(selectedFolder === folder ? "fill-blue-100" : "opacity-50")} />
                                        {renamingFolder === folder ? (
                                            <input
                                                autoFocus
                                                value={editValue}
                                                onChange={e => setEditValue(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') handleRenameFolder(folder, editValue);
                                                    if (e.key === 'Escape') setRenamingFolder(null);
                                                }}
                                                onBlur={() => handleRenameFolder(folder, editValue)}
                                                className="flex-1 bg-white border border-[var(--brand-primary)] rounded px-1 text-sm focus:outline-none"
                                            />
                                        ) : (
                                            <span className="flex-1 truncate text-left">{folder}</span>
                                        )}
                                        <span className="text-[10px] opacity-40 group-hover:opacity-100">
                                            {dashboards.filter(d => d.folder === folder).length}
                                        </span>
                                    </button>

                                    {!renamingFolder && (
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveFolderMenu(activeFolderMenu === folder ? null : folder);
                                                }}
                                                className="p-1 hover:bg-gray-200 rounded text-[var(--text-muted)]"
                                            >
                                                <MoreVertical size={12} />
                                            </button>

                                            <AnimatePresence>
                                                {activeFolderMenu === folder && (
                                                    <motion.div
                                                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                                        className="absolute left-full ml-2 top-0 w-32 bg-white rounded-xl shadow-xl border border-gray-100 p-1 z-50"
                                                    >
                                                        <button 
                                                            onClick={() => { setRenamingFolder(folder); setEditValue(folder); setActiveFolderMenu(null); }}
                                                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-2)] rounded-lg text-left"
                                                        >
                                                            <Pencil size={12} /> Rename
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteFolder(folder)}
                                                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg text-left"
                                                        >
                                                            <Trash2 size={12} /> Delete
                                                        </button>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {}
                <div className="flex-1 flex flex-col min-w-0 bg-[var(--surface-bg-alt)]">
                    {}
                    <div className="px-8 py-4 border-b border-dashed border-gray-100 bg-[var(--surface-1)] flex items-center justify-between">
                        <div className="relative w-96">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} />
                            <input 
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search dashboards by name or description..."
                                className="w-full pl-10 pr-4 py-2 rounded-xl bg-[var(--surface-2)] border-none text-sm focus:ring-2 focus:ring-[var(--brand-primary)]/10 transition-all outline-none"
                            />
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="flex bg-[var(--surface-2)] rounded-lg p-1 border border-gray-100">
                                <button 
                                    onClick={() => setViewMode('grid')}
                                    className={cn("p-1.5 rounded-md transition-all", viewMode === 'grid' ? "bg-white shadow-sm text-[var(--brand-primary)]" : "text-[var(--text-muted)]")}
                                >
                                    <LayoutGrid size={16} />
                                </button>
                                <button 
                                    onClick={() => setViewMode('list')}
                                    className={cn("p-1.5 rounded-md transition-all", viewMode === 'list' ? "bg-white shadow-sm text-[var(--brand-primary)]" : "text-[var(--text-muted)]")}
                                >
                                    <List size={16} />
                                </button>
                            </div>

                            <button 
                                onClick={() => setSortBy(sortBy === 'name' ? 'date' : 'name')}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-all"
                            >
                                <ArrowUpDown size={14} />
                                {sortBy === 'name' ? 'Alphabetical' : 'Terbaru'}
                            </button>
                        </div>
                    </div>

                    {}
                    <div className="flex-1 overflow-y-auto p-8">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-64 text-[var(--text-muted)]">
                                <Loader2 className="animate-spin mb-2" size={32} />
                                <p className="text-sm font-medium">Loading data...</p>
                            </div>
                        ) : filteredDashboards.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-[var(--text-muted)] border-2 border-dashed border-gray-100 rounded-3xl">
                                <Folder size={48} className="opacity-10 mb-4" />
                                <p className="text-sm font-medium">Tidak ada dashboard ditemukan</p>
                                {searchQuery && (
                                    <button onClick={() => setSearchQuery('')} className="mt-2 text-[var(--brand-primary)] text-xs font-bold hover:underline">
                                        Bersihkan Pencarian
                                    </button>
                                )}
                            </div>
                        ) : viewMode === 'grid' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
                                <AnimatePresence mode="popLayout">
                                    {filteredDashboards.map(dashboard => (
                                        <motion.div
                                            key={dashboard.id}
                                            layout
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className="group relative flex flex-col bg-[var(--surface-1)] border border-gray-100 rounded-2xl shadow-sm hover:shadow-xl hover:shadow-[var(--brand-primary)]/5 hover:border-[var(--brand-primary)]/20 transition-all duration-300 overflow-hidden"
                                        >
                                            {}
                                            <div className="aspect-[16/10] bg-[var(--surface-2)] flex items-center justify-center group-hover:bg-[var(--brand-primary)]/5 transition-colors relative">
                                                <FileBarChart size={48} className="text-[var(--text-muted)] group-hover:text-[var(--brand-primary)] transition-colors opacity-20" />

                                                {}
                                                <div className="absolute inset-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/20 to-transparent pointer-events-none flex items-end">
                                                    <span className="text-[10px] font-bold text-white uppercase tracking-widest bg-black/20 backdrop-blur-sm px-2 py-1 rounded-lg">
                                                        Preview Dashboard
                                                    </span>
                                                </div>
                                            </div>

                                            {}
                                            <div className="p-5 flex-1 flex flex-col">
                                                <div className="flex items-start justify-between gap-2 mb-2">
                                                    <div className="flex-1 min-w-0">
                                                        {renamingDashboardId === dashboard.id ? (
                                                            <input
                                                                autoFocus
                                                                value={editValue}
                                                                onChange={e => setEditValue(e.target.value)}
                                                                onKeyDown={e => {
                                                                    if (e.key === 'Enter') handleRenameDashboard(dashboard.id, editValue);
                                                                    if (e.key === 'Escape') setRenamingDashboardId(null);
                                                                }}
                                                                onBlur={() => handleRenameDashboard(dashboard.id, editValue)}
                                                                className="w-full bg-white border border-[var(--brand-primary)] rounded px-1 text-sm font-bold focus:outline-none"
                                                            />
                                                        ) : (
                                                            <h4 className="font-bold text-[var(--text-primary)] truncate text-base leading-tight">
                                                                {dashboard.name}
                                                            </h4>
                                                        )}
                                                    </div>

                                                    <div className="relative">
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setActiveDashboardMenu(activeDashboardMenu === dashboard.id ? null : dashboard.id);
                                                            }}
                                                            className="p-1.5 hover:bg-[var(--surface-2)] rounded-lg text-[var(--text-muted)] group-hover:bg-[var(--surface-2)] transition-all"
                                                        >
                                                            <MoreVertical size={14} />
                                                        </button>

                                                        <AnimatePresence>
                                                            {activeDashboardMenu === dashboard.id && (
                                                                <motion.div
                                                                    initial={{ opacity: 0, scale: 0.95, y: -5 }}
                                                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                                                    exit={{ opacity: 0, scale: 0.95, y: -5 }}
                                                                    className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-gray-100 p-1.5 z-50 overflow-hidden"
                                                                >
                                                                    <button 
                                                                        onClick={() => { window.open(`/embed/custom/${dashboard.slug}`, '_blank'); setActiveDashboardMenu(null); }}
                                                                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--brand-primary)] rounded-xl text-left"
                                                                    >
                                                                        <ExternalLink size={14} /> Buka Dashboard
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => { setRenamingDashboardId(dashboard.id); setEditValue(dashboard.name); setActiveDashboardMenu(null); }}
                                                                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-2)] rounded-xl text-left"
                                                                    >
                                                                        <Pencil size={14} /> Ganti Nama
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => { setMovingDashboardId(dashboard.id); setEditValue(dashboard.folder || ''); setActiveDashboardMenu(null); }}
                                                                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-2)] rounded-xl text-left"
                                                                    >
                                                                        <Move size={14} /> Pindahkan Folder
                                                                    </button>
                                                                    <div className="h-px bg-gray-50 my-1 mx-2" />
                                                                    <button 
                                                                        onClick={() => handleDeleteDashboard(dashboard.id)}
                                                                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-xl text-left"
                                                                    >
                                                                        <Trash2 size={14} /> Delete
                                                                    </button>
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </div>
                                                </div>

                                                <p className="text-xs text-[var(--text-muted)] line-clamp-2 mb-4 h-8">
                                                    {dashboard.description || 'Dashboard kustom untuk analisis feedback pelanggan.'}
                                                </p>

                                                <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between">
                                                    <div className="flex items-center gap-1.5">
                                                        <Clock size={12} className="text-[var(--text-muted)]" />
                                                        <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                                                            {new Date(dashboard.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                                        </span>
                                                    </div>

                                                    {dashboard.folder && (
                                                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-100">
                                                            {dashboard.folder}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {}
                                            {!activeDashboardMenu && (
                                                <div 
                                                    className="absolute inset-x-0 top-0 bottom-24 cursor-pointer"
                                                    onClick={() => window.open(`/embed/custom/${dashboard.slug}`, '_blank')}
                                                />
                                            )}

                                            {}
                                            <AnimatePresence>
                                                {movingDashboardId === dashboard.id && (
                                                    <motion.div 
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        exit={{ opacity: 0 }}
                                                        className="absolute inset-0 bg-white/80 backdrop-blur-sm z-[60] flex flex-col items-center justify-center p-6 text-center"
                                                    >
                                                        <h5 className="text-sm font-bold mb-4">Pindahkan ke Folder</h5>
                                                        <input 
                                                            autoFocus
                                                            list="move-folder-list-full"
                                                            value={editValue}
                                                            onChange={e => setEditValue(e.target.value)}
                                                            placeholder="Nama folder..."
                                                            className="w-full px-4 py-2 text-sm bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 mb-3"
                                                        />
                                                        <datalist id="move-folder-list-full">
                                                            {folders.map(f => <option key={f} value={f} />)}
                                                            <option value="">(Tanpa Folder)</option>
                                                        </datalist>
                                                        <div className="flex gap-2 w-full">
                                                            <button 
                                                                onClick={() => handleMoveDashboard(dashboard.id, editValue)}
                                                                className="flex-1 py-2 bg-[var(--brand-primary)] text-white text-xs font-bold rounded-lg shadow-lg shadow-[var(--brand-primary)]/20"
                                                            >
                                                                Pindahkan
                                                            </button>
                                                            <button 
                                                                onClick={() => setMovingDashboardId(null)}
                                                                className="flex-1 py-2 bg-white text-[var(--text-muted)] text-xs font-bold rounded-lg border border-gray-100"
                                                            >
                                                                Batal
                                                            </button>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        ) : (
                            <div className="bg-[var(--surface-1)] rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
                                <table className="w-full min-w-[640px] text-left">
                                    <thead>
                                        <tr className="bg-[var(--surface-2)] border-b border-gray-100 font-bold text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                                            <th className="px-6 py-4">Nama Dashboard</th>
                                            <th className="px-6 py-4">Folder</th>
                                            <th className="px-6 py-4">Dibuat Pada</th>
                                            <th className="px-6 py-4 text-right">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-sm">
                                        {filteredDashboards.map(dashboard => (
                                            <tr key={dashboard.id} className="group hover:bg-[var(--surface-2)] transition-colors border-b border-gray-50 last:border-none relative">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-[var(--surface-2)] flex items-center justify-center text-[var(--text-muted)] group-hover:bg-white group-hover:text-[var(--brand-primary)] transition-colors border border-transparent group-hover:border-gray-100">
                                                            <FileBarChart size={16} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            {renamingDashboardId === dashboard.id ? (
                                                                <input
                                                                    autoFocus
                                                                    value={editValue}
                                                                    onChange={e => setEditValue(e.target.value)}
                                                                    onKeyDown={e => {
                                                                        if (e.key === 'Enter') handleRenameDashboard(dashboard.id, editValue);
                                                                        if (e.key === 'Escape') setRenamingDashboardId(null);
                                                                    }}
                                                                    onBlur={() => handleRenameDashboard(dashboard.id, editValue)}
                                                                    className="bg-white border border-[var(--brand-primary)] rounded px-1 text-sm font-bold focus:outline-none"
                                                                />
                                                            ) : (
                                                                <p className="font-bold text-[var(--text-primary)] truncate max-w-[250px] sm:max-w-[400px]">{dashboard.name}</p>
                                                            )}
                                                            <p className="text-[10px] text-[var(--text-muted)] truncate max-w-[250px] sm:max-w-[300px]">{dashboard.description || 'No description'}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {dashboard.folder ? (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-100">
                                                            <Folder size={10} />
                                                            {dashboard.folder}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] font-medium text-[var(--text-muted)] italic">Root</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-[var(--text-muted)]">
                                                    {new Date(dashboard.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                </td>
                                                <td className="px-6 py-4 text-right relative">
                                                    <div className="inline-flex items-center gap-1">
                                                        <button 
                                                            onClick={() => {
                                                                setActiveDashboardMenu(activeDashboardMenu === dashboard.id ? null : dashboard.id);
                                                            }}
                                                            className="p-2 hover:bg-white rounded-lg text-[var(--text-muted)] hover:text-[var(--brand-primary)] shadow-sm border border-transparent hover:border-gray-100 transition-all"
                                                        >
                                                            <MoreVertical size={16} />
                                                        </button>

                                                        <AnimatePresence>
                                                            {activeDashboardMenu === dashboard.id && (
                                                                <motion.div
                                                                    initial={{ opacity: 0, scale: 0.95, x: 20 }}
                                                                    animate={{ opacity: 1, scale: 1, x: 0 }}
                                                                    exit={{ opacity: 0, scale: 0.95, x: 20 }}
                                                                    className="absolute right-full mr-2 top-0 w-48 bg-white rounded-2xl shadow-2xl border border-gray-100 p-1.5 z-50 overflow-hidden"
                                                                >
                                                                    <button 
                                                                        onClick={() => { window.open(`/embed/custom/${dashboard.slug}`, '_blank'); setActiveDashboardMenu(null); }}
                                                                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--brand-primary)] rounded-xl text-left"
                                                                    >
                                                                        <ExternalLink size={14} /> Buka Dashboard
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => { setRenamingDashboardId(dashboard.id); setEditValue(dashboard.name); setActiveDashboardMenu(null); }}
                                                                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-2)] rounded-xl text-left"
                                                                    >
                                                                        <Pencil size={14} /> Ganti Nama
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => { setMovingDashboardId(dashboard.id); setEditValue(dashboard.folder || ''); setActiveDashboardMenu(null); }}
                                                                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-2)] rounded-xl text-left"
                                                                    >
                                                                        <Move size={14} /> Pindahkan Folder
                                                                    </button>
                                                                    <div className="h-px bg-gray-50 my-1 mx-2" />
                                                                    <button 
                                                                        onClick={() => handleDeleteDashboard(dashboard.id)}
                                                                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-xl text-left"
                                                                    >
                                                                        <Trash2 size={14} /> Delete
                                                                    </button>
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </div>

                                                    {}
                                                    <AnimatePresence>
                                                        {movingDashboardId === dashboard.id && (
                                                            <motion.div 
                                                                initial={{ opacity: 0, scale: 0.95 }}
                                                                animate={{ opacity: 1, scale: 1 }}
                                                                exit={{ opacity: 0, scale: 0.95 }}
                                                                className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 z-[60] text-left"
                                                            >
                                                                <h5 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3">Pindah ke Folder</h5>
                                                                <input 
                                                                    autoFocus
                                                                    list="move-folder-list-list"
                                                                    value={editValue}
                                                                    onChange={e => setEditValue(e.target.value)}
                                                                    placeholder="Nama folder..."
                                                                    className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border-none rounded-xl mb-3 focus:ring-2 focus:ring-[var(--brand-primary)]/10 outline-none"
                                                                />
                                                                <datalist id="move-folder-list-list">
                                                                    {folders.map(f => <option key={f} value={f} />)}
                                                                    <option value="">(Tanpa Folder)</option>
                                                                </datalist>
                                                                <div className="flex gap-2">
                                                                    <button 
                                                                        onClick={() => handleMoveDashboard(dashboard.id, editValue)}
                                                                        className="flex-1 py-2 bg-[var(--brand-primary)] text-white text-[10px] font-bold rounded-lg uppercase tracking-wider"
                                                                    >
                                                                        Pindahkan
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => setMovingDashboardId(null)}
                                                                        className="flex-1 py-2 bg-[var(--surface-2)] text-[var(--text-muted)] text-[10px] font-bold rounded-lg uppercase tracking-wider"
                                                                    >
                                                                        Batal
                                                                    </button>
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {}
            <CustomerFeedbackFilterModal
                isOpen={showFilterModal}
                onClose={() => setShowFilterModal(false)}
                onApply={handleApplyFilter}
                loading={filterLoading}
                availableHubs={metadata.hubs}
                availableBranches={metadata.branches}
                availableAirlines={metadata.airlines}
                availableCategories={metadata.categories}
                existingFolders={folders}
            />
        </div>
    );
}
