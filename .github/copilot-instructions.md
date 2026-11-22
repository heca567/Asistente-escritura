# Agent instructions for Asistente-escritura

## Project summary

- This is **Folio**, a Spanish-language, offline-first React 19 + TypeScript writing studio.
- Vite builds the PWA. The UI uses Tailwind CSS utility classes, Lucide icons, and PWA support.
- Main flows are note editing, folder/project organization, writing-stage transitions, Markdown import/export, Firebase/Firestore synchronization, and a lazy-loaded `/afirmaciones` claims explorer.
- Use Spanish for user-facing copy and domain validation messages unless the task explicitly requests otherwise.

## Architecture and boundaries

Keep changes within the existing architecture:

- `src/domain/`: models, ports, and use cases. Domain code must not import Firebase, IndexedDB, React, or UI modules.
- `src/app/container.ts`: dependency composition and repository/codec/gateway construction.
- `src/infrastructure/`: IndexedDB, Firestore, Markdown codecs, GitHub sync, and other adapters.
- `src/ui/`: React components, state, and the view-model/handler layer.
- `src/modules/afirmaciones/`: standalone claims explorer. Keep its JSON validation, filtering, relation resolution, types, and UI logic separated.
- `src/App.tsx`: application routing and composition only. It uses browser history for `/afirmaciones`; preserve back/forward behavior.
- `src/main.tsx`: application bootstrap.

When adding behavior, prefer the existing flow:

1. Add or adjust a domain model/port/use case.
2. Implement the adapter in `src/infrastructure/`.
3. Wire it through `src/app/container.ts`.
4. Expose it through `src/ui/handlers/useNoteStudioHandler.ts` or the relevant UI component.
5. Add focused tests.

Do not bypass use cases from components when an existing use case owns the operation.

## Conventions

- Use TypeScript and React function components.
- Preserve readonly types and explicit interfaces for props, view models, and public use-case dependencies.
- Keep imports stable and extension-free.
- Follow the existing naming style:
  - English for domain/application infrastructure names.
  - Spanish for user-facing strings and the claims explorer's domain types/functions.
- Prefer small, pure helpers and existing state reducers over introducing new state libraries.
- Preserve the paper/ink visual language and the existing Tailwind palette (for example `#F6F5F0`, `#18181B`, and `#1E3A5F`).
- Keep responsive behavior, focus mode, sidebar behavior, offline feedback, and PWA behavior intact.
- Do not introduce secrets or environment-dependent credentials into source files.
- Do not change PWA asset paths or Vite PWA configuration without an explicit requirement.

## Data and persistence

- Treat `Note` and `WritingStage` as the domain representations. Synchronization-specific fields such as `syncStatus` and `remoteSha` must not leak into Firestore payload field expectations unless explicitly handled.
- IndexedDB is the offline fallback. Keep repository implementations compatible with the `NoteRepository` port.
- Firestore payloads must remain allowlisted and limited to the fields in `firestore.rules`.
- Use server timestamps for `createdAt` and `updatedAt`; never rely on client timestamps for Firestore writes.
- Keep IDs constrained to 1–128 characters and `[a-zA-Z0-9_-]`.
- Respect these limits:
  - title: 200 characters
  - slug: 200 characters
  - excerpt: 300 characters
  - content: 500,000 characters
  - tags: 20 items, individual tags 40 characters
  - folder name: 80 characters
  - folder color/icon: 32 characters
- The writing stages are `SEED`, `DRAFT`, `REVISION`, `POLISHED`, and `PUBLISHED`. Enforce the transition matrix in `STAGE_TRANSITION_MATRIX`; do not permit arbitrary transitions.
- Markdown frontmatter is serialized/deserialized by `FrontmatterMarkdownCodec`. Preserve round-trip metadata and invalid-stage/sync-status fallback behavior.

## Security requirements

The [security specification](/workspaces/Asistente-escritura/security_spec.md) is binding. For any change involving authentication, Firestore, folders, notes, or synchronization:

- Only verified, authenticated users may read or write owned folders and notes.
- Every folder and note must belong to `request.auth.uid`.
- Preserve immutable `id`, `userId`, and `createdAt`.
- Require exact Firestore field allowlisting for creates and restrict update-modified fields.
- Preserve referential integrity: a note's non-null `folderId` must reference an existing folder owned by the same user.
- Do not weaken the strict rules in `firestore.rules`.
- Validate or sanitize untrusted input at the infrastructure boundary, and keep domain validation and repository behavior aligned.
- Consider the "Dirty Dozen" cases in `firestore.rules.test.ts`; add or update emulator verification coverage when changing rules or payloads.

## Claims explorer

For `src/modules/afirmaciones/`:

- Preserve the JSON contract: root object with an `afirmaciones` array.
- Validate all records before rendering and surface actionable Spanish errors.
- Keep IDs unique within a document.
- Preserve independent and combined search/type/origin/status/evolution filtering behavior.
- Preserve accent-insensitive and ID-based search behavior.
- Keep missing relations distinguishable from valid relation targets.
- Add cases to `src/modules/afirmaciones/__tests__/` for validation, query/filtering, or relation changes.

## Testing and validation

Available commands:

- `npm test` — run the Node/TSX tests for the claims explorer.
- `npm run lint` — run `tsc --noEmit`.
- `npm run build` — create the production Vite/PWA build.

Before completing a code change:

1. Run the smallest relevant test or lint command.
2. Run `npm run lint` and `npm test` when the change crosses domain, UI state, validation, or claims-explorer behavior.
3. Run `npm run build` for routing, PWA, bundling, or application-composition changes.
4. When editing `firestore.rules`, verify the complete security specification and test suite are kept consistent.

Do not delete or overwrite unrelated local changes. The repository may contain pre-existing worktree edits; inspect only the files needed for the task.
