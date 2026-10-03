export type ScriptLayoutBlock = { type: 'text'; text: string } | { type: 'table'; header: string[]; rows: string[][] };

// A conservative display-only parser: malformed tables stay untouched text.
// It never interprets Markdown links, HTML, scripts or model instructions.
function cells(line: string): string[] | null {
  const source = line.trim();
  if (!source.startsWith('|') || !source.endsWith('|')) return null;
  const result: string[] = []; let cell = '';
  // Strip only Markdown's conventional single padding space; keep authored
  // indentation and tabs inside each cell. The editable source stays intact.
  const unpad = (value: string) => value.replace(/^ /, '').replace(/ $/, '');
  for (let i = 1; i < source.length - 1; i++) {
    if (source[i] === '\\' && source[i + 1] === '|') { cell += '|'; i++; }
    else if (source[i] === '|') { result.push(unpad(cell)); cell = ''; }
    else cell += source[i];
  }
  result.push(unpad(cell));
  return result.length >= 2 ? result : null;
}

export function parseScriptLayout(text: string): ScriptLayoutBlock[] {
  const lines = text.split(/\r\n|\r|\n/), blocks: ScriptLayoutBlock[] = [];
  let plain: string[] = [];
  const flush = () => { if (plain.length) { blocks.push({ type: 'text', text: plain.join('\n') }); plain = []; } };
  for (let i = 0; i < lines.length; i++) {
    const header = cells(lines[i]), separator = cells(lines[i + 1] || '');
    if (!header || !separator || header.length !== separator.length || !separator.every(cell => /^:?-{3,}:?$/.test(cell))) {
      plain.push(lines[i]); continue;
    }
    const rows: string[][] = []; let end = i + 2, malformed = false;
    while (end < lines.length && lines[end].trim().startsWith('|')) {
      const row = cells(lines[end]);
      if (!row || row.length !== header.length) { malformed = true; break; }
      rows.push(row); end++;
    }
    if (malformed || !rows.length) { plain.push(lines[i]); continue; }
    flush(); blocks.push({ type: 'table', header, rows }); i = end - 1;
  }
  flush(); return blocks;
}
