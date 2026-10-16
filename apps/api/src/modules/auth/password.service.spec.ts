import { BCRYPT_COST, PasswordService } from './password.service.js';

describe('PasswordService', () => {
  const service = new PasswordService();

  it(`produit un hash bcrypt de coût ${BCRYPT_COST} que le mot de passe vérifie`, async () => {
    const hash = await service.hash('MotDePasse2026');

    expect(hash).toMatch(new RegExp(`^\\$2b\\$${BCRYPT_COST}\\$`));
    await expect(service.verify('MotDePasse2026', hash)).resolves.toBe(true);
    await expect(service.verify('mauvais-mot-de-passe1', hash)).resolves.toBe(false);
  });

  it('renvoie false sans hash (email inconnu)', async () => {
    await expect(service.verify('MotDePasse2026', null)).resolves.toBe(false);
  });
});
