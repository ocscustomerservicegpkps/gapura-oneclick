
'use client';

import { useState, useEffect, useMemo } from 'react';
import { BuilderLayout, type SaveTile, type SaveConfig } from '@/components/builder/BuilderLayout';
import { Trash2, ExternalLink, Clock, ChevronDown, ChevronUp, BarChart3, Pencil, FolderInput } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SavedDashboard {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  folder: string | null;
  created_at: string;
}

export default function DashboardBuilderPage() {
  const [savedDashboards, setSavedDashboards] = useState<SavedDashboard[]>([]);
  const [savedExpanded, setSavedExpanded] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deletingFolder, setDeletingFolder] = useState<string | null>(null);
  const [movingDashboardId, setMovingDashboardId] = useState<string | null>(null);
  const [moveFolderValue, setMoveFolderValue] = useState('');

  useEffect(() => {
    fetchDashboards();
  }, []);

  const fetchDashboards = async () => {
    try {
      const res = await fetch('/api/dashboards');
      if (res.ok) {
        const data = await res.json();
        const dashboards = data.dashboards || [];
        setSavedDashboards(dashboards);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const uniqueFolders = Array.from(new Set(dashboards.map((d: any) => d.folder || 'Lainnya')));
        const initialExpanded: Record<string, boolean> = {};
        uniqueFolders.forEach(f => {
          initialExpanded[f as string] = true;
        });
        setExpandedFolders(initialExpanded);
      }
    } catch {  }
  };

  const handleSave = async (name: string, description: string, tiles: SaveTile[], config?: SaveConfig, folder?: string | null) => {
    try {
      const response = await fetch('/api/dashboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          folder,
          charts: tiles.map((t, i) => ({
            title: t.title,
            chartType: t.chartType,
            dataField: t.dataField || 'custom',
            width: t.width || 'half',
            position: i,
            query_config: t.query_config,
            visualization_config: t.visualization_config,
            layout: t.layout,
            page_name: t.page_name || 'Ringkasan Umum',
          })),
          config: config || { dateRange: '7d', autoRefresh: true, theme: 'dark' },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save');
      }

      const result = await response.json();
      fetchDashboards();
      return { embedUrl: result.dashboard.embedUrl };
    } catch (err) {
      console.error('Failed to save dashboard:', err);
      return null;
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/dashboards?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSavedDashboards(prev => prev.filter(d => d.id !== id));
      }
    } catch {  }
  };

  const handleRenameFolder = async (oldFolder: string, newFolder: string) => {
    const trimmed = newFolder.trim();
    if (!trimmed || trimmed === oldFolder) {
      setRenamingFolder(null);
      return;
    }

    setSavedDashboards(prev =>
      prev.map(d => d.folder === oldFolder ? { ...d, folder: trimmed } : d)
    );
    setExpandedFolders(prev => {
      const next = { ...prev };
      next[trimmed] = next[oldFolder] ?? true;
      delete next[oldFolder];
      return next;
    });
    setRenamingFolder(null);
    await fetch('/api/dashboards', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'rename', oldFolder, newFolder: trimmed }),
    });
  };

  const handleDeleteFolder = async (folder: string) => {

    setSavedDashboards(prev =>
      prev.map(d => d.folder === folder ? { ...d, folder: null } : d)
    );
    setDeletingFolder(null);
    setExpandedFolders(prev => {
      const next = { ...prev };
      delete next[folder];
      return next;
    });
    await fetch('/api/dashboards', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', folder }),
    });
  };

  const handleMoveDashboard = async (id: string, folder: string) => {
    const trimmed = folder.trim();
    const finalFolder = trimmed === '' ? null : trimmed;

    setSavedDashboards(prev =>
      prev.map(d => d.id === id ? { ...d, folder: finalFolder } : d)
    );
    setMovingDashboardId(null);

    await fetch('/api/dashboards', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, folder: finalFolder }),
    });
  };

  const existingFolders = useMemo(
    () =>
      Array.from(new Set(
        savedDashboards
          .map(d => d.folder)
          .filter((f): f is string => !!f)
      )),
    [savedDashboards]
  );

  return (
    <div
      className="fixed inset-0 flex flex-col bg-[var(--surface-1)] md:left-[260px]"
      style={{ zIndex: 10 }}
    >
      {}
      <div className={cn("flex-1 min-h-0 overflow-hidden", savedDashboards.length > 0 && "pb-[46px]")}>
        <BuilderLayout
          onSaveDashboard={handleSave}
          existingFolders={existingFolders}
        />
      </div>

      {}
      {savedDashboards.length > 0 && savedExpanded && (
        <div
          onClick={() => setSavedExpanded(false)}
          className="absolute inset-0 z-10 bg-black/10 backdrop-blur-[1px] animate-fade-in"
        />
      )}
      {savedDashboards.length > 0 && (
        <div className={cn(
          "absolute inset-x-0 bottom-0 z-20 border-t border-[var(--surface-4)] bg-[var(--surface-1)] transition-shadow",
          savedExpanded ? "rounded-t-2xl shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.25)]" : ""
        )}>
          {}
          <button
            onClick={() => setSavedExpanded(!savedExpanded)}
            className="w-full flex items-center justify-between px-6 py-3 hover:bg-[var(--surface-2)] transition-colors rounded-t-2xl"
          >
            <div className="flex items-center gap-2">
              <BarChart3 size={13} className="text-[var(--text-muted)]" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Dashboard Tersimpan
              </h3>
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-[var(--surface-3)] text-[var(--text-muted)] rounded-full">
                {savedDashboards.length}
              </span>
            </div>
            {savedExpanded ? <ChevronDown size={14} className="text-[var(--text-muted)]" /> : <ChevronUp size={14} className="text-[var(--text-muted)]" />}
          </button>

          {}
          {savedExpanded && (
            <div className="px-6 pb-3 max-h-[400px] overflow-y-auto custom-scrollbar">
              <div className="space-y-4 pt-2">
                {Object.entries(
                  savedDashboards.reduce((acc, d) => {
                    const folderName = d.folder || 'Lainnya';
                    if (!acc[folderName]) acc[folderName] = [];
                    acc[folderName].push(d);
                    return acc;
                  }, {} as Record<string, SavedDashboard[]>)
                ).sort(([a], [b]) => (a === 'Lainnya' ? 1 : b === 'Lainnya' ? -1 : a.localeCompare(b)))
                .map(([folderName, dashboards]) => (
                  <div key={folderName} className="space-y-2">
                    <div className="flex items-center gap-2 group/folder w-full">
                      {}
                      <div className="flex-1 h-px bg-[var(--surface-4)] group-hover/folder:bg-[var(--brand-primary)]/30 transition-colors" />

                      {}
                      {renamingFolder === folderName ? (
                        <div className="flex items-center gap-1">
                          <input
                            autoFocus
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleRenameFolder(folderName, renameValue);
                              if (e.key === 'Escape') setRenamingFolder(null);
                            }}
                            onBlur={() => handleRenameFolder(folderName, renameValue)}
                            className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest bg-[var(--surface-1)] border border-[var(--brand-primary)] rounded text-[var(--text-primary)] focus:outline-none w-32"
                          />
                        </div>
                      ) : deletingFolder === folderName ? (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-red-50 border border-red-200 rounded-full text-[10px]">
                          <span className="text-red-600 font-medium">Delete this folder? Dashboards will be moved to Other</span>
                          <button
                            onClick={() => handleDeleteFolder(folderName)}
                            className="font-bold text-red-600 hover:text-red-700 underline"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setDeletingFolder(null)}
                            className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setExpandedFolders(prev => ({ ...prev, [folderName]: !prev[folderName] }))}
                            className="flex items-center gap-1.5 px-3 py-1 bg-[var(--surface-2)] border border-[var(--surface-4)] rounded-full text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--brand-primary)] transition-colors"
                          >
                            <BarChart3 size={10} />
                            {folderName}
                            <span className="opacity-50">({dashboards.length})</span>
                            {expandedFolders[folderName] !== false ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                          </button>
                          {}
                          {folderName !== 'Lainnya' && (
                            <div className="flex items-center gap-0.5 opacity-0 group-hover/folder:opacity-100 transition-opacity">
                              <button
                                onClick={() => { setRenamingFolder(folderName); setRenameValue(folderName); }}
                                className="p-1 text-[var(--text-muted)] hover:text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/10 rounded transition-colors"
                                title="Ganti nama folder"
                              >
                                <Pencil size={10} />
                              </button>
                              <button
                                onClick={() => setDeletingFolder(folderName)}
                                className="p-1 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                title="Delete folder"
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {}
                      <div className="flex-1 h-px bg-[var(--surface-4)] group-hover/folder:bg-[var(--brand-primary)]/30 transition-colors" />
                    </div>

                    {expandedFolders[folderName] !== false && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 animate-fade-in">
                        {dashboards.map(d => (
                          <div
                            key={d.id}
                            className="group flex items-center justify-between p-3 bg-[var(--surface-2)] border border-[var(--surface-4)] rounded-xl hover:shadow-md hover:border-[var(--brand-primary)]/40 hover:-translate-y-px transition-all duration-200"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] font-bold text-[var(--text-primary)] truncate leading-tight mb-0.5">{d.name}</p>
                              <div className="flex items-center gap-2">
                                <span className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                                  <Clock size={10} />
                                  {new Date(d.created_at).toLocaleDateString('id-ID')}
                                </span>
                                {d.description && (
                                  <span className="w-1 h-1 rounded-full bg-[var(--surface-4)]" />
                                )}
                                {d.description && (
                                  <p className="text-[10px] text-[var(--text-muted)] truncate">{d.description}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-all">
                              <a
                                href={`/embed/custom/${d.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/10 rounded-lg transition-all"
                                title="Preview"
                              >
                                <ExternalLink size={14} />
                              </a>
                              <button
                                onClick={() => handleDelete(d.id)}
                                className="p-1.5 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                              <div className="relative">
                                <button
                                  onClick={() => {
                                    if (movingDashboardId === d.id) {
                                      setMovingDashboardId(null);
                                    } else {
                                      setMovingDashboardId(d.id);
                                      setMoveFolderValue(d.folder || '');
                                    }
                                  }}
                                  className={cn(
                                    "p-1.5 rounded-lg transition-all",
                                    movingDashboardId === d.id
                                      ? "text-[var(--brand-primary)] bg-[var(--brand-primary)]/10"
                                      : "text-[var(--text-muted)] hover:text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/10"
                                  )}
                                  title="Pindahkan ke folder"
                                >
                                  <FolderInput size={14} />
                                </button>
                                {movingDashboardId === d.id && (
                                  <div className="absolute right-0 top-full mt-2 p-3 bg-[var(--surface-1)] border border-[var(--surface-4)] rounded-xl shadow-xl z-50 w-48 animate-scale-in">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1 block">Pindah ke Folder</label>
                                    <input
                                      autoFocus
                                      list="move-folder-list"
                                      value={moveFolderValue}
                                      onChange={e => setMoveFolderValue(e.target.value)}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') handleMoveDashboard(d.id, moveFolderValue);
                                        if (e.key === 'Escape') setMovingDashboardId(null);
                                      }}
                                      placeholder="Nama folder..."
                                      className="w-full px-2 py-1.5 text-xs bg-[var(--surface-2)] border border-[var(--surface-4)] rounded focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)] text-[var(--text-primary)]"
                                    />
                                    <datalist id="move-folder-list">
                                      {existingFolders.map(f => (
                                        <option key={f} value={f} />
                                      ))}
                                      <option value="">(Tanpa Folder)</option>
                                    </datalist>
                                    <div className="flex gap-1.5 mt-2">
                                      <button
                                        onClick={() => handleMoveDashboard(d.id, moveFolderValue)}
                                        className="flex-1 py-1.5 text-[10px] font-bold bg-[var(--brand-primary)] text-white rounded hover:opacity-90"
                                      >
                                        Pindahkan
                                      </button>
                                      <button
                                        onClick={() => setMovingDashboardId(null)}
                                        className="flex-1 py-1.5 text-[10px] font-bold bg-[var(--surface-3)] text-[var(--text-muted)] rounded hover:text-[var(--text-primary)]"
                                      >
                                        Batal
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
