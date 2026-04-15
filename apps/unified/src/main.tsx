import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './i18n'; // musi być przed App
import App from './App';
import './index.css';

// Rejestracja Service Workera PWA
// autoUpdate: nowa wersja aplikacji jest ładowana automatycznie przy następnej wizycie
registerSW({
  onNeedRefresh() {
    // Nowa wersja dostępna — autoUpdate obsługuje to samo, ale logujemy dla debugowania
    console.info('[PWA] Nowa wersja dostępna — odśwież stronę');
  },
  onOfflineReady() {
    console.info('[PWA] Aplikacja gotowa do pracy offline');
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
