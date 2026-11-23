// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import { createCssVariablesTheme } from 'shiki/core';

const bookTheme = createCssVariablesTheme({
  name: 'book',
  variablePrefix: '--sh-',
  variableDefaults: {},
  fontStyle: true,
});

export default defineConfig({
  site: 'https://gayanmadurapperuma.github.io',
  base: '/js-node-animated-reference/book',
  trailingSlash: 'ignore',
  integrations: [mdx(), react()],
  markdown: {
    shikiConfig: { theme: bookTheme, wrap: false },
  },
  vite: {
    optimizeDeps: { include: ['mermaid'] },
  },
});
