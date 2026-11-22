import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type { UserProfile } from '../types';

export interface Comment {
  readonly id: string;
  readonly userId: string;
  readonly noteId: string;
  readonly content: string;
  readonly createdAt?: unknown;
  readonly updatedAt?: unknown;
}

export interface CommentInput {
  readonly noteId: string;
  readonly content: string;
}

export interface CommentUpdates {
  readonly content?: string;
}

export interface FirestoreCommentRepository {
  getAll(userId: string): Promise<Comment[]>;
  getByNoteId(noteId: string, userId: string): Promise<Comment[]>;
  getById(id: string): Promise<Comment | null>;
  create(comment: CommentInput, user: Pick<UserProfile, 'uid'>, id: string): Promise<Comment>;
  update(id: string, updates: CommentUpdates): Promise<void>;
  delete(id: string): Promise<void>;
}

function sanitizeId(rawId: string): string {
  const cleaned = rawId.replace(/[^a-zA-Z0-9_\-]/g, '-').slice(0, 128);
  return cleaned || `comment_${Date.now().toString(36)}`;
}

function sanitizeContent(content: string): string {
  const sanitized = content.trim().slice(0, 5000);
  if (!sanitized) {
    throw new Error('El comentario no puede estar vacío.');
  }
  return sanitized;
}

function mapComment(id: string, data: DocumentData): Comment {
  return { ...data, id } as Comment;
}

export const commentRepository: FirestoreCommentRepository = {
  async getAll(userId: string): Promise<Comment[]> {
    try {
      const commentsQuery = query(collection(db, 'comments'), where('userId', '==', userId));
      const snapshot = await getDocs(commentsQuery);
      return snapshot.docs.map((commentDoc) => mapComment(commentDoc.id, commentDoc.data()));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'comments');
    }
  },

  async getByNoteId(noteId: string, userId: string): Promise<Comment[]> {
    const safeNoteId = sanitizeId(noteId);
    try {
      const commentsQuery = query(
        collection(db, 'comments'),
        where('userId', '==', userId),
        where('noteId', '==', safeNoteId)
      );
      const snapshot = await getDocs(commentsQuery);
      return snapshot.docs.map((commentDoc) => mapComment(commentDoc.id, commentDoc.data()));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'comments');
    }
  },

  async getById(id: string): Promise<Comment | null> {
    const safeId = sanitizeId(id);
    const docPath = `comments/${safeId}`;
    try {
      const snapshot = await getDoc(doc(db, 'comments', safeId));
      return snapshot.exists() ? mapComment(snapshot.id, snapshot.data()) : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, docPath);
    }
  },

  async create(
    comment: CommentInput,
    user: Pick<UserProfile, 'uid'>,
    id: string
  ): Promise<Comment> {
    const safeId = sanitizeId(id);
    const docPath = `comments/${safeId}`;
    const payload = {
      id: safeId,
      userId: user.uid,
      noteId: sanitizeId(comment.noteId),
      content: sanitizeContent(comment.content),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, 'comments', safeId), payload);
      const now = new Date().toISOString();
      return { ...payload, createdAt: now, updatedAt: now };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, docPath);
    }
  },

  async update(id: string, updates: CommentUpdates): Promise<void> {
    const safeId = sanitizeId(id);
    const docPath = `comments/${safeId}`;
    const sanitizedUpdates: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (updates.content !== undefined) {
      sanitizedUpdates.content = sanitizeContent(updates.content);
    }

    try {
      await updateDoc(doc(db, 'comments', safeId), sanitizedUpdates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, docPath);
    }
  },

  async delete(id: string): Promise<void> {
    const safeId = sanitizeId(id);
    const docPath = `comments/${safeId}`;
    try {
      await deleteDoc(doc(db, 'comments', safeId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, docPath);
    }
  },
};

export const commentsRepository = commentRepository;
