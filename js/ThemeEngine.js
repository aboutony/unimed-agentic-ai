/* ═══════════════════════════════════════════════════════════
   UNIMED AGENTIC AI — Theme Engine
   Persists Light/Dark preference, respects OS default
   ═══════════════════════════════════════════════════════════ */

const ThemeEngine = (() => {
    const STORAGE_KEY = 'unimed-theme';
    const THEMES = { LIGHT: 'light', DARK: 'dark' };

    function _getSystemPreference() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches
            ? THEMES.DARK
            : THEMES.LIGHT;
    }

    function _apply(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(STORAGE_KEY, theme);
    }

    return {
        init() {
            const stored = localStorage.getItem(STORAGE_KEY);
            const theme = stored || _getSystemPreference();
            _apply(theme);

            // Listen for OS-level changes
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (!localStorage.getItem(STORAGE_KEY)) {
                    _apply(e.matches ? THEMES.DARK : THEMES.LIGHT);
                }
            });
        },

        toggle() {
            const current = document.documentElement.getAttribute('data-theme');
            const next = current === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
            _apply(next);
            return next;
        },

        current() {
            return document.documentElement.getAttribute('data-theme') || THEMES.DARK;
        },

        set(theme) {
            if (theme === THEMES.LIGHT || theme === THEMES.DARK) {
                _apply(theme);
            }
        }
    };
})();
