import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Use production API URL if not in development
const API_BASE = import.meta.env.PROD 
  ? window.location.origin 
  : 'http://localhost:3000';

// Make API base available globally for axios
window.API_BASE = API_BASE;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
