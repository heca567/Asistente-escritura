import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, FileText, GitBranch, Pencil, Save, X } from 'lucide-react';
import { afirmacionesRepository } from '../../models/Afirmaciones';
import type { Folder, UserProfile } from '../../types';
import type { ActualizacionAfirmacion, Afirmacion, RelacionesAfirmacion } from './types';

interface EdicionAfirmacion {
  readonly id: string;
  readonly texto: string;
  readonly tipo: string;
  readonly proyecto: string;
}

interface AfirmacionDetalleProps {
  readonly afirmaciones: readonly Afirmacion[];
  readonly afirmacion: Afirmacion | null;
  readonly relaciones: RelacionesAfirmacion;
  readonly nombreProyecto: string | null;
  readonly usuario: UserProfile | null;
  readonly tipoOpciones: readonly string[];
  readonly proyectos: readonly Folder[];
  readonly cargandoProyectos: boolean;
  readonly usuarioAutenticado: boolean;
  readonly errorProyectos: string | null;
  readonly onUpdateAfirmacion: (id: string, updates: ActualizacionAfirmacion) => void;
  readonly onSelectAfirmacion: (id: string) => void;
}

export const AfirmacionDetalle: React.FC<AfirmacionDetalleProps> = ({
  afirmaciones,
  afirmacion,
  relaciones,
  nombreProyecto,
  usuario,
  tipoOpciones,
  proyectos,
  cargandoProyectos,
  usuarioAutenticado,
  errorProyectos,
  onUpdateAfirmacion,
  onSelectAfirmacion,
}) => {
  const [draft, setDraft] = useState<EdicionAfirmacion | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [guardandoAfirmaciones, setGuardandoAfirmaciones] = useState(false);
  const [mensajeGuardado, setMensajeGuardado] = useState<{
    readonly tipo: 'success' | 'error' | 'info';
    readonly texto: string;
  } | null>(null);

  useEffect(() => {
    setDraft(null);
    setEditError(null);
  }, [afirmacion?.id]);

  const editing = Boolean(afirmacion && draft?.id === afirmacion.id);

  const startEditing = () => {
    if (!afirmacion) {
      return;
    }
    setDraft({
      id: afirmacion.id,
      texto: afirmacion.texto,
      tipo: afirmacion.tipo,
      proyecto: afirmacion.proyecto ?? '',
    });
    setEditError(null);
  };

  const cancelEditing = () => {
    setDraft(null);
    setEditError(null);
  };

  const saveEditing = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) {
      return;
    }

    const texto = draft.texto.trim();
    const tipo = draft.tipo.trim();
    if (!texto || !tipo) {
      setEditError('El texto y el tipo son obligatorios.');
      return;
    }

    onUpdateAfirmacion(draft.id, {
      texto,
      tipo,
      proyecto: draft.proyecto || null,
    });
    cancelEditing();
  };

  const discardAfirmacion = () => {
    if (!afirmacion) {
      return;
    }
    onUpdateAfirmacion(afirmacion.id, { estado: 'descartada' });
    cancelEditing();
  };

  const updateDraft =
    (field: keyof Omit<EdicionAfirmacion, 'id'>) =>
    (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement | HTMLSelectElement>) => {
      if (!draft) {
        return;
      }
      setDraft({ ...draft, [field]: event.target.value });
      setEditError(null);
    };

  const handleGuardarAfirmaciones = async () => {
    if (!usuario) {
      setMensajeGuardado({
        tipo: 'error',
        texto: 'Inicia sesión para guardar afirmaciones en Firestore.',
      });
      return;
    }

    setGuardandoAfirmaciones(true);
    setMensajeGuardado(null);
    try {
      const resultado = await afirmacionesRepository.saveVigentesConProyecto(
        afirmaciones,
        usuario
      );
      if (resultado.savedCount === 0) {
        setMensajeGuardado({
          tipo: 'info',
          texto: 'No hay afirmaciones vigentes con proyecto para guardar.',
        });
      } else {
        setMensajeGuardado({
          tipo: 'success',
          texto: `Se guardaron ${resultado.savedCount} afirmaciones vigentes con proyecto.${
            resultado.skippedCount > 0
              ? ` Se omitieron ${resultado.skippedCount} sin proyecto o no vigentes.`
              : ''
          }`,
        });
      }
    } catch (error) {
      const errorDetail =
        error instanceof Error ? error.message : 'Error desconocido al guardar.';
      const permissionDenied = errorDetail.includes('Missing or insufficient permissions');
      setMensajeGuardado({
        tipo: 'error',
        texto: permissionDenied
          ? 'Firestore rechazó el guardado. Comprueba que las reglas de la colección affirmations estén desplegadas en la base configurada y que el proyecto pertenezca a tu cuenta.'
          : `No se pudieron guardar las afirmaciones: ${errorDetail}`,
      });
    } finally {
      setGuardandoAfirmaciones(false);
    }
  };

  const cantidadGuardable = afirmaciones.filter(
    (item) => item.estado === 'vigente' && Boolean(item.proyecto?.trim())
  ).length;

  if (!afirmacion) {
    return (
      <section className="flex h-full items-center justify-center rounded-xl border border-[#DDD9CE] bg-[#FCFBF8] p-8 text-center">
        <div className="max-w-sm">
          <h2 className="font-serif text-xl font-medium text-[#18181B]">
            Detalle de afirmación
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-[#57534E]">
            Selecciona una afirmación de la lista para inspeccionar todos sus campos, fuentes y relaciones explícitas de evolución.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="afirmaciones-scroll flex h-full flex-col overflow-y-auto rounded-xl border border-[#DDD9CE] bg-[#FCFBF8] p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EFECE4] pb-4">
        <span className="rounded-md bg-[#EDF1F6] px-2.5 py-1 font-mono text-xs font-semibold text-[#1E3A5F]">
          {afirmacion.id}
        </span>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#44403C]">
          <span className="rounded-md bg-[#F3F1EA] px-2.5 py-1 font-medium">
            Tipo: {afirmacion.tipo}
          </span>
          <span className="rounded-md border border-[#D6D3C9] px-2.5 py-1">
            Proyecto: {nombreProyecto ?? 'Sin proyecto'}
          </span>
          <span className="rounded-md border border-[#D6D3C9] px-2.5 py-1">
            Estado: {afirmacion.estado}
          </span>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#78716C]">
            Afirmación
          </h3>
          {!editing && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={startEditing}
                className="inline-flex items-center gap-1 rounded-md border border-[#D6D3C9] bg-white px-2.5 py-1 text-[11px] font-medium text-[#44403C] hover:bg-[#F3F1EA]"
              >
                <Pencil className="h-3 w-3" />
                Editar
              </button>
              <button
                type="button"
                onClick={discardAfirmacion}
                disabled={afirmacion.estado === 'descartada'}
                className="inline-flex items-center gap-1 rounded-md border border-[#FECACA] bg-white px-2.5 py-1 text-[11px] font-medium text-[#B91C1C] hover:bg-[#FEF2F2] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X className="h-3 w-3" />
                {afirmacion.estado === 'descartada' ? 'Descartada' : 'Descartar'}
              </button>
            </div>
          )}
        </div>

        {editing && draft ? (
          <form onSubmit={saveEditing} className="mt-2 space-y-3">
            <label className="block text-[11px] font-medium text-[#57534E]">
              Texto
              <textarea
                required
                rows={4}
                value={draft.texto}
                onChange={updateDraft('texto')}
                className="mt-1 w-full resize-y rounded-md border border-[#DDD9CE] bg-white px-3 py-2 text-sm text-[#18181B] outline-none focus:border-[#1E3A5F]"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-[11px] font-medium text-[#57534E]">
                Tipo
                <input
                  required
                  list={`tipos-afirmacion-detalle-${afirmacion.id}`}
                  value={draft.tipo}
                  onChange={updateDraft('tipo')}
                  className="mt-1 w-full rounded-md border border-[#DDD9CE] bg-white px-2.5 py-2 text-xs text-[#18181B] outline-none focus:border-[#1E3A5F]"
                />
                <datalist id={`tipos-afirmacion-detalle-${afirmacion.id}`}>
                  {tipoOpciones.map((tipo) => (
                    <option key={tipo} value={tipo} />
                  ))}
                </datalist>
              </label>

              <label className="block text-[11px] font-medium text-[#57534E]">
                Proyecto
                <select
                  value={draft.proyecto}
                  onChange={updateDraft('proyecto')}
                  disabled={!usuarioAutenticado || cargandoProyectos}
                  className="mt-1 w-full rounded-md border border-[#DDD9CE] bg-white px-2.5 py-2 text-xs text-[#18181B] outline-none focus:border-[#1E3A5F] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">Sin proyecto</option>
                  {draft.proyecto &&
                    !proyectos.some((proyecto) => proyecto.id === draft.proyecto) && (
                      <option value={draft.proyecto}>
                        Proyecto no disponible ({draft.proyecto})
                      </option>
                    )}
                  {proyectos.map((proyecto) => (
                    <option key={proyecto.id} value={proyecto.id}>
                      {proyecto.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {cargandoProyectos && (
              <p className="text-[11px] text-[#78716C]">Cargando proyectos…</p>
            )}
            {!usuarioAutenticado && !cargandoProyectos && (
              <p className="text-[11px] text-[#78716C]">
                Inicia sesión para cargar proyectos de Firestore.
              </p>
            )}
            {errorProyectos && (
              <p role="alert" className="text-[11px] text-[#B91C1C]">
                No se pudieron cargar los proyectos: {errorProyectos}
              </p>
            )}
            {editError && (
              <p role="alert" className="text-[11px] text-[#B91C1C]">
                {editError}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={cancelEditing}
                className="inline-flex items-center gap-1 rounded-md border border-[#D6D3C9] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#44403C] hover:bg-[#F3F1EA]"
              >
                <X className="h-3 w-3" />
                Cancelar
              </button>
              <button
                type="button"
                onClick={discardAfirmacion}
                disabled={afirmacion.estado === 'descartada'}
                className="inline-flex items-center gap-1 rounded-md border border-[#FECACA] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#B91C1C] hover:bg-[#FEF2F2] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X className="h-3 w-3" />
                Descartar
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-md bg-[#1E3A5F] px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-[#274B78]"
              >
                <Save className="h-3 w-3" />
                Guardar
              </button>
            </div>
          </form>
        ) : (
          <p className="mt-2 font-serif text-xl leading-relaxed text-[#18181B]">
            {afirmacion.texto}
          </p>
        )}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-[#E5E2D9] bg-[#FAF9F4] p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#18181B]">
            <FileText className="h-3.5 w-3.5 text-[#1E3A5F]" />
            <span>Fuentes ({afirmacion.fuentes.length})</span>
          </div>
          {afirmacion.fuentes.length === 0 ? (
            <p className="mt-2 text-xs text-[#78716C]">Sin fuentes declaradas.</p>
          ) : (
            <ul className="mt-2.5 flex flex-wrap gap-1.5">
              {afirmacion.fuentes.map((fuente, index) => (
                <li
                  key={`${fuente}-${index}`}
                  className="rounded border border-[#D6D3C9] bg-white px-2 py-0.5 font-mono text-[11px] text-[#44403C]"
                >
                  {fuente}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-[#E5E2D9] bg-[#FAF9F4] p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#18181B]">
            <GitBranch className="h-3.5 w-3.5 text-[#1E3A5F]" />
            <span>Evolución</span>
          </div>
          <dl className="mt-2 space-y-1.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-[#78716C]">evolucion.tipo:</dt>
              <dd className="font-medium text-[#18181B]">{afirmacion.evolucion.tipo}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-[#78716C]">antecedentes declarados:</dt>
              <dd className="font-mono text-[#18181B]">
                {afirmacion.evolucion.antecedentes.length}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="mt-6 flex flex-col items-end gap-2 border-t border-[#EFECE4] pt-4">
        <p className="text-right text-[11px] text-[#78716C]">
          Se guardarán {cantidadGuardable} afirmaciones vigentes con proyecto asignado.
        </p>
        {!usuario && (
          <p className="text-right text-[11px] text-[#78716C]">
            Inicia sesión para guardar afirmaciones en Firestore.
          </p>
        )}
        {mensajeGuardado && (
          <p
            role={mensajeGuardado.tipo === 'error' ? 'alert' : 'status'}
            className={`text-right text-xs ${
              mensajeGuardado.tipo === 'error'
                ? 'text-[#B91C1C]'
                : mensajeGuardado.tipo === 'success'
                  ? 'text-[#166534]'
                  : 'text-[#78716C]'
            }`}
          >
            {mensajeGuardado.texto}
          </p>
        )}
        <button
          type="button"
          onClick={handleGuardarAfirmaciones}
          disabled={!usuario || guardandoAfirmaciones}
          className="inline-flex items-center gap-2 rounded-md bg-[#1E3A5F] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#274B78] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/40 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {guardandoAfirmaciones ? 'Guardando…' : 'Guardar Afirmaciones'}
        </button>
      </div>
    </section>
  );
};
