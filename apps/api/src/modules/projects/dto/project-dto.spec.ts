import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateProjectDto } from './create-project.dto.js';
import { UpdateProjectDto } from './update-project.dto.js';

function validate<T extends object>(cls: new () => T, input: Record<string, unknown>) {
  const dto = plainToInstance(cls, input);
  return { dto, errors: validateSync(dto).map((error) => error.property) };
}

describe('CreateProjectDto', () => {
  it('nettoie le nom et la liste des technologies (espaces, vides, doublons)', () => {
    const { dto, errors } = validate(CreateProjectDto, {
      name: '  DevMirror ',
      techStack: [' Angular', 'angular', '', 'NestJS '],
    });

    expect(errors).toEqual([]);
    expect(dto.name).toBe('DevMirror');
    expect(dto.techStack).toEqual(['Angular', 'NestJS']);
  });

  it('transforme les chaînes vides en null pour les champs facultatifs', () => {
    const { dto, errors } = validate(CreateProjectDto, { name: 'X', repoUrl: '  ', color: '' });

    expect(errors).toEqual([]);
    expect(dto.repoUrl).toBeNull();
    expect(dto.color).toBeNull();
  });

  it.each([
    [{ name: '' }, 'name'],
    [{ name: 'X', status: 'TERMINE' }, 'status'],
    [{ name: 'X', repoUrl: 'javascript:alert(1)' }, 'repoUrl'],
    [{ name: 'X', color: 'rouge' }, 'color'],
    [{ name: 'X', techStack: Array.from({ length: 21 }, (_, i) => `t${i}`) }, 'techStack'],
  ])('refuse %j', (input, property) => {
    expect(validate(CreateProjectDto, input).errors).toEqual([property]);
  });
});

describe('UpdateProjectDto', () => {
  it('accepte une mise à jour partielle et l’effacement d’un champ', () => {
    const { dto, errors } = validate(UpdateProjectDto, { description: null, status: 'DONE' });

    expect(errors).toEqual([]);
    expect(dto.description).toBeNull();
  });

  it('refuse un nom vide même en mise à jour', () => {
    expect(validate(UpdateProjectDto, { name: '   ' }).errors).toEqual(['name']);
  });
});
