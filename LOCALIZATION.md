# French localization

The interface follows Obsidian's `language` preference. French variants such as `fr`, `fr-FR` and `fr-CH` select `fr.ts`. Every other language and every missing entry falls back to the original English message. Restart Obsidian after changing its interface language, as usual.

Use `t("English label")` for a label and tagged templates such as `` t`Found ${count} items` `` for dynamic values. In `fr.ts`, template values are numbered `{0}`, `{1}`, and so on. Interpolated values are inserted once, so user text containing braces or replacement characters stays unchanged.

Translate only display text. Keep command IDs, CSS classes, frontmatter keys, stored enum values, filenames and parser syntax stable. Existing user-authored content is not translated or rewritten. Add new French messages to `fr.ts`; untranslated English messages continue to work.

This proposal ports the existing French interface work without bundling fork-specific features, renamed manifests, release artifacts, local backups or private vault content. Technical diagnostics and some generated content still use English. A maintainer can review and extend the catalog independently of application logic.
