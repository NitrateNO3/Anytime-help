// Renders the small, fixed HTML subset used by the privacy / terms screens
// (h1-h3, p, ul/li, table/tr/th/td, div.summary, div.alert-box, strong, em, br)
// with native components, so those screens don't need a WebView.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

type Node = { tag: string; cls?: string; children: Node[] } | string;

const VOID_TAGS = new Set(['br', 'meta', 'img', 'hr']);
const INLINE_TAGS = new Set(['strong', 'b', 'em', 'i', 'br', 'span', 'a']);

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');

function parse(html: string): Node[] {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const src = (bodyMatch ? bodyMatch[1] : html).replace(/<!--[\s\S]*?-->/g, '');
  const root: { tag: string; children: Node[] } = { tag: 'root', children: [] };
  const stack: { tag: string; cls?: string; children: Node[] }[] = [root];
  const re = /<\/?([a-zA-Z0-9]+)([^>]*)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const top = stack[stack.length - 1];
    if (m[3] !== undefined) {
      top.children.push(decode(m[3]));
      continue;
    }
    const tag = m[1].toLowerCase();
    if (m[0].startsWith('</')) {
      // Pop back to the matching open tag (tolerates unclosed children)
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === tag) {
          stack.length = i;
          break;
        }
      }
      continue;
    }
    const clsMatch = m[2].match(/class\s*=\s*"([^"]*)"/i);
    const node = { tag, cls: clsMatch ? clsMatch[1] : undefined, children: [] as Node[] };
    top.children.push(node);
    if (!VOID_TAGS.has(tag) && !m[2].trim().endsWith('/')) stack.push(node);
  }
  return root.children;
}

const isInline = (n: Node) => typeof n === 'string' || INLINE_TAGS.has(n.tag);

function renderInline(nodes: Node[], keyPrefix: string): React.ReactNode[] {
  return nodes.map((n, i) => {
    const key = `${keyPrefix}-${i}`;
    if (typeof n === 'string') return n.replace(/\s+/g, ' ');
    if (n.tag === 'br') return '\n';
    const style =
      n.tag === 'strong' || n.tag === 'b' ? styles.strong : n.tag === 'em' || n.tag === 'i' ? styles.em : undefined;
    return (
      <Text key={key} style={style}>
        {renderInline(n.children, key)}
      </Text>
    );
  });
}

// Trim whitespace at the edges of a run of inline nodes
function trimRun(nodes: Node[]): Node[] {
  const out = [...nodes];
  while (out.length && typeof out[0] === 'string' && !(out[0] as string).trim()) out.shift();
  while (out.length && typeof out[out.length - 1] === 'string' && !(out[out.length - 1] as string).trim()) out.pop();
  if (out.length && typeof out[0] === 'string') out[0] = (out[0] as string).replace(/^\s+/, '');
  const last = out.length - 1;
  if (last >= 0 && typeof out[last] === 'string') out[last] = (out[last] as string).replace(/\s+$/, '');
  return out;
}

type Ctx = { alert?: boolean };

