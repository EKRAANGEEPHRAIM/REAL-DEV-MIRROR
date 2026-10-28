import type { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { DueTask, RecentNote } from '@devmirror/api-client';
import { DueSoonList } from './due-soon-list';
import { RecentNotesList } from './recent-notes-list';

async function render<T>(component: Type<T>, name: string, value: unknown) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(component);
  fixture.componentRef.setInput(name, value);
  await fixture.whenStable();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

const tomorrow = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(23, 59, 0, 0);
  return date.toISOString();
};

describe('liste « à faire sous 7 jours »', () => {
  const task: DueTask = {
    id: 't1',
    title: 'Préparer la démo',
    dueDate: tomorrow(),
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    project: { id: 'p1', name: 'DevMirror', color: '#6366f1' },
  };

  it('affiche échéance relative, priorité et projet ; lien vers la tâche', async () => {
    const { element } = await render(DueSoonList, 'tasks', [task]);

    expect(element.textContent).toContain('Préparer la démo');
    expect(element.textContent).toContain('Demain');
    expect(element.textContent).toContain('Haute');
    expect(element.textContent).toContain('DevMirror');
    expect(element.querySelector('a')?.getAttribute('href')).toBe(
      '/tasks?q=Pr%C3%A9parer%20la%20d%C3%A9mo',
    );
  });

  it('cocher émet la tâche à terminer', async () => {
    const { fixture, element } = await render(DueSoonList, 'tasks', [task]);
    const completed = vi.fn();
    fixture.componentInstance.completed.subscribe(completed);

    element
      .querySelector<HTMLInputElement>('input[aria-label="Terminer « Préparer la démo »"]')!
      .dispatchEvent(new Event('change'));

    expect(completed).toHaveBeenCalledWith(task);
  });

  it('rassure quand rien n’est dû', async () => {
    const { element } = await render(DueSoonList, 'tasks', []);
    expect(element.textContent).toContain('aucune échéance cette semaine');
  });
});

describe('liste « dernières notes »', () => {
  const note: RecentNote = {
    id: 'n1',
    title: 'Pièges JWT',
    excerpt: 'Un jeton ne sert qu’une fois.',
    pinned: true,
    updatedAt: new Date().toISOString(),
  };

  it('lie chaque note à son éditeur, avec extrait et épinglage', async () => {
    const { element } = await render(RecentNotesList, 'notes', [note]);

    expect(element.querySelector('a')?.getAttribute('href')).toBe('/notes/n1');
    expect(element.textContent).toContain('Un jeton ne sert qu’une fois.');
    expect(element.querySelector('[aria-label="Épinglée"]')).not.toBeNull();
  });

  it('propose d’écrire une note quand il n’y en a pas', async () => {
    const { element } = await render(RecentNotesList, 'notes', []);
    expect(element.textContent).toContain('Aucune note pour l’instant.');
    expect(element.querySelector('a')?.getAttribute('href')).toBe('/notes');
  });
});
