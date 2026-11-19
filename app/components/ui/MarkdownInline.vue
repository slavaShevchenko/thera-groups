<script setup lang="ts">
import type { MarkdownInline as MarkdownInlineNode } from '~~/types'

/**
 * Renders inline markdown nodes.
 *
 * The recursion is the component referring to itself for `strong`/`em`/`del`/`link`, which
 * is why this is its own file rather than a branch inside `MarkdownContent`. Every leaf is
 * `{{ }}` interpolation or an attribute binding: there is no `v-html` on this path, so a node
 * type the parser does not produce cannot be rendered, and one it does produce cannot carry
 * markup. That is the whole safety story for article bodies — see `server/utils/markdown.ts`.
 *
 * Links deliberately keep the site's global `a` styling rather than re-stating it: the global
 * rule uses `--color-primary-text`, which clears AA contrast against the page background, and
 * a local override would either duplicate that rule or quietly weaken it.
 */
defineProps<{
  nodes: MarkdownInlineNode[]
}>()
</script>

<template>
  <template
    v-for="(node, index) in nodes"
    :key="index"
  >
    <template v-if="node.type === 'text'">
      {{ node.text }}
    </template>

    <strong v-else-if="node.type === 'strong'">
      <MarkdownInline :nodes="node.children" />
    </strong>

    <em v-else-if="node.type === 'em'">
      <MarkdownInline :nodes="node.children" />
    </em>

    <del v-else-if="node.type === 'del'">
      <MarkdownInline :nodes="node.children" />
    </del>

    <!-- Whitespace-collapsed on purpose: a newline inside `<code>` renders as a literal space. -->
    <code
      v-else-if="node.type === 'code'"
      class="markdown-inline__code"
    >{{ node.text }}</code>

    <br v-else-if="node.type === 'br'" />

    <a
      v-else-if="node.type === 'link'"
      :href="node.href"
      :title="node.title ?? undefined"
    >
      <MarkdownInline :nodes="node.children" />
    </a>

    <img
      v-else-if="node.type === 'image'"
      class="markdown-inline__image"
      :src="node.src"
      :alt="node.alt"
      :title="node.title ?? undefined"
      loading="lazy"
      decoding="async"
    />
  </template>
</template>

<style scoped>
.markdown-inline__code {
  padding: 0.1em 0.35em;
  background: var(--color-background-accent);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
}

.markdown-inline__image {
  max-width: 100%;
  height: auto;
  border-radius: var(--radius-md);
}
</style>
