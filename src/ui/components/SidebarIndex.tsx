import React, { ChangeEvent } from 'react';
import { BookOpen, Plus, Search, Upload } from 'lucide-react';
import {
  NoteCardVM,
  StageFilterKey,
  StageFilterOptionVM,
  WorkspaceMetricsVM,
} from '../state/editor-ui.state';
import { NoteListItem } from './NoteListItem';

interface SidebarIndexProps {
  readonly noteCards: readonly NoteCardVM[];
  readonly stageFilters: readonly StageFilterOptionVM[];
  readonly searchQuery: string;
  readonly metrics: WorkspaceMetricsVM;
  readonly isLoading: boolean;
  readonly onSelectNote: (noteId: string) => void;
  readonly onCreateNote: () => void;
  readonly onRequestDelete: (noteId: string) => void;
  readonly onCancelDelete: () => void;
  readonly onConfirmDelete: (noteId: string) => void;
  readonly onChangeStageFilter: (filter: StageFilterKey) => void;
  readonly onChangeSearchQuery: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly onTriggerImport: () => void;
}

export const SidebarIndex: React.FC<SidebarIndexProps> = ({
  noteCards,
  stageFilters,
  searchQuery,
  metrics,
  isLoading,
  onSelectNote,
  onCreateNote,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
  onChangeStageFilter,
  onChangeSearchQuery,
  onTriggerImport,
}) => {
  return (
    <aside className="flex h-full w-full shrink-0 flex-col border-r border-[#E5E2D9] bg-[#F3F1EA] md:w-80">
      <div className="flex items-center justify-between border-b border-[#E5E2D9] px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <BookOpen className="h-4 w-4 text-[#1E3A5F]" />
          <span className="font-serif text-lg font-semibold tracking-tight text-[#18181B]">
            Folio
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onTriggerImport}
            title="Importar archivo Markdown"
            className="inline-flex items-center gap-1.5 rounded-md border border-[#D6D3C9] bg-[#FCFBF8] px-2.5 py-1.5 text-xs font-medium text-[#44403C] hover:bg-[#EFECE4] transition-colors whitespace-nowrap shrink-0"
          >
            <Upload className="h-3.5 w-3.5" />
            Importar
          </button>
          <button
            type="button"
            onClick={onCreateNote}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#1E3A5F] px-3 py-1.5 text-xs font-medium text-[#FCFBF8] hover:bg-[#162C49] transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            Nueva
          </button>
        </div>
      </div>

      <div className="border-b border-[#E5E2D9] px-4 py-3 space-y-2.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#78716C]" />
          <input
            type="search"
            value={searchQuery}
            onChange={onChangeSearchQuery}
            placeholder="Buscar título, texto o etiqueta…"
            className="w-full rounded-md border border-[#DDD9CE] bg-[#FCFBF8] py-1.5 pl-8 pr-3 text-xs text-[#18181B] placeholder:text-[#A8A29E] focus:border-[#1E3A5F] focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-1">
          {stageFilters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => onChangeStageFilter(filter.key)}
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                filter.isActive
                  ? 'bg-[#1E3A5F] text-[#FCFBF8]'
                  : 'bg-[#E9E6DC]/70 text-[#57534E] hover:bg-[#E2DFD3] hover:text-[#18181B]'
              }`}
            >
              {filter.label} ({filter.count})
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2.5 py-2.5 space-y-1">
        {isLoading ? (
          <div className="px-3 py-8 text-center text-xs text-[#78716C]">
            Cargando archivo local…
          </div>
        ) : noteCards.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs leading-relaxed text-[#78716C]">
            No hay manuscritos que coincidan con el filtro actual.
          </div>
        ) : (
          noteCards.map((note) => (
            <NoteListItem
              key={note.id}
              note={note}
              onSelect={onSelectNote}
              onRequestDelete={onRequestDelete}
              onCancelDelete={onCancelDelete}
              onConfirmDelete={onConfirmDelete}
            />
          ))
        )}
      </div>

      <footer className="border-t border-[#E5E2D9] px-4 py-2.5 text-[11px] text-[#78716C] tabular-nums">
        <div className="flex items-center justify-between gap-2">
          <span>{metrics.totalNotes} manuscritos</span>
          <span>{metrics.totalWordsLabel}</span>
        </div>
      </footer>
    </aside>
  );
};
