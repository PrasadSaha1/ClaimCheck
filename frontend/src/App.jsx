import { useEffect, useState } from 'react'

export default function App() {
  const [msg, setMsg] = useState('Loading...')

  useEffect(() => {
    fetch('/api/hello/')
      .then(r => r.json())
      .then(d => setMsg(d.message))
      .catch(() => setMsg('Offline or backend unreachable'))
  }, [])

  return (
    <main style={{ fontFamily: 'sans-serif', padding: 24 }}>
      <h1>ClaimCheck</h1>
      <p>{msg}</p>
    </main>
  )
}