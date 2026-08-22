# Accessibility

Accessibility is a first-class requirement.

## HTML

Prefer semantic HTML:

```text
button
a
nav
main
header
footer
form
label
fieldset
legend
```

Do not use `<div>` as an interactive control.

## Multilingual accessibility

### HTML lang attribute

The `<html>` element must always have the correct `lang` attribute that matches the current locale:

```html
<html lang="uk">
```

or

```html
<html lang="en">
```

This must update dynamically when the user switches languages. Use the `useLocale()` composable to keep it in sync:

```vue
<script setup lang="ts">
const { locale } = useLocale()

useHead({
  htmlAttrs: {
    lang: computed(() => locale.value === 'ua' ? 'uk' : 'en')
  }
})
</script>
```

### Why this matters

- Screen readers use the `lang` attribute to select the correct pronunciation rules
- Browsers use it for spell-checking and hyphenation
- Translation tools use it to detect the page language
- Search engines use it for language targeting

### Language code mapping

The application uses `ua` as the locale code, but the HTML `lang` attribute must use the ISO 639-1 standard:

```text
ua → uk (Ukrainian)
en → en (English)
```

## Language switcher

The language switcher must be accessible to all users.

### Requirements

- Use a `<button>` element (not `<div>` or `<a>`)
- Provide a visible text label or accessible name
- Indicate the current language clearly
- Do not rely on color alone to communicate state

### Accessible implementation

Good:

```vue
<button 
  class="language-switcher"
  :aria-label="t('common.accessibility.switchLanguage')"
  @click="toggleLanguage"
>
  <span class="language-switcher__label">
    {{ locale === 'ua' ? 'UA' : 'EN' }}
  </span>
</button>
```

Bad:

```vue
<!-- No accessible name, only icon -->
<div @click="toggleLanguage">
  🌐
</div>
```

### Focus management

The language switcher must:

- Be keyboard accessible (Tab to reach, Enter/Space to activate)
- Maintain visible focus indicator
- Not cause unexpected focus loss after switching

### Screen reader announcements

When the language changes, consider announcing it to screen readers:

```vue
<div 
  role="status" 
  aria-live="polite" 
  class="sr-only"
>
  {{ languageChangedMessage }}
</div>
```

## Keyboard

Every interactive element must be keyboard accessible.

Do not create mouse-only interactions.

## Focus

Focus must be visible.

Modals must:

- move focus into the modal
- prevent accidental interaction with the background
- restore focus after close

## Forms

Every input needs an accessible label.

Validation errors must be associated with the relevant field.

Use appropriate ARIA attributes only when native semantics are insufficient.

### Multilingual form labels

Form labels, placeholders, and error messages must be localized:

```vue
<label :for="fieldId">
  {{ t('forms.application.name') }}
</label>
<input 
  :id="fieldId"
  :placeholder="t('forms.application.namePlaceholder')"
  :aria-describedby="errorId"
/>
<p v-if="error" :id="errorId" role="alert">
  {{ t('forms.application.nameRequired') }}
</p>
```

## Loading

Loading states must be understandable to assistive technology when appropriate.

## Color

Do not communicate meaning through color alone.

Example:

An error should not be represented only by red.

## Motion

Respect:

```text
prefers-reduced-motion
```

Avoid unnecessary animation.

## Images

Meaningful images require appropriate alt text.

Decorative images should not create redundant screen-reader content.

### Localized alt text

Alt text must be localized:

```vue
<img 
  :src="therapist.avatar" 
  :alt="t('therapist.avatar', { name: therapist.name })"
/>
```

## Links vs buttons

Use:

- links for navigation
- buttons for actions

Do not misuse one for the other.

### Language switching is an action

Language switching changes the application state, so it should use a `<button>`, not a link. Even though the URL changes, the primary intent is to change the language, not navigate to a different resource.

## Screen reader only content

Use the `.sr-only` class for content that should be available to screen readers but not visible:

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

Use it for:

- Language change announcements
- Context that visual design already communicates
- Skip navigation links

---