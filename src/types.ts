export type { FirestoreNote } from './models/Notes';
export type { Folder, Project } from './models/Proyect';

export interface UserProfile {
  readonly uid: string;
  readonly displayName: string;
  readonly email: string | null;
  readonly photoURL: string | null;
}
