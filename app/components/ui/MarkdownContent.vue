<script setup lang="ts">
import type { MarkdownBlock, MarkdownHeadingLevel } from '~~/types'

/**
 * Renders a parsed markdown document (`MarkdownBlock[]`) as real elements.
 *
 * There is no wrapper element: the blocks are emitted as a fragment so the caller owns the
 * container, and so the `blockquote` recursion below does not stack a nested wrapper inside
 * every quotation. Scoped styles still apply, because the scope id belongs to this component
 * definition and a recursive instance is the same definition.
 *
 * Heading levels arrive already shifted by the parser (`#` → `h2` in an article, `#` → `h3`
 * in a group body), so a body never competes with the heading the page renders around it. The
 * level is bound to a real `h2`–`h6` tag rather than to a styled `div`, because the outline is
 * what a screen reader and a search engine both read.
 */
const props = defineProps<{
  blocks: MarkdownBlock[]
}>()

function headingTag(level: MarkdownHeadingLevel): string {
  return `h${level}`
}

// Referenced in the template for the `v-if` chain; kept as a prop alias so the template reads
// `block` rather than reaching into `props` on every line.
const blocks = computed(() => props.blocks)
</script>

<template>
  <template
    v-for="(block, index) in blocks"
    :key="index"
  >
    <component
      :is="headingTag(block.level)"
      v-if="block.type === 'heading'"
      class="markdown__heading"
      :class="`markdown__heading--h${block.level}`"
    >
      <MarkdownInline :nodes="block.children" />
    </component>

    <p
      v-else-if="block.type === 'paragraph'"
      class="markdown__paragraph"
    >
      <MarkdownInline :nodes="block.children" />
    </p>

    <blockquote
      v-else-if="block.type === 'blockquote'"
      class="markdown__quote"
    >
      <MarkdownContent :blocks="block.children" />
    </blockquote>

    <pre
      v-else-if="block.type === 'code'"
      class="markdown__pre"
    ><code class="markdown__pre-code">{{ block.text }}</code></pre>

    <ol
      v-else-if="block.type === 'list' && block.ordered"
      class="markdown__list"
      :start="block.start > 1 ? block.start : undefined"
    >
      <li
        v-for="(item, itemIndex) in block.items"
        :key="itemIndex"
        class="markdown__item"
      >
        <MarkdownContent :blocks="item" />
      </li>
    </ol>

    <ul
      v-else-if="block.type === 'list'"
      class="markdown__list"
    >
      <li
        v-for="(item, itemIndex) in block.items"
        :key="itemIndex"
        class="markdown__item"
      >
        <MarkdownContent :blocks="item" />
      </li>
    </ul>

    <hr
      v-else-if="block.type === 'hr'"
      class="markdown__rule"
    />
  </template>
</template>

<style scoped>
.markdown__paragraph {
  font-size: var(--font-size-md);
  line-height: var(--line-height-relaxed);
  margin: 0 0 var(--spacing-md) 0;
  color: var(--color-text);
}

.markdown__heading {
  color: var(--color-text);
  line-height: var(--line-height-tight);
}

.markdown__heading--h2 {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  margin: var(--spacing-2xl) 0 var(--spacing-md) 0;
}

.markdown__heading--h3 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  margin: var(--spacing-xl) 0 var(--spacing-sm) 0;
}

.markdown__heading--h4,
.markdown__heading--h5,
.markdown__heading--h6 {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  margin: var(--spacing-lg) 0 var(--spacing-sm) 0;
}

/* A body opens flush with whatever introduces it, so the first heading does not add a gap
   the reader cannot attribute to anything. Paragraphs already carry no top margin. */
.markdown__heading:first-child {
  margin-top: 0;
}

.markdown__quote {
  margin: 0 0 var(--spacing-md) 0;
  padding: var(--spacing-sm) var(--spacing-md);
  border-left: 3px solid var(--color-primary);
  background: var(--color-background-accent);
  border-radius: var(--radius-sm);
}

.markdown__quote .markdown__paragraph {
  color: var(--color-text-muted);
}

.markdown__list {
  margin: 0 0 var(--spacing-md) 0;
  padding-left: var(--spacing-lg);
}

.markdown__item {
  margin-bottom: var(--spacing-xs);
  line-height: var(--line-height-relaxed);
}

.markdown__item .markdown__paragraph {
  margin-bottom: var(--spacing-xs);
}

.markdown__pre {
  margin: 0 0 var(--spacing-md) 0;
  padding: var(--spacing-md);
  background: var(--color-background-accent);
  border-radius: var(--radius-md);
  overflow-x: auto;
}

.markdown__pre-code {
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
  white-space: pre;
}

.markdown__rule {
  margin: var(--spacing-xl) 0;
  border: 0;
  border-top: var(--border-width) solid var(--color-border);
}
</style>
