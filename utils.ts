/**
 * * Encodes multi-byte string to utf8.
 *
 * Note utf8Encode is an identity function with 7-bit ascii strings, but not with 8-bit strings;
 * utf8Encode('x') = 'x', but utf8Encode('ça') = 'Ã§a', and utf8Encode('Ã§a') = 'ÃÂ§a'.
 */
export const utf8Encode = (msg: string): string => {
  try {
    return new TextEncoder()
      .encode(msg)
      .reduce(
        (previous, current) => previous + String.fromCharCode(current),
        ""
      );
  } catch (error) {
    // no TextEncoder available?
    return decodeURIComponent(encodeURIComponent(msg)); // monsur.hossa.in/2012/07/20/utf-8-in-javascript.html
  }
};

/**
 * * Decodes utf8 string to multi-byte.
 */
export const utf8Decode = (str: string) => {
  try {
    return new TextDecoder().decode(new TextEncoder().encode(str));
    // .reduce((prev, curr) => prev + String.fromCharCode(curr), "");
  } catch (e) {
    // no TextEncoder available?
    return decodeURIComponent(escape(str)); // monsur.hossa.in/2012/07/20/utf-8-in-javascript.html
  }
};

/**
  * * Encodes string as base-64.
  
   - developer.mozilla.org/en-US/docs/Web/API/window.btoa, nodejs.org/api/buffer.html
   - note: btoa & Buffer/binary work on single-byte Unicode (C0/C1), so ok for utf8 strings, not for general Unicode...
   - note: if btoa()/atob() are not available (eg IE9-), try github.com/davidchambers/Base64.js
  */
export const base64Encode = (str: string) => {
  if (typeof btoa != "undefined") return btoa(str); // browser
  if (typeof Buffer != "undefined")
    return new (Buffer.from(str, "binary") as any).toString("base64"); // Node.js
  throw new Error("No Base64 Encode");
};

/**
 * * Decodes base-64 encoded string.
 */
export const base64Decode = (str: string) => {
  if (typeof atob != "undefined") return atob(str); // browser
  if (typeof Buffer != "undefined")
    return new (Buffer.from(str, "base64") as any).toString("binary"); // Node.js
  throw new Error("No Base64 Decode");
};

export const hexBytesToString = (hexmsg: string): string => {
  // convert string of hex numbers to a string of chars (eg '616263' -> 'abc').
  const str = hexmsg.replace(" ", ""); // allow space-separated groups
  return str === ""
    ? ""
    : (str.match(/.{2}/g) as RegExpMatchArray)
        .map((byte) => String.fromCharCode(parseInt(byte, 16)))
        .join("");
};
