import React, { useEffect, useState } from 'react';
import VideoConversation from './components/VideoConversation';
import AuthPage from './components/AuthPage';
import './App.css';

function App() {
  // null = checking, true = authenticated, false = needs login
  const [authed, setAuthed] = useState(null);

  useEffect(() => {
    fetch('/api/auth/check')
      .then((r) => setAuthed(r.ok))
      .catch(() => setAuthed(false));
  }, []);

  if (authed === null) return null;
  if (!authed) return <AuthPage onSuccess={() => setAuthed(true)} />;
  return <VideoConversation />;
}

export default App;
