import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes a password so it is not stored in plain text', async () => {
    const hash = await service.hash('Password123');

    expect(hash).not.toBe('Password123');
    expect(hash).toMatch(/^\$2[aby]\$/);
  });

  it('verifies a correct password and rejects a wrong one', async () => {
    const hash = await service.hash('Password123');

    await expect(service.verify('Password123', hash)).resolves.toBe(true);
    await expect(service.verify('WrongPassword1', hash)).resolves.toBe(false);
  });

  it('produces a different hash each time (salted)', async () => {
    const [first, second] = await Promise.all([
      service.hash('Password123'),
      service.hash('Password123'),
    ]);

    expect(first).not.toBe(second);
  });
});
