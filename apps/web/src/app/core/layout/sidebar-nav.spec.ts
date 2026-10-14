import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NavItem } from './navigation';
import { SidebarNav } from './sidebar-nav';

describe('SidebarNav', () => {
  const items: readonly NavItem[] = [
    { label: 'Projets', path: '/projects', icon: 'lucideFolderKanban' },
    { label: 'Notes', path: '/notes', icon: 'lucideNotebookPen' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SidebarNav],
      providers: [provideRouter([{ path: '**', children: [] }])],
    }).compileComponents();
  });

  it('affiche un lien par élément', async () => {
    const fixture = TestBed.createComponent(SidebarNav);
    fixture.componentRef.setInput('items', items);
    await fixture.whenStable();

    const links = (fixture.nativeElement as HTMLElement).querySelectorAll('a');
    expect(links).toHaveLength(2);
    expect(links[0].getAttribute('href')).toBe('/projects');
  });

  it('émet navigated au clic, pour fermer le menu mobile', async () => {
    const fixture = TestBed.createComponent(SidebarNav);
    fixture.componentRef.setInput('items', items);
    await fixture.whenStable();
    const navigated = vi.fn();
    fixture.componentInstance.navigated.subscribe(navigated);

    (fixture.nativeElement as HTMLElement).querySelector('a')?.click();
    await fixture.whenStable();

    expect(navigated).toHaveBeenCalledOnce();
  });
});
