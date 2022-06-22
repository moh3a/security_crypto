import { createInterface } from "readline";
import SHA256 from "./sha256";

const hashing = () => {
  const rl_hashing = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl_hashing.question("> give us a string to hash: ", (str) => {
    console.log(SHA256.hash(str));
    rl_hashing.close();
  });
};

hashing();
