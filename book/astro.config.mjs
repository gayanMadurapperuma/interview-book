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
  site: process.env.SITE_URL || 'https://gayanmadurapperuma.github.io',
  // In CI the base comes from actions/configure-pages (the repo's Pages path),
  // so renaming the repo or adding a custom domain needs no code change.
  // ('' from a custom domain means the site root)
  base: process.env.BASE_PATH === undefined ? '/interview-book' : process.env.BASE_PATH || '/',
  trailingSlash: 'ignore',
  integrations: [mdx(), react()],
  markdown: {
    shikiConfig: { theme: bookTheme, wrap: false },
  },
  vite: {
    optimizeDeps: { include: ['mermaid'] },
  },
});
