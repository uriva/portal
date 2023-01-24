export type PrivateKey = string;
export type PublicKey = string;
export type Certificate = string;
export interface KeyPair {
  publicKey: PublicKey;
  privateKey: PrivateKey;
}
export const genKeyPair: () => KeyPair = () => {
  console.error("not yet implemented");
  const publicKey: PublicKey = "hello i am a public key";
  const privateKey: PrivateKey = "hello i'm a private key";
  return { publicKey, privateKey };
};

export const encrypt = (
  publicKey: PublicKey,
  privateKey: PrivateKey,
  message: string,
): string => {
  console.error("not yet implemented");
  return "some encrypted string";
};

export const certify = (
  publicKey: PublicKey,
  privateKey: PrivateKey,
  encryptedPayload: string,
): Certificate => {
  console.error("not yet implemented");
  return "some certificate";
};

export const decrypt = (
  publicKey: PublicKey,
  privateKey: PrivateKey,
  encryptedString: string,
): string => {
  console.error("not yet implemented");
  return '"some decrypted json"';
};

export const validate = (
  publicKey: PublicKey,
  certificate: Certificate,
  payload: string,
): boolean => {
  console.error("not yet implemented");
  return true;
};

export const randomString = () => {
  console.error("not yet implemented");
  return "0123456789";
};
