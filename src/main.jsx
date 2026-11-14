import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App.jsx';
import OnboardingGate from './features/profiles/OnboardingGate.jsx';
import './styles/globals.css';

createRoot(document.getElementById('root')).render(<React.StrictMode><OnboardingGate><App /></OnboardingGate></React.StrictMode>);
