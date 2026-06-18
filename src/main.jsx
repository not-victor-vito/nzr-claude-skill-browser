import React from 'react'
import ReactDOM from 'react-dom/client'
import { PublicClientApplication, EventType, InteractionType } from '@azure/msal-browser'
import { MsalProvider, MsalAuthenticationTemplate } from '@azure/msal-react'
import App from './App.jsx'
import { msalConfig, apiScope } from './authConfig.js'
import './index.css'

PublicClientApplication.createPublicClientApplication(msalConfig).then((msalInstance) => {
  // Set the active account after login so acquireTokenSilent works
  msalInstance.addEventCallback((event) => {
    if (event.eventType === EventType.LOGIN_SUCCESS && event.payload?.account) {
      msalInstance.setActiveAccount(event.payload.account)
    }
  })

  const accounts = msalInstance.getAllAccounts()
  if (accounts.length > 0) {
    msalInstance.setActiveAccount(accounts[0])
  }

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <MsalProvider instance={msalInstance}>
        <MsalAuthenticationTemplate
          interactionType={InteractionType.Redirect}
          authenticationRequest={{ scopes: [apiScope] }}
        >
          <App />
        </MsalAuthenticationTemplate>
      </MsalProvider>
    </React.StrictMode>,
  )
})
