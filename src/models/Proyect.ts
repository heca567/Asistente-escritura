import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type { UserProfile } from '../types';

export interface Folder {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly color: string;
  readonly icon: string;
  readonly createdAt?: unknown;
  readonly updatedAt?: unknown;
}

export type Project = Folder;

export interface FolderInput {
  readonly name: string;
  readonly color: string;
  readonly icon: string;
}

export interface FirestoreProjectRepository {
  getAll(userId: string): Promise<Folder[]>;
  getById(id: string): Promise<Folder | null>;
  subscribe(
    userId: string,
    onFolders: (folders: Folder[]) => void,
    onError?: (error: Error) => void
  ): () => void;
  create(folder: FolderInput, user: Pick<UserProfile, 'uid'>, id: string): Promise<Folder>;
  update(id: string, folder: FolderInput): Promise<void>;
  delete(id: string): Promise<void>;
}

function sanitizeId(rawId: string): string {
  const cleaned = rawId.replace(/[^a-zA-Z0-9_\-]/g, '-').slice(0, 128);
  return cleaned || `proj_${Date.now().toString(36)}`;
}

function sanitizeFolderInput(folder: FolderInput): FolderInput {
  return {
    name: (folder.name.trim() || 'Nuevo proyecto').slice(0, 80),
    color: (folder.color.trim() || '#1E3A5F').slice(0, 32),
    icon: (folder.icon.trim() || 'folder').slice(0, 32),
  };
}

function mapFolderSnapshot(folderDoc: { id: string; data: () => DocumentData }): Folder {
  return { ...folderDoc.data(), id: folderDoc.id } as Folder;
}

function sortFolders(folders: Folder[]): Folder[] {
  return folders.sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export const projectRepository: FirestoreProjectRepository = {
  async getAll(userId: string): Promise<Folder[]> {
    try {
      const foldersQuery = query(collection(db, 'folders'), where('userId', '==', userId));
      const snapshot = await getDocs(foldersQuery);
      return sortFolders(snapshot.docs.map(mapFolderSnapshot));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'folders');
    }
  },

  async getById(id: string): Promise<Folder | null> {
    const safeId = sanitizeId(id);
    const docPath = `folders/${safeId}`;
    try {
      const snapshot = await getDoc(doc(db, 'folders', safeId));
      return snapshot.exists() ? mapFolderSnapshot(snapshot) : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, docPath);
    }
  },

  subscribe(
    userId: string,
    onFolders: (folders: Folder[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    const foldersQuery = query(collection(db, 'folders'), where('userId', '==', userId));

    return onSnapshot(
      foldersQuery,
      (snapshot) => onFolders(sortFolders(snapshot.docs.map(mapFolderSnapshot))),
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'folders');
        } catch (wrapped) {
          if (onError && wrapped instanceof Error) {
            onError(wrapped);
          }
        }
      }
    );
  },

  async create(folder: FolderInput, user: Pick<UserProfile, 'uid'>, id: string): Promise<Folder> {
    const safeId = sanitizeId(id);
    const sanitized = sanitizeFolderInput(folder);
    const docPath = `folders/${safeId}`;

    const newFolder: Folder = {
      id: safeId,
      userId: user.uid,
      name: sanitized.name,
      color: sanitized.color,
      icon: sanitized.icon,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, 'folders', safeId), newFolder);
      return newFolder;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, docPath);
    }
  },

  async update(id: string, folder: FolderInput): Promise<void> {
    const safeId = sanitizeId(id);
    const sanitized = sanitizeFolderInput(folder);
    const docPath = `folders/${safeId}`;

    try {
      await updateDoc(doc(db, 'folders', safeId), {
        name: sanitized.name,
        color: sanitized.color,
        icon: sanitized.icon,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, docPath);
    }
  },

  async delete(id: string): Promise<void> {
    const safeId = sanitizeId(id);
    const docPath = `folders/${safeId}`;

    try {
      await deleteDoc(doc(db, 'folders', safeId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, docPath);
    }
  },
};

export const folderRepository = projectRepository;
