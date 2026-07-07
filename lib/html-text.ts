const namedEntities: Record<string, string> = {
  amp: "&",
  apos: "'",
  hellip: "\u2026",
  laquo: "\u00ab",
  lsquo: "\u2018",
  lt: "<",
  mdash: "\u2014",
  nbsp: " ",
  ndash: "\u2013",
  quot: "\"",
  raquo: "\u00bb",
  rsquo: "\u2019",
};

export function decodeHtmlEntities(value: string) {
  let decoded = value;

  for (let pass = 0; pass < 3; pass += 1) {
    const next = decoded.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
      const normalised = entity.toLowerCase();

      if (normalised.startsWith("#x")) {
        return decodeCodePoint(Number.parseInt(normalised.slice(2), 16), match);
      }

      if (normalised.startsWith("#")) {
        return decodeCodePoint(Number.parseInt(normalised.slice(1), 10), match);
      }

      return namedEntities[normalised] ?? match;
    });

    if (next === decoded) {
      return decoded;
    }

    decoded = next;
  }

  return decoded;
}

export function cleanDisplayText(value: string) {
  return decodeHtmlEntities(value)
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeCodePoint(codePoint: number, fallback: string) {
  if (!Number.isFinite(codePoint)) {
    return fallback;
  }

  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return fallback;
  }
}
