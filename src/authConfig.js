export const msalConfig = {
  auth: {
    clientId: '6d100c50-4a82-4fe6-a2db-612eb30f6c03',
    authority: 'https://login.microsoftonline.com/0bbd34cb-91a8-4b8e-a483-034a155ff47b',
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
}

// Scope for the Functions API — must match what Easy Auth expects.
// You'll add this scope in Entra ID → App Registration → Expose an API.
export const apiScope = 'api://6d100c50-4a82-4fe6-a2db-612eb30f6c03/user_impersonation'
