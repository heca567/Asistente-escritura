import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type { UserProfile } from '../types';
import type { Afirmacion } from '../modules/afirmaciones/types';
import { filtrarAfirmacionesGuardables } from '../modules/afirmaciones/queries';

export interface FirestoreAfirmacion extends Omit<Afirmacion, 'proyecto'> {
  readonly userId: string;
  readonly projectId: string;
  readonly updatedAt?: unknown;
}

export interface SaveAfirmacionesResult {
  readonly savedCount: number;
  readonly skippedCount: number;
}

function buildDocumentId(userId: string, afirmacionId: string): string {
  return `${encodeURIComponent(userId)}_${encodeURIComponent(afirmacionId)}`;
}

export const afirmacionesRepository = {
  async saveVigentesConProyecto(
    afirmaciones: readonly Afirmacion[],
    user: Pick<UserProfile, 'uid'>
  ): Promise<SaveAfirmacionesResult> {
    const elegibles = filtrarAfirmacionesGuardables(afirmaciones);
    const batchSize = 500;

    try {
      for (let offset = 0; offset < elegibles.length; offset += batchSize) {
        const batch = writeBatch(db);
        const chunk = elegibles.slice(offset, offset + batchSize);

        for (const afirmacion of chunk) {
          const documentId = buildDocumentId(user.uid, afirmacion.id);
          const reference = doc(collection(db, 'affirmations'), documentId);
          const payload: FirestoreAfirmacion = {
            id: afirmacion.id,
            userId: user.uid,
            projectId: afirmacion.proyecto,
            texto: afirmacion.texto,
            tipo: afirmacion.tipo,
            origen: afirmacion.origen,
            estado: 'vigente',
            fuentes: [...afirmacion.fuentes],
            evolucion: {
              tipo: afirmacion.evolucion.tipo,
              antecedentes: [...afirmacion.evolucion.antecedentes],
            },
            updatedAt: serverTimestamp(),
          };
          batch.set(reference, payload);
        }

        await batch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'affirmations');
    }

    return {
      savedCount: elegibles.length,
      skippedCount: afirmaciones.length - elegibles.length,
    };
  },
};
