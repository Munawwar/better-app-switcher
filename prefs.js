// SPDX-License-Identifier: GPL-2.0-or-later

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const SHORTCUTS = [
    ['toggle-current-app-overview', 'Current app overview'],
    ['switch-current-app-windows', 'Current app window switcher'],
];
const INSTRUCTIONS = 'Type a shortcut such as Super + W or Alt + KEY_GRAVE, then apply it.';

function parseShortcut(text) {
    const parts = text.trim().split(/\s*\+\s*/);
    const key = parts.pop();
    const modifiers = {
        ALT: 'Alt', CTRL: 'Control', CONTROL: 'Control',
        SUPER: 'Super', WIN: 'Super', SHIFT: 'Shift',
        META: 'Meta', HYPER: 'Hyper',
    };
    const prefix = parts.map(part => modifiers[part.toUpperCase()]);
    if (!key || prefix.includes(undefined))
        return null;

    const keyName = ['KEY_GRAVE', 'GRAVE', 'BACKTICK', '`'].includes(key.toUpperCase())
        ? 'grave'
        : /^f\d+$/i.test(key) ? key.toUpperCase() : key.toLowerCase();
    const [valid, keyval, mask] = Gtk.accelerator_parse(
        prefix.map(modifier => `<${modifier}>`).join('') + keyName);
    return valid && Gtk.accelerator_valid(keyval, mask)
        ? Gtk.accelerator_name(keyval, mask) : null;
}

function formatShortcut(accelerator) {
    if (!accelerator)
        return '';
    const [valid, keyval, mask] = Gtk.accelerator_parse(accelerator);
    if (!valid)
        return accelerator;
    const modifiers = [
        [Gdk.ModifierType.CONTROL_MASK, 'Ctrl'],
        [Gdk.ModifierType.ALT_MASK, 'Alt'],
        [Gdk.ModifierType.SHIFT_MASK, 'Shift'],
        [Gdk.ModifierType.SUPER_MASK, 'Super'],
        [Gdk.ModifierType.META_MASK, 'Meta'],
        [Gdk.ModifierType.HYPER_MASK, 'Hyper'],
    ].filter(([bit]) => mask & bit).map(([, name]) => name);
    const keyName = Gdk.keyval_name(keyval);
    modifiers.push(keyName === 'grave' ? 'KEY_GRAVE' : keyName.toUpperCase());
    return modifiers.join(' + ');
}

export default class BetterAppSwitcherPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = window._settings = this.getSettings();
        const page = new Adw.PreferencesPage({title: 'Shortcuts', icon_name: 'preferences-desktop-keyboard-symbolic'});
        const group = new Adw.PreferencesGroup({title: 'Keyboard shortcuts', description: INSTRUCTIONS});
        page.add(group);
        window.add(page);

        for (const [key, title] of SHORTCUTS) {
            const row = new Adw.EntryRow({
                title, text: formatShortcut(settings.get_strv(key)[0]),
                show_apply_button: true,
            });
            const reset = new Gtk.Button({
                icon_name: 'edit-undo-symbolic',
                tooltip_text: 'Restore default shortcut',
                valign: Gtk.Align.CENTER,
            });
            row.add_suffix(reset);
            group.add(row);

            settings.connect(`changed::${key}`, () => {
                row.text = formatShortcut(settings.get_strv(key)[0]);
            });
            reset.connect('clicked', () => settings.reset(key));
            row.connect('apply', () => {
                const accelerator = parseShortcut(row.text);
                if (!accelerator) {
                    group.description = 'Invalid shortcut. Include a modifier, such as Super + W.';
                    return;
                }
                const other = SHORTCUTS.find(([name]) => name !== key)[0];
                if (settings.get_strv(other)[0] === accelerator) {
                    group.description = 'The two shortcuts must be different.';
                    return;
                }
                settings.set_strv(key, [accelerator]);
                row.text = formatShortcut(accelerator);
                group.description = INSTRUCTIONS;
            });
        }
    }
}
