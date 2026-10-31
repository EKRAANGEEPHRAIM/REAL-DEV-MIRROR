import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { HlmInput } from './hlm-input';

@Component({
  imports: [ReactiveFormsModule, HlmInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<input hlmInput [formControl]="control" />`,
})
class RequiredField {
  readonly control = new FormControl('', { nonNullable: true, validators: Validators.required });
}

describe('HlmInput', () => {
  async function setup() {
    const fixture = TestBed.createComponent(RequiredField);
    await fixture.whenStable();
    const input = (fixture.nativeElement as HTMLElement).querySelector('input')!;
    return { fixture, input, control: fixture.componentInstance.control };
  }

  it('n’annonce pas d’erreur sur un champ requis encore vierge', async () => {
    const { input } = await setup();
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });

  it('annonce l’erreur une fois le champ touché, et la retire une fois corrigé', async () => {
    const { fixture, input, control } = await setup();

    input.dispatchEvent(new Event('blur'));
    control.markAsTouched();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(input.getAttribute('aria-invalid')).toBe('true');

    control.setValue('DevMirror');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });
});
