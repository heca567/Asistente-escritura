import React from 'react';
import { RotateCcw } from 'lucide-react';
import type { Folder } from '../../types';
import type { Afirmacion } from './types';

interface AfirmacionesProps {
  readonly afirmaciones: readonly Afirmacion[];
  readonly totalCount: number;
  readonly filtrosActivos: boolean;
  readonly selectedId: string | null;
  readonly proyectos: readonly Folder[];
  readonly onClearFiltros: () => void;
  readonly onSelectAfirmacion: (id: string) => void;
}

export const Afirmaciones: React.FC<AfirmacionesProps> = ({
  afirmaciones,
  totalCount,
  filtrosActivos,
  selectedId,
  proyectos,
  onClearFiltros,
  onSelectAfirmacion,
}) => (
  <section className="flex h-full flex-col overflow-hidden rounded-xl border border-[#DDD9CE] bg-[#F3F1EA]">
    <div className="flex items-center justify-between gap-2 border-b border-[#E5E2D9] px-4 py-3">
      <h2 className="font-serif text-base font-medium text-[#18181B]">
        Afirmaciones ({afirmaciones.length}
        {totalCount !== afirmaciones.length ? ` de ${totalCount}` : ''})
      </h2>
      {filtrosActivos && (
        <button
          type="button"
          onClick={onClearFiltros}
          className="inline-flex items-center gap-1 rounded-md border border-[#D6D3C9] bg-[#FCFBF8] px-2 py-1 text-[11px] font-medium text-[#44403C] hover:bg-[#EFECE4] transition-colors"
        >
          <RotateCcw className="h-3 w-3" />
          Limpiar
        </button>
      )}
    </div>

    <div className="afirmaciones-scroll flex-1 space-y-1.5 overflow-y-auto p-2.5">
      {totalCount === 0 ? (
        <div className="px-3 py-10 text-center text-xs leading-relaxed text-[#78716C]">
          Pega un JSON arriba y pulsa <strong>Procesar JSON</strong> para explorar las afirmaciones.
        </div>
      ) : afirmaciones.length === 0 ? (
        <div className="px-3 py-10 text-center text-xs leading-relaxed text-[#78716C]">
          Ninguna afirmación coincide con la búsqueda o filtros activos.
        </div>
      ) : (
        afirmaciones.map((item) => {
          const isSelected = item.id === selectedId;
          const projectName =
            proyectos.find((proyecto) => proyecto.id === item.proyecto)?.name ?? 'Sin proyecto';

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectAfirmacion(item.id)}
              aria-pressed={isSelected}
              className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                isSelected
                  ? 'border-[#1E3A5F] bg-[#FCFBF8] shadow-xs'
                  : 'border-transparent bg-[#FAF9F4]/80 hover:border-[#D6D3C9] hover:bg-[#FCFBF8]'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <span className="font-mono text-[11px] font-semibold text-[#1E3A5F]">
                  {item.id}
                </span>
                <div className="flex flex-wrap items-center gap-1 text-[10px] text-[#57534E]">
                  <span className="rounded bg-[#E9E6DC] px-1.5 py-0.5 font-medium">
                    {item.tipo}
                  </span>
                  <span className="rounded border border-[#D6D3C9] px-1.5 py-0.5">
                    Proyecto: {projectName}
                  </span>
                  <span className="rounded border border-[#D6D3C9] px-1.5 py-0.5">
                    {item.estado}
                  </span>
                </div>
              </div>

              <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-[#18181B]">
                {item.texto}
              </p>

              <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-[#78716C]">
                <span>Evolución: {item.evolucion.tipo}</span>
                <span className="tabular-nums">
                  {item.fuentes.length} {item.fuentes.length === 1 ? 'fuente' : 'fuentes'} ·{' '}
                  {item.evolucion.antecedentes.length} ant.
                </span>
              </div>
            </button>
          );
        })
      )}
    </div>
  </section>
);
