import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { Note, SyncStatus } from '../../domain/models/note.model';
import {
  STAGE_DESCRIPTORS,
  WRITING_STAGES_ORDER,
  WritingStage,
} from '../../domain/models/writing-flow.model';
import { ManageNotesUseCase } from '../../domain/use-cases/manage-notes.usecase';
import { SyncWorkspaceUseCase } from '../../domain/use-cases/sync-workspace.usecase';
import { TransitionStageUseCase } from '../../domain/use-cases/transition-stage.usecase';
import { editorUIReducer } from '../state/editor-ui.reducer';
import {
  ActiveNoteVM,
  createInitialEditorUIState,
  EditorUIState,
  MarkdownBlockVM,
  NoteCardVM,
  StageFilterKey,
  StageFilterOptionVM,
  StageTransitionOptionVM,
  SyncConfigDraftVM,
  WorkspaceMetricsVM,
} from '../state/editor-ui.state';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export interface StudioUseCases {
  readonly manageNotes: ManageNotesUseCase;
  readonly transitionStage: TransitionStageUseCase;
  readonly syncWorkspace: SyncWorkspaceUseCase;
}

export interface NoteStudioViewModel {
  readonly ui: EditorUIState;
  readonly noteCards: readonly NoteCardVM[];
  readonly activeNote: ActiveNoteVM | null;
  readonly stageFilters: readonly StageFilterOptionVM[];
  readonly allowedTransitions: readonly StageTransitionOptionVM[];
  readonly workspaceMetrics: WorkspaceMetricsVM;
  readonly fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export interface NoteStudioActions {
  readonly selectNote: (noteId: string) => void;
  readonly createNote: () => Promise<void>;
  readonly saveActiveNote: () => Promise<void>;
  readonly requestDeleteNote: (noteId: string) => void;
  readonly cancelDeleteNote: () => void;
  readonly confirmDeleteNote: (noteId: string) => Promise<void>;
  readonly transitionNoteStage: (targetStage: WritingStage) => Promise<void>;
  readonly changeDraftTitle: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly changeDraftContent: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  readonly changeDraftTags: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly changeStageFilter: (filter: StageFilterKey) => void;
  readonly changeSearchQuery: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly toggleFocusMode: () => void;
  readonly togglePreviewMode: () => void;
  readonly toggleSidebar: () => void;
  readonly exportActiveNote: () => Promise<void>;
  readonly triggerImportMarkdown: () => void;
  readonly handleImportFileChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  readonly triggerSync: () => Promise<void>;
  readonly openSyncModal: () => void;
  readonly closeSyncModal: () => void;
  readonly changeSyncConfigField: (
    field: keyof SyncConfigDraftVM
  ) => (event: ChangeEvent<HTMLInputElement>) => void;
  readonly submitSyncConfig: (event: FormEvent<HTMLFormElement>) => void;
  readonly clearSyncConfig: () => void;
  readonly resolveConflictKeepLocal: () => Promise<void>;
  readonly resolveConflictKeepRemote: () => Promise<void>;
  readonly installPWA: () => Promise<void>;
  readonly openIOSInstallGuide: () => void;
  readonly closeIOSInstallGuide: () => void;
  readonly dismissFeedback: () => void;
}

const SYNC_STATUS_LABELS: Readonly<Record<SyncStatus, string>> = {
  [SyncStatus.LOCAL_ONLY]: 'Solo local',
  [SyncStatus.PENDING_SYNC]: 'Pendiente',
  [SyncStatus.SYNCED]: 'Sincronizado',
  [SyncStatus.CONFLICT]: 'Conflicto',
};

function parseTagsInput(rawInput: string): readonly string[] {
  return rawInput
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function formatRelativeDate(isoDate: string): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return 'Reciente';
  }
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

function parseMarkdownPreviewBlocks(markdown: string): readonly MarkdownBlockVM[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: MarkdownBlockVM[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];

  lines.forEach((rawLine, index) => {
    const trimmed = rawLine.trim();

    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        blocks.push({
          id: `block-${index}`,
          kind: 'code',
          text: codeLines.join('\n'),
        });
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeLines.push(rawLine);
      return;
    }

    if (!trimmed) {
      return;
    }

    if (trimmed === '---' || trimmed === '***') {
      blocks.push({ id: `block-${index}`, kind: 'hr', text: '' });
      return;
    }

    if (trimmed.startsWith('### ')) {
      blocks.push({ id: `block-${index}`, kind: 'h3', text: trimmed.slice(4) });
      return;
    }

    if (trimmed.startsWith('## ')) {
      blocks.push({ id: `block-${index}`, kind: 'h2', text: trimmed.slice(3) });
      return;
    }

    if (trimmed.startsWith('# ')) {
      blocks.push({ id: `block-${index}`, kind: 'h1', text: trimmed.slice(2) });
      return;
    }

    if (trimmed.startsWith('> ')) {
      blocks.push({ id: `block-${index}`, kind: 'quote', text: trimmed.slice(2) });
      return;
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      blocks.push({ id: `block-${index}`, kind: 'list-item', text: trimmed.slice(2) });
      return;
    }

    blocks.push({ id: `block-${index}`, kind: 'paragraph', text: trimmed });
  });

