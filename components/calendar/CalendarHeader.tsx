'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale/id';
import { addMonths } from 'date-fns/addMonths';
import { subMonths } from 'date-fns/subMonths';
import { addWeeks } from 'date-fns/addWeeks';
import { subWeeks } from 'date-fns/subWeeks';
import { addDays } from 'date-fns/addDays';
import { subDays } from 'date-fns/subDays';
import { ChevronLeft, ChevronRight, Search, Plus, Calendar, List, Clock, X } from 'lucide-react';
import { PrismInput } from '@/components/ui/PrismInput';
import { PrismSelect } from '@/components/ui/PrismSelect';
import { View } from 'react-big-calendar';

interface CalendarHeaderProps {
  currentDate: Date;
  currentView: View;
  onDateChange: (date: Date) => void;
  onViewChange: (view: View) => void;
  onSearchChange: (search: string) => void;
  onUserFilterChange: (userId: string) => void;
  onAddEvent: () => void;
  users: Array<{ value: string; label: string }>;
  canEdit?: boolean;
  userFilterValue?: string;
}

export function CalendarHeader({
  currentDate,
  currentView,
  onDateChange,
  onViewChange,
  onSearchChange,
  onUserFilterChange,
  onAddEvent,
  users,
  canEdit = false,
  userFilterValue = '',
}: CalendarHeaderProps) {
  const [searchValue, setSearchValue] = useState('');

  const handleSearchChange = useCallback((value: string) => {
    onSearchChange(value);
  }, [onSearchChange]);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearchChange(searchValue);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchValue, handleSearchChange]);

  const handlePrev = () => {
    switch (currentView) {
      case 'month':
        onDateChange(subMonths(currentDate, 1));
        break;
      case 'week':
        onDateChange(subWeeks(currentDate, 1));
        break;
      case 'day':
        onDateChange(subDays(currentDate, 1));
        break;
      default:
        onDateChange(subMonths(currentDate, 1));
    }
  };

  const handleNext = () => {
    switch (currentView) {
      case 'month':
        onDateChange(addMonths(currentDate, 1));
        break;
      case 'week':
        onDateChange(addWeeks(currentDate, 1));
        break;
      case 'day':
        onDateChange(addDays(currentDate, 1));
        break;
      default:
        onDateChange(addMonths(currentDate, 1));
    }
  };

  const handleToday = () => {
    onDateChange(new Date());
  };

  const formatDateLabel = () => {
    switch (currentView) {
      case 'month':
        return format(currentDate, 'MMMM yyyy', { locale: idLocale });
      case 'week':
        return format(currentDate, "'Week of' d MMM yyyy", { locale: idLocale });
      case 'day':
        return format(currentDate, 'EEEE, d MMMM yyyy', { locale: idLocale });
      case 'agenda':
        return format(currentDate, 'MMMM yyyy', { locale: idLocale });
      default:
        return format(currentDate, 'MMMM yyyy', { locale: idLocale });
    }
  };

  const viewButtons: Array<{ view: View; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { view: 'month', label: 'Bulan', icon: Calendar },
    { view: 'week', label: 'Minggu', icon: List },
    { view: 'day', label: 'Hari', icon: Clock },
  ];

  return (
    <div className="space-y-4">
      {}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[220px] max-w-xl relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
          <PrismInput
            type="text"
            placeholder="Cari kegiatan..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-10"
          />
          {searchValue && (
            <button
              onClick={() => setSearchValue('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-[var(--surface-4)] transition-colors"
              aria-label="Hapus pencarian"
            >
              <X className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            </button>
          )}
        </div>

        <div className="w-44 md:w-48">
          <PrismSelect
            options={[
              { value: '', label: 'Semua Pengguna' },
              ...users,
            ]}
            value={userFilterValue}
            onChange={(value) => onUserFilterChange(value)}
            placeholder="Filter pengguna"
          />
        </div>

        {canEdit && (
          <button
            onClick={onAddEvent}
            className="ml-auto inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Tambah Kegiatan</span>
            <span className="sm:hidden">Tambah</span>
          </button>
        )}
      </div>

      {}
      <div className="flex items-center justify-between gap-3">
        {}
        <div className="flex items-center gap-1 bg-[var(--surface-2)] rounded-xl p-1 shadow-[var(--inner-rim)]">
          {viewButtons.map(({ view, label, icon: Icon }) => (
            <button
              key={view}
              onClick={() => onViewChange(view)}
              className={`
                px-2.5 py-1.5 rounded-lg text-sm font-semibold
                transition-all duration-[var(--duration-fast)] ease-[var(--spring-snappy)]
                flex items-center gap-1.5
                focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)] focus-visible:outline-offset-1
                ${
                  currentView === view
                    ? 'bg-gradient-to-r from-[var(--brand-gradient-start)] to-[var(--brand-gradient-end)] text-[var(--text-on-brand)] shadow-[var(--shadow-sm)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)]'
                }
              `}
              aria-pressed={currentView === view}
              aria-label={`Tampilan ${label}`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={handleToday}
            className="px-2.5 py-1.5 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--brand-primary)] hover:bg-[var(--surface-3)] rounded-lg transition-all duration-[var(--duration-fast)] ease-[var(--spring-snappy)] focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)] focus-visible:outline-offset-1"
          >
            Hari ini
          </button>

          <div className="flex items-center gap-0.5">
            <button
              onClick={handlePrev}
              className="p-2 rounded-lg hover:bg-[var(--surface-3)] transition-all duration-[var(--duration-fast)] ease-[var(--spring-snappy)] focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)] focus-visible:outline-offset-1"
              aria-label="Sebelumnya"
            >
              <ChevronLeft className="w-5 h-5 text-[var(--text-primary)]" />
            </button>

            <h2 className="min-w-[10rem] sm:min-w-[14rem] text-center text-base sm:text-lg font-bold font-display tracking-tight text-[var(--text-primary)]">
              {formatDateLabel()}
            </h2>

            <button
              onClick={handleNext}
              className="p-2 rounded-lg hover:bg-[var(--surface-3)] transition-all duration-[var(--duration-fast)] ease-[var(--spring-snappy)] focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)] focus-visible:outline-offset-1"
              aria-label="Selanjutnya"
            >
              <ChevronRight className="w-5 h-5 text-[var(--text-primary)]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
