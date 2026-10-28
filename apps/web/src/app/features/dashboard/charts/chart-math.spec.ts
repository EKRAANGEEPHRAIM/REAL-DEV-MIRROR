import { buildHeatmap, heatLevel, monthlyTotals, niceTicks, parseDay } from './chart-math';

describe('calculs des graphiques', () => {
  it('graduations rondes, avec une grille même sans donnée', () => {
    expect(niceTicks(7)).toEqual([0, 2, 4, 6, 8]);
    expect(niceTicks(23)).toEqual([0, 10, 20, 30]);
    expect(niceTicks(4)).toEqual([0, 1, 2, 3, 4]);
    expect(niceTicks(0)).toEqual([0, 1, 2, 3, 4]);
    expect(niceTicks(120)).toEqual([0, 50, 100, 150]);
  });

  it('niveaux de la heatmap proportionnels au maximum', () => {
    expect(heatLevel(0, 8)).toBe(0);
    expect(heatLevel(1, 8)).toBe(1);
    expect(heatLevel(4, 8)).toBe(2);
    expect(heatLevel(5, 8)).toBe(3);
    expect(heatLevel(8, 8)).toBe(4);
    expect(heatLevel(1, 1)).toBe(4);
  });

  it('lit un jour AAAA-MM-JJ en date locale', () => {
    const day = parseDay('2026-10-28');
    expect([day.getFullYear(), day.getMonth(), day.getDate(), day.getHours()]).toEqual([
      2026, 9, 28, 0,
    ]);
  });

  it('construit 53 colonnes du lundi au dimanche, la dernière s’arrête à aujourd’hui', () => {
    const model = buildHeatmap({
      from: '2025-10-27',
      to: '2026-10-28', // un mercredi
      total: 5,
      days: [
        { date: '2025-10-27', count: 1 },
        { date: '2026-10-28', count: 4 },
      ],
    });

    expect(model.weeks).toHaveLength(53);
    expect(model.weeks[0][0]).toMatchObject({ date: '2025-10-27', count: 1, level: 1 });
    expect(model.weeks[0]).toHaveLength(7);
    expect(model.weeks.at(-1)!.map((cell) => cell.date)).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
    ]);
    expect(model.cells.at(-1)).toMatchObject({ level: 4, index: model.cells.length - 1 });
    expect(model.max).toBe(4);
    // Étiquettes de mois espacées d'au moins 3 colonnes
    const columns = model.months.map((month) => month.column);
    expect(columns.every((column, i) => i === 0 || column - columns[i - 1] >= 3)).toBe(true);
    expect(model.months[0].label).toBe('nov.');
  });

  it('totalise l’activité par mois, mois vides compris', () => {
    const totals = monthlyTotals({
      from: '2026-08-31',
      to: '2026-10-28',
      total: 6,
      days: [
        { date: '2026-09-02', count: 2 },
        { date: '2026-09-20', count: 3 },
        { date: '2026-10-01', count: 1 },
      ],
    });
    expect(totals).toEqual([
      { month: 'août 2026', count: 0 },
      { month: 'septembre 2026', count: 5 },
      { month: 'octobre 2026', count: 1 },
    ]);
  });
});
