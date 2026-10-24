import type { Note, NoteSummary, Paginated } from '@devmirror/api-client';

export function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'n1',
    title: 'Pièges du refresh JWT',
    excerpt: 'Un refresh token ne sert qu’une fois.',
    content: 'Un refresh token ne sert **qu’une fois**.',
    pinned: false,
    project: null,
    tags: [],
    createdAt: '2026-10-24T09:00:00.000Z',
    updatedAt: '2026-10-24T09:00:00.000Z',
    ...overrides,
  };
}

export function makeNoteSummary(overrides: Partial<NoteSummary> = {}): NoteSummary {
  const note = makeNote();
  return {
    id: note.id,
    title: note.title,
    excerpt: note.excerpt,
    pinned: note.pinned,
    project: note.project,
    tags: note.tags,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    ...overrides,
  };
}

export function notePage(
  notes: NoteSummary[],
  total = notes.length,
  current = 1,
): Paginated<NoteSummary> {
  const limit = 24;
  return {
    data: notes,
    meta: { total, page: current, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}
