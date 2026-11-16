import { Note, SyncStatus } from '../../domain/models/note.model';
import { WritingStage } from '../../domain/models/writing-flow.model';

export type StageFilterKey = WritingStage | 'ALL';

export type FeedbackTone = 'info' | 'success' | 'warning' | 'error';

export interface FeedbackNoticeVM {
  readonly id: string;
  readonly tone: FeedbackTone;
  readonly message: string;
}

export interface SyncConfigDraftVM {
  readonly owner: string;
  readonly repo: string;
  readonly branch: string;
  readonly basePath: string;
  readonly token: string;
}

export interface NoteCardVM {
  readonly id: string;
  readonly title: string;
  readonly excerpt: string;
  readonly stage: WritingStage;
  readonly stageLabel: string;
  readonly syncStatus: SyncStatus;
  readonly syncLabel: string;
  readonly hasConflict: boolean;
  readonly wordCountLabel: string;
  readonly updatedAtLabel: string;
  readonly tagsLine: string;
  readonly isSelected: boolean;
  readonly isConfirmingDelete: boolean;
}

export interface StageFilterOptionVM {
  readonly key: StageFilterKey;
  readonly label: string;
  readonly count: number;
  readonly isActive: boolean;
}

export interface StageTransitionOptionVM {
  readonly targetStage: WritingStage;
  readonly label: string;
  readonly description: string;
}

export interface MarkdownBlockVM {
  readonly id: string;
  readonly kind: 'h1' | 'h2' | 'h3' | 'quote' | 'list-item' | 'code' | 'hr' | 'paragraph';
  readonly text: string;
}

export interface ActiveNoteVM {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly tagsInput: string;
  readonly stage: WritingStage;
  readonly stageLabel: string;
  readonly stageDescription: string;
  readonly syncStatus: SyncStatus;
  readonly syncLabel: string;
  readonly hasConflict: boolean;
  readonly updatedAtLabel: string;
  readonly wordCount: number;
  readonly characterCount: number;
  readonly paragraphCount: number;
  readonly readingTimeLabel: string;
  readonly isDirty: boolean;
  readonly previewBlocks: readonly MarkdownBlockVM[];
}

export interface WorkspaceMetricsVM {
  readonly totalNotes: number;
  readonly totalWordsLabel: string;
  readonly pendingSyncCount: number;
  readonly conflictCount: number;
}

export interface EditorUIState {
  readonly notes: readonly Note[];
  readonly activeNoteId: string | null;
  readonly draftTitle: string;
  readonly draftContent: string;
  readonly draftTagsInput: string;
  readonly stageFilter: StageFilterKey;
  readonly searchQuery: string;
  readonly isFocusMode: boolean;
  readonly isPreviewMode: boolean;
  readonly isSidebarOpen: boolean;
  readonly isDirty: boolean;
  readonly isLoading: boolean;
  readonly isSaving: boolean;
  readonly isSyncing: boolean;
  readonly isSyncModalOpen: boolean;
  readonly syncConfigDraft: SyncConfigDraftVM;
  readonly isSyncConfigured: boolean;
  readonly isOnline: boolean;
  readonly isPWAInstallable: boolean;
  readonly isPWAInstalled: boolean;
  readonly isIOSDevice: boolean;
  readonly isIOSInstallGuideOpen: boolean;
  readonly confirmDeleteId: string | null;
  readonly feedback: FeedbackNoticeVM | null;
}

export function createInitialEditorUIState(): EditorUIState {
  return {
    notes: [],
    activeNoteId: null,
    draftTitle: '',
    draftContent: '',
    draftTagsInput: '',
    stageFilter: 'ALL',
    searchQuery: '',
    isFocusMode: false,
    isPreviewMode: false,
    isSidebarOpen: true,
    isDirty: false,
    isLoading: true,
    isSaving: false,
    isSyncing: false,
    isSyncModalOpen: false,
    syncConfigDraft: {
      owner: '',
      repo: '',
      branch: 'main',
      basePath: 'notas',
      token: '',
    },
    isSyncConfigured: false,
    isOnline: true,
    isPWAInstallable: false,
    isPWAInstalled: false,
    isIOSDevice: false,
    isIOSInstallGuideOpen: false,
    confirmDeleteId: null,
    feedback: null,
  };
}
