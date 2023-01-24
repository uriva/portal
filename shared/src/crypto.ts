export type PrivateKey = string;
export type PublicKey = string;
export type Certificate = string;
export interface KeyPair {
  publicKey: PublicKey;
  privateKey: PrivateKey;
}
export const genKeyPair: () => KeyPair = () => {
  console.error("not implemented");
  const publicKey: PublicKey = "some public key";
  const privateKey: PrivateKey = "some private key";
  return { publicKey, privateKey };
};

const suffix = "supposedly encryped";

export const encrypt = (
  publicKey: PublicKey,
  privateKey: PrivateKey,
  message: string,
): string => {
  console.error("not implemented");
  return message + suffix;
};

export const certify = (
  publicKey: PublicKey,
  privateKey: PrivateKey,
  encryptedPayload: string,
): Certificate => {
  console.error("not implemented");
  return "some certificate";
};

export const decrypt = (
  publicKey: PublicKey,
  privateKey: PrivateKey,
  encryptedString: string,
): string => {
  console.error("not implemented");
  return encryptedString.slice(0, encrypt.length - suffix.length);
};

export const validate = (
  publicKey: PublicKey,
  certificate: Certificate,
  payload: string,
): boolean => {
  console.error("not implemented");
  return true;
};

export const randomString = () => {
  console.error("not implemented");
  return "0123456789";
};
