import { Fragment } from 'react';
import { parseScriptLayout } from '@/src/lib/script-layout';

export function ScriptLayoutPreview({ text, label }: { text: string; label: string }) {
  const renderCell = (value: string) => value.split(/<br\s*\/?\s*>/i).map((part, i) => <Fragment key={i}>{i > 0 && <br />}{part}</Fragment>);
  return <div className="infinite-script-layout" role="region" aria-label={label} tabIndex={0}>
    {parseScriptLayout(text).map((block, index) => block.type === 'text' ? <pre key={index}>{block.text}</pre>
      : <table key={index}><thead><tr>{block.header.map((cell, i) => <th scope="col" key={i}>{renderCell(cell)}</th>)}</tr></thead>
        <tbody>{block.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{renderCell(cell)}</td>)}</tr>)}</tbody></table>)}
  </div>;
}
