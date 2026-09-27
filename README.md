# Better App Switcher

A GNOME Shell 46 extension with window switching and title visibility features:

- **Super+W** opens the Activities overview filtered to the focused application.
- **Alt+KEY_GRAVE** opens a window switcher filtered to the focused application. Keep Alt held and tap KEY_GRAVE again to move through its windows; release Alt to activate the selected window. **Super+KEY_GRAVE** remains GNOME's built-in same-app switcher.
- **Alt+Tab** shows a title under every window in the regular window switcher.
- The Activities overview always shows each window title below its thumbnail.

Both extension shortcuts can be changed in **Extensions → Better App Switcher → Preferences**. Type shortcuts like `Super + W` or `Alt + KEY_GRAVE` and apply them. Alt+KEY_GRAVE uses GNOME's existing `switch-group` binding by default. After assigning another shortcut, GNOME's original Alt+KEY_GRAVE behavior remains available.

**Recommended companion:** [Cleaner Overview](https://extensions.gnome.org/extension/3759/cleaner-overview/) makes overview window previews the same height and orders them by most recent use. It pairs well with Better App Switcher's overview titles and app-specific window switching.

The overview title feature is inspired by [Always Show Titles In Overview](https://github.com/nlpsuge/Always-Show-Titles-In-Overview) and adapts [GNOME Shell 46's window preview behavior](https://github.com/GNOME/gnome-shell/blob/46.0/js/ui/windowPreview.js).

Licensed under GPL-2.0-or-later; see [LICENSE](LICENSE). The extension UUID uses the `munawwar.github.io` namespace.

## Install

From this directory, compile the schema and install the archive:

```sh
glib-compile-schemas schemas
zip -r /tmp/better-app-switcher.zip metadata.json extension.js prefs.js schemas
gnome-extensions install --force /tmp/better-app-switcher.zip
```

On Wayland, log out and back in after installing so GNOME Shell discovers the update. The extension can be enabled, disabled, or removed from the **Extensions** app.
