import { useState, useEffect } from 'react';
import { getUser } from './api/client';
import { LoginPage }    from './pages/LoginPage';
import { TaskpaneApp }  from './pages/TaskpaneApp';

declare const Office: any;

export default function App() {
  const [user,    setUser]    = useState<any>(() => getUser());
  const [ready,   setReady]   = useState(false);

  useEffect(() => {
    // Office.js musi być zainicjalizowany zanim użyjemy mailbox API
    if (typeof Office !== 'undefined') {
      Office.onReady(() => setReady(true));
    } else {
      // Tryb deweloperski — bez Outlooka
      setReady(true);
    }
  }, []);

  if (!ready) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Segoe UI', sans-serif", color: '#888', fontSize: '13px',
      }}>
        <div>
          <div style={{
            width: '20px', height: '20px', border: '2px solid #e5e7eb',
            borderTopColor: '#B53578', borderRadius: '50%', margin: '0 auto 12px',
            animation: 'spin 0.8s linear infinite',
          }} />
          Ładowanie…
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={u => setUser(u)} />;
  }

  return <TaskpaneApp onLogout={() => setUser(null)} />;
}
