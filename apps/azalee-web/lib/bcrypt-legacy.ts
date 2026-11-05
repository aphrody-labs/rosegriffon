/**
 * Vérification des anciens hashes bcrypt (`$2a$` / `$2b$`) hérités de bcryptjs.
 *
 * `Bun.password.verify` reconnaît bcrypt, mais pré-hache en SHA-512 tout mot de
 * passe de plus de 72 octets, alors que bcryptjs le tronquait à 72 octets UTF-8.
 * On tronque donc nous-mêmes : un hash produit par bcryptjs reste vérifiable à
 * l'identique, quelle que soit la longueur du mot de passe.
 */
const BCRYPT_MAX_BYTES = 72;

export function isLegacyBcryptHash(hash: string): boolean {
  return hash.startsWith("$2a$") || hash.startsWith("$2b$");
}

export function verifyLegacyBcrypt(password: string, hash: string): Promise<boolean> {
  const bytes = new TextEncoder().encode(password).subarray(0, BCRYPT_MAX_BYTES);
  return Bun.password.verify(bytes, hash, "bcrypt");
}
