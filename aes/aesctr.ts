import AES from "./aes";
import { base64Decode, base64Encode, utf8Decode, utf8Encode } from "../utils";

/**
 * * AesCtr: Counter-mode (CTR) wrapper for AES.
 *
 * This encrypts a Unicode string to produces a base64 ciphertext using 128/192/256-bit AES,
 * and the converse to decrypt an encrypted ciphertext.
 *
 * See csrc.nist.gov/publications/nistpubs/800-38a/sp800-38a.pdf
 */
export default class AESCtr extends AES {
  /**
   *
   * Encrypt a text using AES encryption in Counter mode of operation.
   *
   * Unicode multi-byte character safe
   */
  static encrypt(
    plain_text: string, //Source text to be encrypted.
    password: string, //The password to use to generate a key for encryption.
    number_bits: number // Number of bits to be used in the key; 128 / 192 / 256.
  ) {
    const blockSize = 16; // block size fixed at 16 bytes / 128 bits (Nb=4) for AES
    if (!(number_bits == 128 || number_bits == 192 || number_bits == 256))
      throw new Error("Key size is not 128 / 192 / 256");

    plain_text = utf8Encode(plain_text);
    password = utf8Encode(password);

    // use AES itself to encrypt password to get cipher key (using plain password as source for key
    // expansion) to give us well encrypted key (in real use hashed password could be used for key)
    const number_bytes = number_bits / 8; // no bytes in key (16/24/32)
    const password_bytes = new Array(number_bytes);

    for (let i = 0; i < number_bytes; i++) {
      // use 1st 16/24/32 chars of password for key
      password_bytes[i] = i < password.length ? password.charCodeAt(i) : 0;
    }
    let key = this.cipher(password_bytes, this.key_expansion(password_bytes)); // gives us 16-byte key
    key = key.concat(key.slice(0, number_bytes - 16)); // expand key to 16/24/32 bytes long

    // initialise 1st 8 bytes of counter block with nonce (NIST SP800-38A §B.2): [0-1] = millisec,
    // [2-3] = random, [4-7] = seconds, together giving full sub-millisec uniqueness up to Feb 2106
    const counterBlock = new Array(blockSize);

    const nonce = new Date().getTime(); // timestamp: milliseconds since 1-Jan-1970
    const nonceMs = nonce % 1000;
    const nonceSec = Math.floor(nonce / 1000);
    const nonceRnd = Math.floor(Math.random() * 0xffff);
    // for debugging: nonce = nonceMs = nonceSec = nonceRnd = 0;

    for (let i = 0; i < 2; i++) counterBlock[i] = (nonceMs >>> (i * 8)) & 0xff;
    for (let i = 0; i < 2; i++)
      counterBlock[i + 2] = (nonceRnd >>> (i * 8)) & 0xff;
    for (let i = 0; i < 4; i++)
      counterBlock[i + 4] = (nonceSec >>> (i * 8)) & 0xff;

    // and convert it to a string to go on the front of the ciphertext
    let ctrTxt = "";
    for (let i = 0; i < 8; i++) ctrTxt += String.fromCharCode(counterBlock[i]);

    // generate key schedule - an expansion of the key into distinct Key Rounds for each round
    const keySchedule = this.key_expansion(key);
    const blockCount = Math.ceil(plain_text.length / blockSize);
    let ciphertext = "";

    for (let b = 0; b < blockCount; b++) {
      // set counter (block #) in last 8 bytes of counter block (leaving nonce in 1st 8 bytes)
      // done in two stages for 32-bit ops: using two words allows us to go past 2^32 blocks (68GB)
      for (let c = 0; c < 4; c++) counterBlock[15 - c] = (b >>> (c * 8)) & 0xff;
      for (let c = 0; c < 4; c++)
        counterBlock[15 - c - 4] = (b / 0x100000000) >>> (c * 8);

      const cipherCntr = this.cipher(counterBlock, keySchedule); // -- encrypt counter block --

      // block size is reduced on final block
      const blockLength =
        b < blockCount - 1
          ? blockSize
          : ((plain_text.length - 1) % blockSize) + 1;
      const cipherChar = new Array(blockLength);

      for (let i = 0; i < blockLength; i++) {
        // -- xor plaintext with ciphered counter char-by-char --
        cipherChar[i] =
          cipherCntr[i] ^ plain_text.charCodeAt(b * blockSize + i);
        cipherChar[i] = String.fromCharCode(cipherChar[i]);
      }
      ciphertext += cipherChar.join("");

      // if within web worker, announce progress every 1000 blocks (roughly every 50ms)
      if (typeof Worker != "undefined" && self instanceof Worker) {
        if (b % 1000 == 0)
          self.postMessage({
            progress: b / blockCount,
          });
      }

      ciphertext = base64Encode(ctrTxt + ciphertext);

      return ciphertext;
    }
  }

