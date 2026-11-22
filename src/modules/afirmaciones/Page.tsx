import React, { useState } from 'react';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { ExplorerPage } from './ExplorerPage';
import { PegarJson } from './PegarJson';
import './style.css';
import type { Afirmacion } from './types';
import { parsearYValidarAfirmaciones } from './validations';

interface ExploradorAfirmacionesPageProps {
  readonly onNavigateHome?: () => void;
}

export const Page: React.FC<ExploradorAfirmacionesPageProps> = ({ onNavigateHome }) => {
  const [rawJson, setRawJson] = useState<string>('');
  const [afirmaciones, setAfirmaciones] = useState<readonly Afirmacion[]>([]);
  const [errores, setErrores] = useState<readonly string[]>([]);
  const [exploradorAbierto, setExploradorAbierto] = useState(false);

  const handleProcesarJson = () => {
    const resultado = parsearYValidarAfirmaciones(rawJson);

    if (!resultado.ok) {
      setErrores(resultado.errores);
      return;
    }

    setErrores([]);
    setAfirmaciones(resultado.afirmaciones);
    setExploradorAbierto(true);
  };

  if (exploradorAbierto) {
    return (
      <ExplorerPage
        afirmaciones={afirmaciones}
        onChangeAfirmaciones={setAfirmaciones}
        onBackToJson={() => setExploradorAbierto(false)}
        onNavigateHome={onNavigateHome}
      />
    );
  }

  return (
    <div className="afirmaciones-shell flex min-h-screen w-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E2D9] bg-[#FAF9F4] px-5 py-3">
        <div className="flex items-center gap-3">
          <BookOpen className="h-4 w-4 text-[#1E3A5F]" />
          <div>
            <h1 className="font-serif text-lg font-semibold tracking-tight text-[#18181B]">
              Explorador de Afirmaciones
            </h1>
            <p className="text-[11px] text-[#78716C]">
              Inspección estructurada de afirmaciones, fuentes y relaciones explícitas
            </p>
          </div>
        </div>

        {onNavigateHome && (
          <button
            type="button"
            onClick={onNavigateHome}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#D6D3C9] bg-[#FCFBF8] px-3 py-1.5 text-xs font-medium text-[#44403C] hover:bg-[#EFECE4] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver al estudio
          </button>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 p-4 md:p-6">
        <PegarJson
          rawJson={rawJson}
          errores={errores}
          totalCargadas={afirmaciones.length}
          onChangeJson={setRawJson}
          onProcesar={handleProcesarJson}
        />
      </main>
    </div>
  );
};

export default Page;