  if (codeLines.length > 0) {
    blocks.push({ id: 'block-code-tail', kind: 'code', text: codeLines.join('\n') });
  }

  return blocks;
}

export function useNoteStudioHandler(useCases: StudioUseCases): {
  readonly vm: NoteStudioViewModel;
  readonly actions: NoteStudioActions;
} {
  const { manageNotes, transitionStage, syncWorkspace } = useCases;
  const [state, dispatch] = useReducer(editorUIReducer, undefined, createInitialEditorUIState);

  const deferredInstallPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const persistCurrentDraft = useCallback(
    async (noteId: string, title: string, content: string, tagsInput: string): Promise<Note | null> => {
      dispatch({ type: 'SAVE_NOTE_START' });
      try {
        const saved = await manageNotes.updateNote(noteId, {
          title,
          content,
          tags: parseTagsInput(tagsInput),
        });
        dispatch({ type: 'SAVE_NOTE_SUCCESS', payload: { note: saved } });
        return saved;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo guardar la nota.';
        dispatch({ type: 'SAVE_NOTE_ERROR', payload: { message } });
        return null;
      }
    },
    [manageNotes]
  );

  useEffect(() => {
    let isMounted = true;

    const bootstrapWorkspace = async () => {
      dispatch({ type: 'LOAD_NOTES_START' });
      try {
        const notes = await manageNotes.listNotes();
        if (!isMounted) {
          return;
        }
        dispatch({ type: 'LOAD_NOTES_SUCCESS', payload: { notes } });
        dispatch({
          type: 'SET_SYNC_STATUS_FLAG',
          payload: { isConfigured: syncWorkspace.isSyncConfigured() },
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }
        const message = error instanceof Error ? error.message : 'Error al cargar notas locales.';
        dispatch({ type: 'LOAD_NOTES_ERROR', payload: { message } });
      }
    };

    void bootstrapWorkspace();

    return () => {
      isMounted = false;
    };
  }, [manageNotes, syncWorkspace]);

  useEffect(() => {
    const updateOnline = () => {
      dispatch({ type: 'SET_ONLINE_STATUS', payload: { isOnline: navigator.onLine } });
    };

    updateOnline();
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    const isIOS = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());

    dispatch({
      type: 'SET_PWA_STATE',
      payload: {
        isInstallable: Boolean(deferredInstallPromptRef.current),
        isInstalled: isStandalone,
        isIOSDevice: isIOS,
      },
    });

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      deferredInstallPromptRef.current = event as BeforeInstallPromptEvent;
      dispatch({
        type: 'SET_PWA_STATE',
        payload: { isInstallable: true, isInstalled: isStandalone, isIOSDevice: isIOS },
      });
    };

    const onAppInstalled = () => {
      deferredInstallPromptRef.current = null;
      dispatch({
        type: 'SET_PWA_STATE',
        payload: { isInstallable: false, isInstalled: true, isIOSDevice: isIOS },
      });
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (!state.isDirty || !state.activeNoteId) {
      return;
    }

    const activeId = state.activeNoteId;
    const title = state.draftTitle;
    const content = state.draftContent;
    const tagsInput = state.draftTagsInput;

    const timerId = window.setTimeout(() => {
      void persistCurrentDraft(activeId, title, content, tagsInput);
    }, 1000);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [
    state.isDirty,
    state.activeNoteId,
    state.draftTitle,
    state.draftContent,
    state.draftTagsInput,
    persistCurrentDraft,
  ]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (state.activeNoteId && state.isDirty) {
          void persistCurrentDraft(
            state.activeNoteId,
            state.draftTitle,
            state.draftContent,
            state.draftTagsInput
          );
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    state.activeNoteId,
    state.isDirty,
    state.draftTitle,
    state.draftContent,
    state.draftTagsInput,
    persistCurrentDraft,
  ]);

  const selectNote = useCallback(
    (noteId: string) => {
      if (state.activeNoteId === noteId) {
        return;
      }

      if (state.activeNoteId && state.isDirty) {
        void persistCurrentDraft(
          state.activeNoteId,
          state.draftTitle,
          state.draftContent,
          state.draftTagsInput
        );
      }

      const target = state.notes.find((item) => item.id === noteId);
      if (target) {
        dispatch({ type: 'SELECT_NOTE', payload: { note: target } });
      }
    },
    [
      state.activeNoteId,
      state.isDirty,
      state.draftTitle,
      state.draftContent,
      state.draftTagsInput,
      state.notes,
      persistCurrentDraft,
    ]
  );

  const createNote = useCallback(async () => {
    if (state.activeNoteId && state.isDirty) {
      await persistCurrentDraft(
        state.activeNoteId,
        state.draftTitle,
        state.draftContent,
        state.draftTagsInput
      );
    }

    const initialStage =
      state.stageFilter !== 'ALL' ? state.stageFilter : WritingStage.SEED;

    const created = await manageNotes.createNote({
      title: 'Nuevo manuscrito',
      content: '',
      stage: initialStage,
      tags: [],
    });

    dispatch({ type: 'CREATE_NOTE_SUCCESS', payload: { note: created } });
  }, [
    state.activeNoteId,
    state.isDirty,
    state.draftTitle,
    state.draftContent,
    state.draftTagsInput,
    state.stageFilter,
    manageNotes,
    persistCurrentDraft,
  ]);

  const saveActiveNote = useCallback(async () => {
    if (!state.activeNoteId) {
      return;
    }
    const saved = await persistCurrentDraft(
      state.activeNoteId,
      state.draftTitle,
      state.draftContent,
      state.draftTagsInput
    );
    if (saved) {
      dispatch({
        type: 'SET_FEEDBACK',
        payload: {
          notice: {
            id: `saved-${Date.now()}`,
            tone: 'success',
            message: 'Manuscrito guardado localmente.',
          },
        },
      });
    }
  }, [
    state.activeNoteId,
    state.draftTitle,
    state.draftContent,
    state.draftTagsInput,
    persistCurrentDraft,
  ]);

  const requestDeleteNote = useCallback((noteId: string) => {
    dispatch({ type: 'DELETE_NOTE_REQUEST', payload: { noteId } });
  }, []);

  const cancelDeleteNote = useCallback(() => {
    dispatch({ type: 'DELETE_NOTE_CANCEL' });
  }, []);

  const confirmDeleteNote = useCallback(
    async (noteId: string) => {
      await manageNotes.deleteNote(noteId);
      dispatch({ type: 'DELETE_NOTE_SUCCESS', payload: { noteId } });
    },
    [manageNotes]
  );

  const transitionNoteStage = useCallback(
    async (targetStage: WritingStage) => {
      if (!state.activeNoteId) {
        return;
      }

      if (state.isDirty) {
        await persistCurrentDraft(
          state.activeNoteId,
          state.draftTitle,
          state.draftContent,
          state.draftTagsInput
        );
      }

      try {
        const updated = await transitionStage.execute(state.activeNoteId, targetStage);
        dispatch({ type: 'TRANSITION_STAGE_SUCCESS', payload: { note: updated } });
        dispatch({
          type: 'SET_FEEDBACK',
          payload: {
            notice: {
              id: `stage-${Date.now()}`,
              tone: 'success',
              message: `Etapa actualizada a "${STAGE_DESCRIPTORS[targetStage].label}".`,
            },
          },
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'No se pudo cambiar la etapa del manuscrito.';
        dispatch({
          type: 'SET_FEEDBACK',
          payload: { notice: { id: `stage-err-${Date.now()}`, tone: 'error', message } },
        });
      }
    },
    [
      state.activeNoteId,
      state.isDirty,
      state.draftTitle,
      state.draftContent,
      state.draftTagsInput,
      transitionStage,
      persistCurrentDraft,
    ]
  );

  const changeDraftTitle = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'UPDATE_DRAFT_TITLE', payload: { title: event.target.value } });
  }, []);

  const changeDraftContent = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    dispatch({ type: 'UPDATE_DRAFT_CONTENT', payload: { content: event.target.value } });
  }, []);

  const changeDraftTags = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'UPDATE_DRAFT_TAGS', payload: { tagsInput: event.target.value } });
  }, []);

  const changeStageFilter = useCallback((stageFilter: StageFilterKey) => {
    dispatch({ type: 'SET_STAGE_FILTER', payload: { stageFilter } });
  }, []);

  const changeSearchQuery = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'SET_SEARCH_QUERY', payload: { query: event.target.value } });
  }, []);

  const toggleFocusMode = useCallback(() => {
    dispatch({ type: 'TOGGLE_FOCUS_MODE' });
  }, []);

  const togglePreviewMode = useCallback(() => {
    dispatch({ type: 'TOGGLE_PREVIEW_MODE' });
  }, []);

  const toggleSidebar = useCallback(() => {
    dispatch({ type: 'TOGGLE_SIDEBAR' });
  }, []);

  const exportActiveNote = useCallback(async () => {
    if (!state.activeNoteId) {
      return;
    }

    if (state.isDirty) {
      await persistCurrentDraft(
        state.activeNoteId,
        state.draftTitle,
        state.draftContent,
        state.draftTagsInput
      );
    }

    const markdown = await manageNotes.exportNoteAsMarkdown(state.activeNoteId);
    const active = state.notes.find((item) => item.id === state.activeNoteId);
    const fileName = `${active?.slug || state.activeNoteId}.md`;
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);

    dispatch({
      type: 'SET_FEEDBACK',
      payload: {
        notice: {
          id: `export-${Date.now()}`,
          tone: 'success',
          message: `Exportado "${fileName}" con YAML frontmatter.`,
        },
      },
    });
  }, [
    state.activeNoteId,
    state.isDirty,
    state.draftTitle,
    state.draftContent,
    state.draftTagsInput,
    state.notes,
    manageNotes,
    persistCurrentDraft,
  ]);

  const triggerImportMarkdown = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImportFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) {
        return;
      }

      try {
        const rawText = await file.text();
        const imported = await manageNotes.importNoteFromMarkdown(rawText);
        dispatch({ type: 'CREATE_NOTE_SUCCESS', payload: { note: imported } });
        dispatch({
          type: 'SET_FEEDBACK',
          payload: {
            notice: {
              id: `import-${Date.now()}`,
              tone: 'success',
              message: `Importado "${imported.title}" correctamente.`,
            },
          },
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'El archivo Markdown no pudo importarse.';
        dispatch({
          type: 'SET_FEEDBACK',
          payload: { notice: { id: `import-err-${Date.now()}`, tone: 'error', message } },
        });
      }
    },
    [manageNotes]
  );

  const openSyncModal = useCallback(() => {
    const existing = syncWorkspace.getSyncConfig();
    dispatch({
      type: 'OPEN_SYNC_MODAL',
      payload: {
        isConfigured: syncWorkspace.isSyncConfigured(),
        config: existing
          ? {
              owner: existing.owner,
              repo: existing.repo,
              branch: existing.branch,
              basePath: existing.basePath,
              token: existing.token,
            }
          : {
              owner: '',
              repo: '',
              branch: 'main',
              basePath: 'notas',
              token: '',
            },
      },
    });
  }, [syncWorkspace]);

  const closeSyncModal = useCallback(() => {
    dispatch({ type: 'CLOSE_SYNC_MODAL' });
  }, []);

  const changeSyncConfigField = useCallback(
    (field: keyof SyncConfigDraftVM) => (event: ChangeEvent<HTMLInputElement>) => {
      dispatch({
        type: 'UPDATE_SYNC_CONFIG_FIELD',
        payload: { field, value: event.target.value },
      });
    },
    []
  );

  const submitSyncConfig = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      syncWorkspace.configureSync(state.syncConfigDraft);
      dispatch({
        type: 'SAVE_SYNC_CONFIG_SUCCESS',
        payload: { message: 'Repositorio GitHub vinculado correctamente.' },
      });
    },
    [state.syncConfigDraft, syncWorkspace]
  );

  const clearSyncConfig = useCallback(() => {
    syncWorkspace.clearSyncConfig();
    dispatch({ type: 'CLEAR_SYNC_CONFIG_SUCCESS' });
  }, [syncWorkspace]);

  const triggerSync = useCallback(async () => {
    if (!syncWorkspace.isSyncConfigured()) {
      openSyncModal();
      return;
    }

    if (!state.isOnline) {
      dispatch({
        type: 'SYNC_ERROR',
        payload: { message: 'Sin conexión a internet. Los cambios permanecen seguros en local.' },
      });
      return;
    }

    if (state.activeNoteId && state.isDirty) {
      await persistCurrentDraft(
        state.activeNoteId,
        state.draftTitle,
        state.draftContent,
        state.draftTagsInput
      );
    }

    dispatch({ type: 'SYNC_START' });
    try {
      const summary = await syncWorkspace.syncAll();
      const refreshedNotes = await manageNotes.listNotes();
      const tone = summary.conflictCount > 0 || summary.errors.length > 0 ? 'warning' : 'success';
      const summaryText = `Sincronización: ${summary.pushedCount} subidas, ${summary.pulledCount} descargadas${
        summary.conflictCount > 0 ? `, ${summary.conflictCount} conflictos` : ''
      }.`;

      dispatch({
        type: 'SYNC_SUCCESS',
        payload: {
          notes: refreshedNotes,
          notice: {
            id: `sync-${Date.now()}`,
            tone,
            message: summaryText,
          },
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Fallo al sincronizar con el repositorio remoto.';
      dispatch({ type: 'SYNC_ERROR', payload: { message } });
    }
  }, [
    state.isOnline,
    state.activeNoteId,
    state.isDirty,
    state.draftTitle,
    state.draftContent,
    state.draftTagsInput,
    syncWorkspace,
    manageNotes,
    openSyncModal,
    persistCurrentDraft,
  ]);

  const resolveConflictKeepLocal = useCallback(async () => {
    if (!state.activeNoteId) {
      return;
    }
    dispatch({ type: 'SYNC_START' });
    try {
      await syncWorkspace.resolveConflictKeepLocal(state.activeNoteId);
      const refreshed = await manageNotes.listNotes();
      dispatch({
        type: 'SYNC_SUCCESS',
        payload: {
          notes: refreshed,
          notice: {
            id: `resolve-local-${Date.now()}`,
            tone: 'success',
            message: 'Conflicto resuelto conservando la versión local.',
          },
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'No se pudo resolver el conflicto.';
      dispatch({ type: 'SYNC_ERROR', payload: { message } });
    }
  }, [state.activeNoteId, syncWorkspace, manageNotes]);

  const resolveConflictKeepRemote = useCallback(async () => {
    if (!state.activeNoteId) {
      return;
    }
    dispatch({ type: 'SYNC_START' });
    try {
      const resolved = await syncWorkspace.resolveConflictKeepRemote(state.activeNoteId);
      const refreshed = await manageNotes.listNotes();
      dispatch({ type: 'SELECT_NOTE', payload: { note: resolved } });
      dispatch({
        type: 'SYNC_SUCCESS',
        payload: {
          notes: refreshed,
          notice: {
            id: `resolve-remote-${Date.now()}`,
            tone: 'success',
            message: 'Conflicto resuelto aplicando la versión remota.',
          },
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'No se pudo aplicar la versión remota.';
      dispatch({ type: 'SYNC_ERROR', payload: { message } });
    }
  }, [state.activeNoteId, syncWorkspace, manageNotes]);

  const installPWA = useCallback(async () => {
    const promptEvent = deferredInstallPromptRef.current;
    if (!promptEvent) {
      return;
    }
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') {
      deferredInstallPromptRef.current = null;
      dispatch({
        type: 'SET_PWA_STATE',
        payload: {
          isInstallable: false,
          isInstalled: true,
          isIOSDevice: state.isIOSDevice,
        },
      });
    }
  }, [state.isIOSDevice]);

  const openIOSInstallGuide = useCallback(() => {
    dispatch({ type: 'TOGGLE_IOS_GUIDE', payload: { isOpen: true } });
  }, []);

  const closeIOSInstallGuide = useCallback(() => {
    dispatch({ type: 'TOGGLE_IOS_GUIDE', payload: { isOpen: false } });
  }, []);

  const dismissFeedback = useCallback(() => {
    dispatch({ type: 'DISMISS_FEEDBACK' });
  }, []);

  const noteCards = useMemo<readonly NoteCardVM[]>(() => {
    const query = state.searchQuery.trim().toLowerCase();

    return state.notes
      .filter((note) => {
        if (state.stageFilter !== 'ALL' && note.stage !== state.stageFilter) {
          return false;
        }
        if (!query) {
          return true;
        }
        const haystack = `${note.title} ${note.content} ${note.tags.join(' ')}`.toLowerCase();
        return haystack.includes(query);
      })
      .map((note) => {
        const isSelected = note.id === state.activeNoteId;
        const effectiveTitle = isSelected ? state.draftTitle || 'Manuscrito sin título' : note.title;
        const effectiveContent = isSelected ? state.draftContent : note.content;
        const metrics = manageNotes.computeMetrics(effectiveContent);
        const wordLabel = `${metrics.wordCount} ${metrics.wordCount === 1 ? 'palabra' : 'palabras'}`;

        return {
          id: note.id,
          title: effectiveTitle,
          excerpt: note.excerpt || 'Sin contenido redactado aún.',
          stage: note.stage,
          stageLabel: STAGE_DESCRIPTORS[note.stage].label,
          syncStatus: note.syncStatus,
          syncLabel: SYNC_STATUS_LABELS[note.syncStatus],
          hasConflict: note.syncStatus === SyncStatus.CONFLICT,
          wordCountLabel: wordLabel,
          updatedAtLabel: formatRelativeDate(note.updatedAt),
          tagsLine: note.tags.join(' · '),
          isSelected,
          isConfirmingDelete: state.confirmDeleteId === note.id,
        };
      });
  }, [
    state.notes,
    state.stageFilter,
    state.searchQuery,
    state.activeNoteId,
    state.draftTitle,
    state.draftContent,
    state.confirmDeleteId,
    manageNotes,
  ]);

  const activeNote = useMemo<ActiveNoteVM | null>(() => {
    if (!state.activeNoteId) {
      return null;
    }
    const baseNote = state.notes.find((item) => item.id === state.activeNoteId);
    if (!baseNote) {
      return null;
    }

    const metrics = manageNotes.computeMetrics(state.draftContent);
    const descriptor = STAGE_DESCRIPTORS[baseNote.stage];

    return {
      id: baseNote.id,
      title: state.draftTitle,
      content: state.draftContent,
      tagsInput: state.draftTagsInput,
      stage: baseNote.stage,
      stageLabel: descriptor.label,
      stageDescription: descriptor.description,
      syncStatus: baseNote.syncStatus,
      syncLabel: SYNC_STATUS_LABELS[baseNote.syncStatus],
      hasConflict: baseNote.syncStatus === SyncStatus.CONFLICT,
      updatedAtLabel: formatRelativeDate(baseNote.updatedAt),
      wordCount: metrics.wordCount,
      characterCount: metrics.characterCount,
      paragraphCount: metrics.paragraphCount,
      readingTimeLabel:
        metrics.readingTimeMinutes === 0 ? '0 min lectura' : `${metrics.readingTimeMinutes} min lectura`,
      isDirty: state.isDirty,
      previewBlocks: state.isPreviewMode ? parseMarkdownPreviewBlocks(state.draftContent) : [],
    };
  }, [
    state.activeNoteId,
    state.notes,
    state.draftTitle,
    state.draftContent,
    state.draftTagsInput,
    state.isDirty,
    state.isPreviewMode,
    manageNotes,
  ]);

  const stageFilters = useMemo<readonly StageFilterOptionVM[]>(() => {
    const countByStage = new Map<WritingStage, number>();
    for (const note of state.notes) {
      countByStage.set(note.stage, (countByStage.get(note.stage) ?? 0) + 1);
    }

    const allOption: StageFilterOptionVM = {
      key: 'ALL',
      label: 'Todas',
      count: state.notes.length,
      isActive: state.stageFilter === 'ALL',
    };

    const stageOptions: StageFilterOptionVM[] = WRITING_STAGES_ORDER.map((stage) => ({
      key: stage,
      label: STAGE_DESCRIPTORS[stage].label,
      count: countByStage.get(stage) ?? 0,
      isActive: state.stageFilter === stage,
    }));

    return [allOption, ...stageOptions];
  }, [state.notes, state.stageFilter]);

  const allowedTransitions = useMemo<readonly StageTransitionOptionVM[]>(() => {
    if (!activeNote) {
      return [];
    }
    return transitionStage.getAvailableTransitions(activeNote.stage).map((targetStage) => ({
      targetStage,
      label: STAGE_DESCRIPTORS[targetStage].label,
      description: STAGE_DESCRIPTORS[targetStage].description,
    }));
  }, [activeNote, transitionStage]);

  const workspaceMetrics = useMemo<WorkspaceMetricsVM>(() => {
    let totalWords = 0;
    let pendingSyncCount = 0;
    let conflictCount = 0;

    for (const note of state.notes) {
      const text = note.id === state.activeNoteId ? state.draftContent : note.content;
      totalWords += manageNotes.computeMetrics(text).wordCount;
      if (note.syncStatus === SyncStatus.LOCAL_ONLY || note.syncStatus === SyncStatus.PENDING_SYNC) {
        pendingSyncCount += 1;
      }
      if (note.syncStatus === SyncStatus.CONFLICT) {
        conflictCount += 1;
      }
    }

    return {
      totalNotes: state.notes.length,
      totalWordsLabel: `${totalWords.toLocaleString('es-ES')} palabras`,
      pendingSyncCount,
      conflictCount,
    };
  }, [state.notes, state.activeNoteId, state.draftContent, manageNotes]);

  return {
    vm: {
      ui: state,
      noteCards,
      activeNote,
      stageFilters,
      allowedTransitions,
      workspaceMetrics,
      fileInputRef,
    },
    actions: {
      selectNote,
      createNote,
      saveActiveNote,
      requestDeleteNote,
      cancelDeleteNote,
      confirmDeleteNote,
      transitionNoteStage,
      changeDraftTitle,
      changeDraftContent,
      changeDraftTags,
      changeStageFilter,
      changeSearchQuery,
      toggleFocusMode,
      togglePreviewMode,
      toggleSidebar,
      exportActiveNote,
      triggerImportMarkdown,
      handleImportFileChange,
      triggerSync,
      openSyncModal,
      closeSyncModal,
      changeSyncConfigField,
      submitSyncConfig,
      clearSyncConfig,
      resolveConflictKeepLocal,
      resolveConflictKeepRemote,
      installPWA,
      openIOSInstallGuide,
      closeIOSInstallGuide,
      dismissFeedback,
    },
  };
}