  /**
   * * Decrypt a text encrypted by AES in counter mode of operation
   */
  static decrypt(
    cipher_text: string | any[], // Cipher text to be decrypted.
    password: string, // Password to use to generate a key for decryption.
    number_bits: number // Number of bits to be used in the key; 128 / 192 / 256.
  ) {
    const blockSize = 16; // block size fixed at 16 bytes / 128 bits (Nb=4) for AES
    if (!(number_bits == 128 || number_bits == 192 || number_bits == 256))
      throw new Error("Key size is not 128 / 192 / 256");
    cipher_text = base64Decode(String(cipher_text));
    password = utf8Encode(String(password));

    // use AES to encrypt password (mirroring encrypt routine)
    const number_bytes = number_bits / 8;
    const password_bytes = new Array(number_bytes);
    for (let i = 0; i < number_bytes; i++)
      password_bytes[i] = i < password.length ? password.charCodeAt(i) : 0; // use 1st nBytes chars of password for key

    let key = this.cipher(password_bytes, this.key_expansion(password_bytes));
    key = key.concat(key.slice(0, number_bytes - 16)); // expand key to 16/24/32 bytes long

    // recover nonce from 1st 8 bytes of ciphertext
    const counterBlock = new Array(8);
    const ctrTxt = cipher_text.slice(0, 8);
    for (let i = 0; i < 8; i++)
      counterBlock[i] = (ctrTxt as string).charCodeAt(i);

    // generate key schedule
    const keySchedule = this.key_expansion(key);

    // separate ciphertext into blocks (skipping past initial 8 bytes)
    const nBlocks = Math.ceil((cipher_text.length - 8) / blockSize);
    const ct = new Array(nBlocks);
    for (let b = 0; b < nBlocks; b++)
      ct[b] = cipher_text.slice(
        8 + b * blockSize,
        8 + b * blockSize + blockSize
      );
    cipher_text = ct; // ciphertext is now array of block-length strings

    // plaintext will get generated block-by-block into array of block-length strings
    let plain_text = "";

    for (let b = 0; b < nBlocks; b++) {
      // set counter (block #) in last 8 bytes of counter block (leaving nonce in 1st 8 bytes)
      for (let c = 0; c < 4; c++) counterBlock[15 - c] = (b >>> (c * 8)) & 0xff;
      for (let c = 0; c < 4; c++)
        counterBlock[15 - c - 4] =
          (((b + 1) / 0x100000000 - 1) >>> (c * 8)) & 0xff;

      const cipherCntr = this.cipher(counterBlock, keySchedule); // encrypt counter block

      const plaintxtByte = new Array(cipher_text[b].length);
      for (let i = 0; i < cipher_text[b].length; i++) {
        // -- xor plaintext with ciphered counter byte-by-byte --
        plaintxtByte[i] = cipherCntr[i] ^ cipher_text[b].charCodeAt(i);
        plaintxtByte[i] = String.fromCharCode(plaintxtByte[i]);
      }
      plain_text += plaintxtByte.join("");

      // if within web worker, announce progress every 1000 blocks (roughly every 50ms)
      if (typeof Worker != "undefined" && self instanceof Worker) {
        if (b % 1000 == 0)
          self.postMessage({
            progress: b / nBlocks,
          });
      }
    }

    plain_text = utf8Decode(plain_text); // decode from UTF8 back to Unicode multi-byte chars

    return plain_text;
  }
}
