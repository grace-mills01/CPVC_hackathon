export function resetRedirect(location) {
 const url = new URL(location.href);
 url.search = '?reset=1';
 url.hash = '';
 return url.href;
}
export function passwordError(password, confirmation) {
 if (password.length < 6) return 'Use at least 6 characters for your new password.';
 if (password !== confirmation) return 'Passwords do not match. Please enter them again.';
 return null;
}
export async function requestPasswordReset(auth, email, location) {
 const {error} = await auth.resetPasswordForEmail(email.trim(), {redirectTo: resetRedirect(location)});
 if (error) throw error;
}
export async function updatePassword(auth, password, confirmation) {
 const message = passwordError(password, confirmation);
 if (message) throw new Error(message);
 const {error} = await auth.updateUser({password});
 if (error) throw error;
}
