# CSS Architecture

Design tokens are stored in: assets/css/variables.css

## Absolute rule

No Tailwind.

No Bootstrap.

No CSS framework.

No UI framework.

No CSS-in-JS.

Use plain CSS with CSS custom properties and BEM.

## BEM

Every component uses:

```text
block
block__element
block--modifier
block__element--modifier
```

Example:

```text
group-card
group-card__title
group-card__meta
group-card__meta-item
group-card--featured
```

Do not use ambiguous global classes such as:

```text
.title
.button
.container
.active
```

inside component styles.

## Scoped styles

Component-specific CSS belongs in:

```vue
<style scoped>
```

Global CSS is reserved for:

- reset
- base document styles
- CSS variables
- truly global accessibility rules

## CSS variables

Keep the design token system intentionally small.

Example categories:

```css
:root {
  --color-primary: ...;
  --color-background: ...;
  --color-surface: ...;
  --color-text: ...;
  --color-text-muted: ...;
  --color-border: ...;
  --color-error: ...;
  --color-success: ...;

  --font-family-base: ...;
  --font-size-sm: ...;
  --font-size-md: ...;
  --font-size-lg: ...;

  --radius-sm: ...;
  --radius-md: ...;
  --radius-lg: ...;

  --shadow-sm: ...;
  --shadow-md: ...;

  --container-width: ...;
}
```

Do not create a huge spacing scale.

A local component can reasonably use:

```css
padding: 12px 16px;
```

when that value is not a design-system token.

## Responsive CSS

Use normal CSS media queries.

Prefer mobile-first rules.

Do not encode responsive behavior through JavaScript unless it is genuinely required for behavior rather than presentation.

## Accessibility

Never remove focus indicators without replacement.

Respect:

```css
prefers-reduced-motion
```

for non-essential animations.

Use semantic HTML before using CSS to simulate semantics.
