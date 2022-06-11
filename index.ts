import SHA256 from "./sha256";
import { createInterface } from "readline";

const rl = createInterface({ input: process.stdin, output: process.stdout });

rl.question("> give us a string to hash: ", (str) => {
  console.log(SHA256.hash(str));
  rl.close();
});
