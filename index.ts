import { createInterface } from "readline";
import { encyption } from "./aes";
import SHA256 from "./sha256";

const hashing = () => {
  const rl_hashing = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl_hashing.question("> give us a string to hash: ", (str) => {
    console.log(str + " hashed to -> " + SHA256.hash(str));
    rl_hashing.close();
  });
};

const encrypting = () => {
  const rl_hashing = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl_hashing.question(
    "> give us a string to encrypt (with this password 123456): ",
    (str) => {
      const encrypted = encyption("encrypt", str, "123456", 128);
      console.log("Encrypted " + str + " to -> " + encrypted);
      if (encrypted)
        console.log(
          "Decrypted back to -> " +
            encyption("decrypt", encrypted, "123456", 128)
        );

      rl_hashing.close();
    }
  );
};

// hashing();
encrypting();
