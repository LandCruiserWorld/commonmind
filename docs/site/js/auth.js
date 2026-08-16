// Auth utilities for CommonMind — talks to /api/auth/*.
// Session lives in an HttpOnly cookie, so this file never touches the token
// directly; it just asks the API who's signed in.

const Auth = {
  // Send a magic link to `email`. `next` is where verify.js redirects after
  // sign-in — pass the onboarding step the user was on, if any.
  async requestMagicLink(email, next = null) {
    const res = await fetch('/api/auth/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, next }),
    });
    return res.json();
  },

  // Returns the signed-in user object, or null if not authenticated.
  // user.id is the owner_id every memory call gets scoped to.
  async getUser() {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
      if (!res.ok) return null;
      const data = await res.json();
      return data.success ? data.user : null;
    } catch {
      return null;
    }
  },

  async isLoggedIn() {
    return (await this.getUser()) !== null;
  },

  // Redirect to the onboarding start if not authenticated. Returns the user
  // on success so callers don't have to fetch it twice.
  async requireAuth() {
    const user = await this.getUser();
    if (!user) {
      window.location.href = '/#start';
      return null;
    }
    return user;
  },

  async logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    window.location.href = '/';
  },
};

if (typeof window !== 'undefined') {
  window.Auth = Auth;
}
if (typeof module !== 'undefined') {
  module.exports = Auth;
}
