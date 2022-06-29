import AESCtr from "./aesctr";

export const encyption = (
  op: "encrypt" | "decrypt",
  text: string,
  password: string,
  bits: 128 | 192 | 256
) => {
  if (op === "encrypt") {
    return AESCtr.encrypt(text, password, bits);
  } else if (op === "decrypt") {
    return AESCtr.decrypt(text, password, bits);
  }
};