function renderBlocks(nodes: Node[], keyPrefix: string, ctx: Ctx): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let run: Node[] = [];
  const flush = () => {
    const trimmed = trimRun(run);
    if (trimmed.length) {
      out.push(
        <Text key={`${keyPrefix}-t${out.length}`} style={[styles.p, ctx.alert && styles.alertText]}>
          {renderInline(trimmed, `${keyPrefix}-t${out.length}`)}
        </Text>
      );
    }
    run = [];
  };

  nodes.forEach((n, i) => {
    if (isInline(n)) {
      run.push(n);
      return;
    }
    flush();
    const node = n as Exclude<Node, string>;
    const key = `${keyPrefix}-${i}`;
    const inline = (style: any) => (
      <Text key={key} style={style}>
        {renderInline(trimRun(node.children), key)}
      </Text>
    );

    switch (node.tag) {
      case 'h1':
        out.push(inline(styles.h1));
        break;
      case 'h2':
        out.push(inline([styles.h2, ctx.alert && styles.alertHeading]));
        break;
      case 'h3':
        out.push(inline(styles.h3));
        break;
      case 'p':
        out.push(inline([styles.p, ctx.alert && styles.alertText]));
        break;
      case 'ul':
      case 'ol':
        out.push(
          <View key={key} style={styles.list}>
            {node.children
              .filter((c) => typeof c !== 'string' && c.tag === 'li')
              .map((li, j) => (
                <View key={`${key}-${j}`} style={styles.li}>
                  <Text style={styles.bullet}>{node.tag === 'ol' ? `${j + 1}.` : '•'}</Text>
                  <Text style={styles.liText}>
                    {renderInline(trimRun((li as Exclude<Node, string>).children), `${key}-${j}`)}
                  </Text>
                </View>
              ))}
          </View>
        );
        break;
      case 'table': {
        const rows: Exclude<Node, string>[] = [];
        const collect = (list: Node[]) =>
          list.forEach((c) => {
            if (typeof c === 'string') return;
            if (c.tag === 'tr') rows.push(c);
            else collect(c.children); // thead / tbody
          });
        collect(node.children);
        out.push(
          <View key={key} style={styles.table}>
            {rows.map((tr, r) => (
              <View key={`${key}-${r}`} style={[styles.tr, r === rows.length - 1 && { borderBottomWidth: 0 }]}>
                {tr.children
                  .filter((c) => typeof c !== 'string')
                  .map((cell, ci, cells) => {
                    const c = cell as Exclude<Node, string>;
                    const isTh = c.tag === 'th';
                    return (
                      <View
                        key={`${key}-${r}-${ci}`}
                        style={[styles.cell, isTh && styles.th, ci === cells.length - 1 && { borderRightWidth: 0 }]}
                      >
                        <Text style={[styles.cellText, isTh && styles.strong]}>
                          {renderInline(trimRun(c.children), `${key}-${r}-${ci}`)}
                        </Text>
                      </View>
                    );
                  })}
              </View>
            ))}
          </View>
        );
        break;
      }
      case 'div': {
        const isAlert = !!node.cls?.includes('alert-box');
        const boxStyle = isAlert ? styles.alertBox : node.cls?.includes('summary') ? styles.summary : undefined;
        out.push(
          <View key={key} style={boxStyle}>
            {renderBlocks(node.children, key, { ...ctx, alert: isAlert || ctx.alert })}
          </View>
        );
        break;
      }
      default:
        out.push(...renderBlocks(node.children, key, ctx));
    }
  });
  flush();
  return out;
}

export default function PolicyHtml({ html }: { html: string }) {
  const tree = React.useMemo(() => parse(html), [html]);
  return <View style={styles.container}>{renderBlocks(tree, 'n', {})}</View>;
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 50 },
  h1: { fontSize: 22, fontWeight: '700', color: '#111827', lineHeight: 29, marginBottom: 16 },
  h2: { fontSize: 18, fontWeight: '700', color: '#111827', lineHeight: 24, marginTop: 24, marginBottom: 12 },
  h3: { fontSize: 16, fontWeight: '700', color: '#111827', lineHeight: 21, marginTop: 20, marginBottom: 10 },
  p: { fontSize: 14, color: '#4B5563', lineHeight: 22, marginBottom: 16 },
  strong: { fontWeight: '700', color: '#111827' },
  em: { fontStyle: 'italic' },
  list: { marginBottom: 16, paddingLeft: 4 },
  li: { flexDirection: 'row', marginBottom: 8 },
  bullet: { width: 16, fontSize: 14, color: '#4B5563', lineHeight: 22 },
  liText: { flex: 1, fontSize: 14, color: '#4B5563', lineHeight: 22 },
  table: { borderWidth: 1, borderColor: '#D1D5DB', marginTop: 8, marginBottom: 16 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#D1D5DB' },
  cell: { flex: 1, padding: 8, borderRightWidth: 1, borderColor: '#D1D5DB' },
  th: { backgroundColor: '#F3F4F6' },
  cellText: { fontSize: 13, color: '#4B5563' },
  summary: { backgroundColor: '#F3F4F6', padding: 16, borderRadius: 8, marginBottom: 24 },
  alertBox: {
    borderWidth: 1,
    borderColor: '#F87171',
    backgroundColor: '#FEF2F2',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  alertHeading: { marginTop: 0, color: '#B91C1C', fontSize: 16 },
  alertText: { color: '#991B1B', marginBottom: 8 },
});
