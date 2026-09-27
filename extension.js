// SPDX-License-Identifier: GPL-2.0-or-later

import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as AltTab from 'resource:///org/gnome/shell/ui/altTab.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as WindowPreview from 'resource:///org/gnome/shell/ui/windowPreview.js';
import * as Workspace from 'resource:///org/gnome/shell/ui/workspace.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const OVERVIEW_SHORTCUT = 'toggle-current-app-overview';
const SWITCHER_SHORTCUT = 'switch-current-app-windows';
const DEFAULT_SWITCHER_SHORTCUT = '<Alt>grave';

// Adapted from WindowPreview.showOverlay()/hideOverlay() by Jonas Dreßler,
// Florian Müllner, and Sebastian Keller. GNOME Shell license: GPL-2.0-or-later.
// https://github.com/GNOME/gnome-shell/blob/46.0/js/ui/windowPreview.js
// BEGIN adapted GNOME Shell code
function updateOverviewOverlay(shown, animate) {
    if ((shown && !this._overlayEnabled) || this._overlayShown === shown)
        return;

    this._overlayShown = shown;
    this._restack();

    const button = this._closeButton;
    if (shown && this._windowCanClose()) {
        button.opacity = 0;
        button.show();
        button.ease({opacity: 255, duration: animate ? 200 : 0,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD});
    } else if (!shown) {
        button.opacity = 255;
        button.ease({opacity: 0, duration: animate ? 200 : 0,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => button.hide()});
    }

    let scale = 1;
    if (shown) {
        const [width, height] = this.window_container.get_size();
        const {scaleFactor} = St.ThemeContext.get_for_stage(global.stage);
        scale += 10 * scaleFactor / Math.max(width, height);
    }
    this.window_container.ease({scale_x: scale, scale_y: scale,
        duration: animate ? 200 : 0, mode: Clutter.AnimationMode.EASE_OUT_QUAD});

    if (shown)
        this.emit('show-chrome');
}
// END adapted GNOME Shell code

const FocusedAppWindowSwitcher = GObject.registerClass(
class FocusedAppWindowSwitcher extends AltTab.WindowSwitcherPopup {
    _init(action) {
        super._init();
        this._action = action;
    }

    _getWindowList() {
        const tracker = Shell.WindowTracker.get_default();
        const focusedWindow = global.display.focus_window;
        if (!focusedWindow)
            return [];
        const app = tracker.get_window_app(focusedWindow);
        return app
            ? super._getWindowList().filter(window => tracker.get_window_app(window) === app)
            : [];
    }

    _keyPressHandler(keysym, action) {
        if (action === Meta.KeyBindingAction.SWITCH_GROUP || action === this._action)
            this._select(this._next());
        else if (action === Meta.KeyBindingAction.SWITCH_GROUP_BACKWARD)
            this._select(this._previous());
        else
            return super._keyPressHandler(keysym, action);
        return Clutter.EVENT_STOP;
    }
});

export default class CurrentAppSwitcher extends Extension {
    enable() {
        this._settings = this.getSettings();
        Main.wm.addKeybinding(
            OVERVIEW_SHORTCUT,
            this._settings,
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.ALL,
            () => this._toggleOverview()
        );

        const windowSwitcher = AltTab.WindowSwitcherPopup.prototype;
        const originalInit = this._originalWindowSwitcherInit = windowSwitcher._init;
        windowSwitcher._init = function (...args) {
            originalInit.apply(this, args);
            this._switcherList._label.hide();
            for (const icon of this._switcherList.icons) {
                icon.label.x_align = Clutter.ActorAlign.CENTER;
                icon.add_child(icon.label);
                icon.label.show();
            }
        };

        const preview = WindowPreview.WindowPreview.prototype;
        const originalPreviewInit = this._originalPreviewInit = preview._init;
        this._originalShowOverlay = preview.showOverlay;
        this._originalHideOverlay = preview.hideOverlay;
        preview._init = function (...args) {
            originalPreviewInit.apply(this, args);
            this._title.show();
        };
        preview.showOverlay = function (animate) {
            updateOverviewOverlay.call(this, true, animate);
        };
        preview.hideOverlay = function (animate) {
            updateOverviewOverlay.call(this, false, animate);
        };

        this._switcherAction = 0;
        this._settingsChangedId = this._settings.connect(
            `changed::${SWITCHER_SHORTCUT}`, () => this._refreshSwitcherBinding());
        this._refreshSwitcherBinding();

        this._originalSwitcher = Main.wm._startSwitcher.bind(Main.wm);
        const handleGroupSwitch = (display, window, binding) => {
            if (this._usesDefaultSwitcherShortcut() &&
                binding.get_mask() & Clutter.ModifierType.MOD1_MASK) {
                this._showFocusedAppSwitcher(binding);
            } else {
                this._originalSwitcher(display, window, binding);
            }
        };
        Main.wm.setCustomKeybindingHandler('switch-group', Shell.ActionMode.NORMAL, handleGroupSwitch);
        Main.wm.setCustomKeybindingHandler('switch-group-backward', Shell.ActionMode.NORMAL, handleGroupSwitch);
    }

    disable() {
        Main.wm.removeKeybinding(OVERVIEW_SHORTCUT);
        this._settings.disconnect(this._settingsChangedId);
        if (this._switcherAction)
            Main.wm.removeKeybinding(SWITCHER_SHORTCUT);
        Main.wm.setCustomKeybindingHandler('switch-group', Shell.ActionMode.NORMAL, this._originalSwitcher);
        Main.wm.setCustomKeybindingHandler('switch-group-backward', Shell.ActionMode.NORMAL, this._originalSwitcher);
        AltTab.WindowSwitcherPopup.prototype._init = this._originalWindowSwitcherInit;
        const preview = WindowPreview.WindowPreview.prototype;
        preview._init = this._originalPreviewInit;
        preview.showOverlay = this._originalShowOverlay;
        preview.hideOverlay = this._originalHideOverlay;
        this._settings = null;
    }

    _usesDefaultSwitcherShortcut() {
        return this._settings.get_strv(SWITCHER_SHORTCUT)[0] === DEFAULT_SWITCHER_SHORTCUT;
    }

    _refreshSwitcherBinding() {
        const custom = this._settings.get_strv(SWITCHER_SHORTCUT).length > 0 &&
            !this._usesDefaultSwitcherShortcut();
        if (custom && !this._switcherAction) {
            this._switcherAction = Main.wm.addKeybinding(
                SWITCHER_SHORTCUT, this._settings, Meta.KeyBindingFlags.NONE,
                Shell.ActionMode.NORMAL, (_display, _window, binding) =>
                    this._showFocusedAppSwitcher(binding, this._switcherAction));
        } else if (!custom && this._switcherAction) {
            Main.wm.removeKeybinding(SWITCHER_SHORTCUT);
            this._switcherAction = 0;
        }
    }

    _showFocusedAppSwitcher(binding, action) {
        const popup = new FocusedAppWindowSwitcher(action);
        if (!popup.show(binding.is_reversed(), binding.get_name(), binding.get_mask()))
            popup.destroy();
    }

    _toggleOverview() {
        const activeWindow = global.display.focus_window;
        if (!activeWindow)
            return;

        const proto = Workspace.Workspace.prototype;
        const original = proto._isOverviewWindow;
        proto._isOverviewWindow = window => window.wm_class === activeWindow.wm_class;
        try {
            Main.overview.toggle();
        } finally {
            proto._isOverviewWindow = original;
        }
    }
}
