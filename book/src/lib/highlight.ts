import { createHighlighter, type Highlighter } from 'shiki';
import { createCssVariablesTheme } from 'shiki/core';

const theme = createCssVariablesTheme({ name: 'book', variablePrefix: '--sh-', variableDefaults: {}, fontStyle: true });
let hl: Promise<Highlighter> | null = null;

/** Highlight code and return one HTML string per source line. */
export async function highlightLines(code: string, lang: 'js' | 'ts' = 'js'): Promise<string[]> {
  hl ??= createHighlighter({ themes: [theme], langs: ['javascript', 'typescript'] });
  const h = await hl;
  const tokens = h.codeToTokensBase(code, { lang: lang === 'ts' ? 'typescript' : 'javascript', theme: 'book' });
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return tokens.map((line) =>
    line.map((t) => {
      const italic = t.fontStyle && t.fontStyle & 1 ? ';font-style:italic' : '';
      return t.color ? `<span style="color:${t.color}${italic}">${esc(t.content)}</span>` : esc(t.content);
    }).join(''),
  );
}
