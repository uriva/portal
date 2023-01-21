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
  return "some encryped string";
};

export const certify = (
  publicKey: PublicKey,
  privateKey: PrivateKey,
  encryptedPayload: string,
  to: PublicKey,
): Certificate => {
  console.error("not yet implemented");
  return "some certificate";
};

export const decrypt = (
  publicKey: PublicKey,
  privateKey: PrivateKey,
  encrypedString: string,
): string => {
  console.error("not yet implemented");
  return "some decryped string";
};

export const validate = (
  publicKey: PublicKey,
  certificate: Certificate,
  payload: string,
): boolean => {
  console.error("not yet implemented");
  return true;
};
