/* ═══════════════════════════════════════════════════════════
   UNIMED AGENTIC AI — Auth Gateway
   Secure login/logout with session management
   Includes "Founder Override" for adonis@saqr.io
   ═══════════════════════════════════════════════════════════ */

const AuthGateway = (() => {
    const SESSION_KEY = 'unimed-session';

    // ── Authorized Users (Demo Mode) ──
    const USERS = [
        { email: 'admin', password: 'unimed2026', role: 'admin', name: 'Administrator', isFounder: false },
        { email: 'admin@unimed.com', password: 'unimed2026', role: 'admin', name: 'UNIMED Admin', isFounder: false },
        { email: 'adonis@saqr.io', password: 'saqr2026', role: 'founder', name: 'Adonis', isFounder: true },
    ];

    function _createSession(user) {
        const session = {
            email: user.email,
            role: user.role,
            name: user.name,
            isFounder: user.isFounder,
            timestamp: Date.now(),
            token: _generateToken()
        };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
        return session;
    }

    function _generateToken() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
    }

    return {
        /**
         * Attempt authentication
         * @returns {{ success: boolean, message?: string, session?: object }}
         */
        authenticate(email, password) {
            const user = USERS.find(u =>
                u.email.toLowerCase() === email.toLowerCase() && u.password === password
            );

            if (!user) {
                return { success: false, message: 'Invalid credentials. Access denied.' };
            }

            const session = _createSession(user);
            return { success: true, session };
        },

        /**
         * Check if a valid session exists
         */
        isAuthenticated() {
            const raw = sessionStorage.getItem(SESSION_KEY);
            if (!raw) return false;

            try {
                const session = JSON.parse(raw);
                // Session valid for 8 hours
                const EIGHT_HOURS = 8 * 60 * 60 * 1000;
                return (Date.now() - session.timestamp) < EIGHT_HOURS;
            } catch {
                return false;
            }
        },

        /**
         * Get current session data
         */
        getSession() {
            const raw = sessionStorage.getItem(SESSION_KEY);
            if (!raw) return null;
            try {
                return JSON.parse(raw);
            } catch {
                return null;
            }
        },

        /**
         * Check if current user has Founder privileges
         * Founder: adonis@saqr.io — exempt from domain pruning
         */
        isFounder() {
            const session = this.getSession();
            return session?.isFounder === true;
        },

        /**
         * Logout — destroy session and redirect
         */
        logout() {
            sessionStorage.removeItem(SESSION_KEY);
            // Story-Flow exit
            const app = document.getElementById('appUniverse');
            if (app) {
                app.style.transition = 'opacity 600ms ease, filter 600ms ease, transform 600ms ease';
                app.style.opacity = '0';
                app.style.filter = 'blur(6px)';
                app.style.transform = 'scale(0.97)';
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 550);
            } else {
                window.location.href = 'login.html';
            }
        },

        /**
         * Guard — redirect to login if not authenticated
         */
        guard() {
            if (!this.isAuthenticated()) {
                window.location.href = 'login.html';
                return false;
            }
            return true;
        }
    };
})();
