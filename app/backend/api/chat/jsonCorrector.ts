export function correctJson(text: string): Record<string, unknown> | null {
  if (typeof text !== "string") return null;
  text = text.trim();

  // Remove markdown code blocks if present
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\n?/, "");
    text = text.replace(/\n?```$/, "");
    text = text.trim();
  }

  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch (e) {
    // Ignore and try to fix
  }

  // Fix trailing commas
  text = text.replace(/,\s*([\]}])/g, "$1");

  // Balance brackets and braces using a stack
  const stack: string[] = [];
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === "\\") {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === "{") stack.push("}");
      else if (char === "[") stack.push("]");
      else if (char === "}") {
        if (stack[stack.length - 1] === "}") stack.pop();
      } else if (char === "]") {
        if (stack[stack.length - 1] === "]") stack.pop();
      }
    }
  }

  if (inString) text += '"';

  let fixedText = text;
  while (stack.length > 0) {
    fixedText += stack.pop();
  }

  try {
    const parsed = JSON.parse(fixedText);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch (e) {
    // Fallback extraction
    const start = text.indexOf("{");
    if (start !== -1) {
      let depth = 0;
      let inStr = false;
      let esc = false;
      for (let i = start; i < text.length; i++) {
        const ch = text[i];
        if (esc) {
          esc = false;
          continue;
        }
        if (ch === "\\" && inStr) {
          esc = true;
          continue;
        }
        if (ch === '"') {
          inStr = !inStr;
          continue;
        }
        if (inStr) continue;
        
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) {
            const candidate = text.substring(start, i + 1);
            try {
              const parsed = JSON.parse(candidate);
              if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
                return parsed as Record<string, unknown>;
              }
            } catch (err) {
              return null;
            }
          }
        }
      }
    }
  }
  return null;
}
