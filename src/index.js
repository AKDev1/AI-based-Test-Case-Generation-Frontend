import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;

const root = ReactDOM.createRoot(document.getElementById('root'));

if (!clientId) {
  console.warn('REACT_APP_GOOGLE_CLIENT_ID is not set. Google login is disabled.');
  root.render(
    <React.StrictMode>
      <App googleClientId={clientId} />
    </React.StrictMode>
  );
} else {
  root.render(
    <React.StrictMode>
      <GoogleOAuthProvider clientId={clientId}>
        <App googleClientId={clientId} />
      </GoogleOAuthProvider>
    </React.StrictMode>
  );
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
