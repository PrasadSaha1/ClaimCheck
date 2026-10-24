import { useEffect, useState } from 'react'
import CampusMap from './CampusMap'
import { api } from './api'
import './App.css'

const CATEGORIES = ['Electronics', 'Wallet & keys', 'Clothing', 'Books', 'Other']
const localDate = (date) => {
  const d = new Date(date)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
const formatDate = (date) => new Date(date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })

function Icon({ name, size = 22 }) {
  const paths = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m16 16 5 5" /></>,
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    arrow: <><path d="M5 12h14m-6-6 6 6-6 6" /></>,
    box: <><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M3 11h18M8 7V4h8v3" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    check: <><path d="m4 12 5 5L20 6" /></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}


function SignIn({ onSignIn, onSignUp, busy, message, onClearMessage }) {
  const [isSignUp, setIsSignUp] = useState(false)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()

    if (isSignUp) {
      /* Handled in backend
      if (password !== confirmPassword) {
        alert("Passwords do not match!")
        return
      } */

      onSignUp({
        name,
        password,
        confirm_password: confirmPassword,
        email,
        phone
      })
    } else {
      onSignIn({
        name,
        password
      })
    }
  }

  return (
    <div className="sign-in-shell">
      <div className="sign-in-card">
        <span className="brand-mark">
          <Icon name="box" size={28} />
        </span>

        <span className="eyebrow">
          STONY BROOK · LOST & FOUND
        </span>

        <h1>
          Good things find<br />
          <em>their way back.</em>
        </h1>

        <p>
          Report what you lost or found. ClaimCheck helps
          the right person reconnect with it.
        </p>

        <form onSubmit={handleSubmit}>
          <label>
            Username
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Nish"
              maxLength={80}
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          {isSignUp && (
            <>
              <label>
                Confirm Password
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </label>

              <label>
                Email
                <small>Must be Stony Brook email</small>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="you@stonybrook.edu"
                  required
                />
              </label>

              <label>
                Phone Number
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  type="tel"
                  pattern="[0-9]{3}-[0-9]{3}-[0-9]{4}"
                  placeholder="123-456-7890"
                />
              </label>
            </>
          )}

          {message && <p className="error">{message}</p>}

          <button
            type="submit"
            className="button primary full"
            disabled={busy}
          >
            {busy
              ? "Please wait..."
              : isSignUp ? "Sign Up" : "Log In"}
            <Icon name="arrow" size={18} />
          </button>
        </form>

        <p className="auth-toggle">
          {isSignUp
            ? "Already have an account?"
            : "Don't have an account?"}

          {' '}
          <button
            type="button"
            className="toggle-button"
            onClick={() => {
              setIsSignUp(!isSignUp)
              onClearMessage()
            }}
          >
            {isSignUp ? "Log In" : "Sign Up"}
          </button>
        </p>
      </div>

      <div className="sign-in-art">
        <div className="orbit orbit-one" />
        <div className="orbit orbit-two" />
        <div className="art-ticket">
          FOUND<br /><span>01 / 01</span>
        </div>
        <p>Less searching.<br />More finding.</p>
      </div>
    </div>
  )
}


function ImageStrip({ photos = [] }) {
  if (!photos.length) return null
  return <div className="image-strip">{photos.map((p) => <img key={p.id} src={p.url} alt="Item" />)}</div>
}

function FormField({ label, children, hint }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>
}

function LostForm({ submit, busy, goBack }) {
  const [point, setPoint] = useState(null)
  const [radius, setRadius] = useState(400)
  const [photos, setPhotos] = useState([])
  const [error, setError] = useState('')
  const [after, setAfter] = useState(() => localDate(Date.now() - 86400000))
  const [before, setBefore] = useState(() => localDate(Date.now()))
  async function onSubmit(event) {
    event.preventDefault()
    if (!point) { setError('Choose the area on the map.'); return }
    const form = new FormData(event.currentTarget)
    form.set('latitude', point.latitude)
    form.set('longitude', point.longitude)
    form.set('radius_m', radius)
    form.set('lost_after', new Date(after).toISOString())
    form.set('lost_before', new Date(before).toISOString())
    photos.forEach((file) => form.append('photos', file))
    try { setError(''); await submit(form, 'lost') } catch (e) { setError(e.message) }
  }
  return <section className="content narrow">
    <button className="back-link" onClick={goBack}>← Back to home</button>
    <div className="page-heading"><span className="eyebrow">LET'S TRACK IT DOWN</span><h1>I lost something</h1><p>Share what you remember. Your report stays open so new matches can find you.</p></div>
    <form className="form-card" onSubmit={onSubmit}>
      <FormField label="What did you lose? *" hint="Include color, brand, markings, and anything distinctive.">
        <textarea name="description" rows={4} required maxLength={2000} placeholder="A black water bottle with a yellow sticker..." />
      </FormField>
      <FormField label="Category"><select name="category">{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></FormField>
      <FormField label="Old photos" hint="Optional. These are private to your report."><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => setPhotos([...e.target.files])} /></FormField>
      <div className="field"><span>Where might it be? *</span><p className="field-copy">Tap the map and adjust the rough search area.</p><CampusMap value={point} onChange={setPoint} radius={radius} />
        <div className="range-row"><span>Search radius</span><input type="range" min="50" max="1200" step="50" value={radius} onChange={(e) => setRadius(Number(e.target.value))} /><strong>{radius} m</strong></div>
      </div>
      <div className="form-grid"><FormField label="Lost after"><input type="datetime-local" value={after} onChange={(e) => setAfter(e.target.value)} required /></FormField><FormField label="Lost before"><input type="datetime-local" value={before} onChange={(e) => setBefore(e.target.value)} required /></FormField></div>
      {error && <p className="error">{error}</p>}
      <button className="button primary" disabled={busy}>{busy ? 'Saving report…' : 'Create lost report'} <Icon name="arrow" size={18} /></button>
    </form>
  </section>
}

function FoundForm({ submit, busy, goBack }) {
  const [point, setPoint] = useState(null)
  const [photos, setPhotos] = useState([])
  const [error, setError] = useState('')
  const [foundAt, setFoundAt] = useState(() => localDate(Date.now()))
  async function onSubmit(event) {
    event.preventDefault()
    if (!point) { setError('Pin where you found the item.'); return }
    const form = new FormData(event.currentTarget)
    form.set('latitude', point.latitude)
    form.set('longitude', point.longitude)
    form.set('found_at', new Date(foundAt).toISOString())
    photos.forEach((file) => form.append('photos', file))
    try { setError(''); await submit(form, 'found') } catch (e) { setError(e.message) }
  }
  return <section className="content narrow">
    <button className="back-link" onClick={goBack}>← Back to home</button>
    <div className="page-heading"><span className="eyebrow">THANKS FOR HELPING</span><h1>I found something</h1><p>A few details can make all the difference to the person looking for it.</p></div>
    <form className="form-card" onSubmit={onSubmit}>
      <FormField label="Photos *" hint="Add 1–5 clear photos. We review which can be shown to other people."><input type="file" accept="image/jpeg,image/png,image/webp" multiple required onChange={(e) => setPhotos([...e.target.files])} /></FormField>
      <FormField label="Describe the item" hint="Include details photos may not show."><textarea name="description" rows={3} maxLength={2000} placeholder="Found near the library entrance..." /></FormField>
      <FormField label="Private identifying detail *" hint="Only you and the claim review can see this.">
        <input name="secret_detail" required maxLength={500} placeholder="A mark, sticker, engraving, or item inside" />
      </FormField>
      <FormField label="Category"><select name="category">{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></FormField>
      <div className="field"><span>Where did you find it? *</span><CampusMap value={point} onChange={setPoint} /></div>
      <div className="form-grid"><FormField label="When"><input type="datetime-local" value={foundAt} onChange={(e) => setFoundAt(e.target.value)} required /></FormField><FormField label="Place note"><input name="location_note" maxLength={200} placeholder="Near the main entrance" /></FormField></div>
      <FormField label="Where is it now? *" hint="This stays private until a claim is approved."><input name="holding_location" required maxLength={200} placeholder="With me / Main library front desk" /></FormField>
      {error && <p className="error">{error}</p>}
      <button className="button primary" disabled={busy}>{busy ? 'Posting item…' : 'Post found item'} <Icon name="arrow" size={18} /></button>
    </form>
  </section>
}

function Detail({ selected, data, reportId, reload, goBack, busy, setBusy }) {
  const [answer, setAnswer] = useState('')
  const [message, setMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [manual, setManual] = useState(false)
  const [proof, setProof] = useState(null)
  const [localError, setLocalError] = useState('')
  if (!data) return <div className="content"><p>Loading…</p></div>
  const isReport = selected.kind === 'lost'
  const report = data.report
  const item = data.item || data
  const own = !isReport && data.secret_detail !== undefined
  async function sendClaim(event) {
    event.preventDefault()
    try {
      setBusy(true); setLocalError('')
      let body = { report_id: reportId, answer, manual }
      if (manual && proof) {
        body = new FormData()
        body.set('report_id', reportId)
        body.set('answer', answer)
        body.set('manual', 'true')
        body.set('proof', proof)
      }
      const result = await api('/found/' + item.id + '/claims/', { method: 'POST', body })
      setMessage(result.status === 'approved' ? 'Claim approved. Contact details are now available on your home screen.' : result.status === 'pending' ? 'Request sent to the finder for review.' : 'That answer did not verify the item. You can try again.')
      setSubmitted(result.status !== 'rejected')
      setAnswer(''); await reload()
    } catch (e) { setLocalError(e.message) } finally { setBusy(false) }
  }
  async function remove(kind, id) {
    if (!window.confirm('Delete this open post?')) return
    try { await api('/' + kind + '/' + id + '/', { method: 'DELETE' }); await reload(); goBack() }
    catch (e) { setLocalError(e.message) }
  }
  return <section className="content narrow">
    <button className="back-link" onClick={goBack}>← Back to home</button>
    {isReport ? <>
      <div className="page-heading"><span className="eyebrow">LOST REPORT #{report.id}</span><h1>{report.category}</h1><p>{report.description}</p></div>
      <div className="detail-meta"><span className={'status ' + report.status}>{report.status}</span><span>{formatDate(report.lost_after)} – {formatDate(report.lost_before)}</span></div>
      <ImageStrip photos={report.photos} />
      {report.status === 'open' && <button className="text-button danger" onClick={() => remove('lost', report.id)}>Delete report</button>}
      <div className="section-heading"><div><span className="eyebrow">DEPARTURES BOARD</span><h2>Possible matches</h2></div><span className="count">{data.matches.length}</span></div>
      {data.matches.length ? <div className="list">{data.matches.map((match) => <button key={match.item.id} className="match-card" onClick={() => selected.openItem('found', match.item.id, report.id)}>
        <div><span className={'match-label ' + (match.confidence === 'Strong match' ? 'strong' : '')}>{match.confidence}</span><h3>{match.item.category}</h3><p>{match.item.public_description}</p><small>Found {formatDate(match.item.found_at)} · about {match.distance_m} m away</small></div><Icon name="arrow" size={18} />
      </button>)}</div> : <div className="empty-state"><Icon name="search" size={32} /><h3>No matches yet</h3><p>Your report stays open. A strong new match will appear in your notifications.</p></div>}
    </> : <>
      <div className="page-heading"><span className="eyebrow">FOUND ITEM #{item.id}</span><h1>{item.category}</h1><p>{item.public_description}</p></div>
      <div className="detail-meta"><span className={'status ' + item.status}>{item.status}</span><span>Found {formatDate(item.found_at)}</span></div>
      <ImageStrip photos={item.photos} />
      <div className="info-card"><div><Icon name="pin" size={19} /><strong>Found near</strong></div><p>{item.location_note || 'the pinned campus location'}</p><small>{item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}</small></div>
      {own ? <div className="private-card"><span className="eyebrow">ONLY YOU CAN SEE THIS</span><h3>Private claim detail</h3><p>{item.secret_detail}</p><small>{item.ai_review === 'gemini' ? 'Reviewed with Gemini' : 'Basic review · photos remain private until AI review is available'}</small><p>Currently: {item.holding_location}</p></div> : item.status === 'open' && reportId ? <div className="claim-card"><span className="eyebrow">THINK IT'S YOURS?</span><h2>Claim this item</h2><p>{item.claim_question}</p>
        {submitted ? <p className="success">{message}</p> :
        <form onSubmit={sendClaim}><textarea value={answer} onChange={(e) => setAnswer(e.target.value)} required minLength={3} placeholder={manual ? 'Explain why it is yours and what proof you have…' : 'Describe the detail in your own words…'} rows={3} />
          <label className="checkbox"><input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} /> Manual request after two failed answers</label>
          {manual && <label className="field"><span>Proof photo (optional)</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setProof(e.target.files[0] || null)} /></label>}
          {localError && <p className="error">{localError}</p>}{message && <p className="success">{message}</p>}
          <button className="button primary" disabled={busy}>{busy ? 'Checking…' : 'Submit claim'} <Icon name="arrow" size={18} /></button></form>}
      </div> : null}
      {own && item.status === 'open' && <button className="text-button danger" onClick={() => remove('found', item.id)}>Delete item</button>}
      {item.status === 'handoff' && <button className="button primary" onClick={async () => { await api('/found/' + item.id + '/return/', { method: 'POST' }); reload(); goBack() }}>Mark as returned <Icon name="check" size={18} /></button>}
    </>}
  </section>
}

export default function App() {
  const [user, setUser] = useState(null)
  const [dashboard, setDashboard] = useState({ lost: [], found: [], claims: [], notifications: [] })
  const [view, setView] = useState('home')
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [reportId, setReportId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  async function reload() { setDashboard(await api('/dashboard/')) }
  useEffect(() => { api('/session/').then(async (session) => { setUser(session.user); if (session.user) await reload() }).catch((e) => setMessage(e.message)).finally(() => setLoading(false)) }, [])
  async function signIn(values) {
    try { setBusy(true); setMessage(''); const result = await api('/login/', { method: 'POST', body: values }); setUser(result.user); await reload() }
    catch (e) { setMessage(e.message) } finally { setBusy(false) }
  }
  async function signUp(values) {
    try {
      setBusy(true)
      setMessage('')
      const result = await api('/signup/', { method: 'POST', body: values })
      setUser(result.user)
      await reload()
    } catch (e) {
      setMessage(e.message)
    } finally {
      setBusy(false)
    }
  }
  async function submit(form, kind) {
    setBusy(true)
    try {
      const result = await api('/' + kind + '/', { method: 'POST', body: form })
      await reload()
      await openDetail(kind, result.id)
    } finally { setBusy(false) }
  }
  async function openDetail(kind, id, fromReport = null) {
    setReportId(fromReport)
    setSelected({ kind, id, openItem: openDetail })
    setDetail(null); setView('detail')
    try {
      const result = await api('/' + kind + '/' + id + '/')
      setDetail(result)
    } catch (e) { setMessage(e.message); setView('home') }
  }
  function home() { setView('home'); setSelected(null); setDetail(null); reload() }
  if (loading) return <div className="loading">ClaimCheck <span>●</span></div>
if (!user) {
  return (
    <SignIn
      onSignIn={signIn}
      onSignUp={signUp}
      busy={busy}
      message={message}
        onClearMessage={() => setMessage('')}
    />
  )
}
  const unread = dashboard.notifications.filter((n) => !n.read).length
  return <div className="app-shell">
    <header className="topbar"><div className="topbar-inner"><button className="brand" onClick={home}><span className="brand-mark"><Icon name="box" size={23} /></span><span>ClaimCheck</span></button>
      <nav><button className={view === 'home' ? 'active' : ''} onClick={home}>Home</button><button className={view === 'notifications' ? 'active' : ''} onClick={() => setView('notifications')}><Icon name="bell" size={18} /><span className="nav-label">Inbox</span>{unread > 0 && <i>{unread}</i>}</button><button className={view === 'profile' ? 'active' : ''} onClick={() => setView('profile')}><Icon name="user" size={18} /><span className="nav-label">{user.name}</span></button></nav></div></header>
    {message && <div className="global-error" role="alert">{message}<button onClick={() => setMessage('')}>×</button></div>}
    {view === 'home' && <main className="content">
      <section className="hero"><div className="hero-copy"><span className="eyebrow">STONY BROOK · LOST & FOUND</span><h1>Find your way<br /><em>back together.</em></h1><p>A simpler way to reunite people with the things they’ve lost around campus.</p></div><div className="hero-decoration"><div className="hero-ring" /><span><Icon name="pin" size={52} /></span></div></section>
      <div className="action-grid"><button className="action-card lost-action" onClick={() => setView('lost-form')}><span className="action-icon"><Icon name="search" size={28} /></span><span><strong>I lost something</strong><small>Create a report and see your matches</small></span><Icon name="arrow" size={20} /></button><button className="action-card found-action" onClick={() => setView('found-form')}><span className="action-icon"><Icon name="box" size={28} /></span><span><strong>I found something</strong><small>Help an item get home</small></span><Icon name="arrow" size={20} /></button></div>
      <div className="home-grid"><section><div className="section-heading"><div><span className="eyebrow">YOUR ACTIVITY</span><h2>Open reports</h2></div></div><div className="list">{dashboard.lost.length || dashboard.found.length ? <>
        {dashboard.lost.map((r) => <button key={'l' + r.id} className="list-card" onClick={() => openDetail('lost', r.id)}><span className="mini-icon blue"><Icon name="search" size={19} /></span><span><strong>{r.category}</strong><small>Lost · {r.status} · {formatDate(r.created_at)}</small></span><Icon name="arrow" size={18} /></button>)}
        {dashboard.found.map((i) => <button key={'f' + i.id} className="list-card" onClick={() => openDetail('found', i.id)}><span className="mini-icon gold"><Icon name="box" size={19} /></span><span><strong>{i.category}</strong><small>Found · {i.status} · {formatDate(i.found_at)}</small></span><Icon name="arrow" size={18} /></button>)}
      </> : <div className="empty-inline">Your reports will show up here.</div>}</div></section>
      <section><div className="section-heading"><div><span className="eyebrow">STAY IN THE LOOP</span><h2>Inbox</h2></div><button className="text-button" onClick={() => setView('notifications')}>View all →</button></div><div className="list">{dashboard.notifications.length ? dashboard.notifications.slice(0, 3).map((n) => <div className="notice-card" key={n.id}><span className="notice-dot" /><p>{n.message}</p></div>) : <div className="empty-inline">No updates yet. We’ll let you know when something happens.</div>}</div></section></div>
      {dashboard.claims.length > 0 && <section className="claims-section"><div className="section-heading"><div><span className="eyebrow">NEXT STEPS</span><h2>Claims & handoffs</h2></div></div><div className="list">{dashboard.claims.map((c) => <div className="claim-row" key={c.id}><div><strong>{c.item.category} · {c.status}</strong><small>{c.contact ? 'Connect with ' + c.contact.name + (c.contact.email ? ' · ' + c.contact.email : '') + (c.contact.phone ? ' · ' + c.contact.phone : '') : c.claimant ? 'Claim from ' + c.claimant.name : 'Waiting for a decision'}</small><p>{c.answer}</p>{c.proof_url && <a href={c.proof_url} target="_blank" rel="noreferrer">View proof photo</a>}</div><div className="claim-actions">{c.claimant && c.status === 'pending' && <><button onClick={async () => { await api('/claims/' + c.id + '/decision/', { method: 'POST', body: { approve: true } }); reload() }}>Approve</button><button onClick={async () => { await api('/claims/' + c.id + '/decision/', { method: 'POST', body: { approve: false } }); reload() }}>Reject</button></>}{c.status === 'approved' && c.item.status === 'handoff' && <button onClick={async () => { await api('/found/' + c.item_id + '/return/', { method: 'POST' }); reload() }}>Mark returned</button>}</div></div>)}</div></section>}
    </main>}
    {view === 'lost-form' && <LostForm submit={submit} busy={busy} goBack={home} />}
    {view === 'found-form' && <FoundForm submit={submit} busy={busy} goBack={home} />}
    {view === 'detail' && <Detail key={selected?.kind + selected?.id} selected={selected} data={detail} reportId={reportId} reload={reload} goBack={home} busy={busy} setBusy={setBusy} />}
    {view === 'notifications' && <main className="content narrow"><button className="back-link" onClick={home}>← Back to home</button><div className="page-heading"><span className="eyebrow">YOUR UPDATES</span><h1>Inbox</h1></div><button className="text-button" onClick={async () => { await api('/notifications/read/', { method: 'POST' }); reload() }}>Mark all read</button><div className="list">{dashboard.notifications.length ? dashboard.notifications.map((n) => <div className="notice-card" key={n.id}><span className={'notice-dot ' + (n.read ? 'muted' : '')} /><p>{n.message}</p></div>) : <div className="empty-state"><Icon name="bell" size={30} /><h3>All caught up</h3><p>New match and claim updates will land here.</p></div>}</div></main>}
    {view === 'profile' && <main className="content narrow"><button className="back-link" onClick={home}>← Back to home</button><div className="page-heading"><span className="eyebrow">ACCOUNT</span><h1>Your profile</h1><p>Contact details appear to the other person only after a claim is approved.</p></div><form className="form-card" onSubmit={async (e) => { e.preventDefault(); try { const result = await api('/profile/', { method: 'PATCH', body: { phone: e.currentTarget.phone.value } }); setUser(result); setMessage('Profile saved.') } catch (err) { setMessage(err.message) } }}><FormField label="Name"><input value={user.name} readOnly /></FormField><FormField label="Email"><input value={user.email} readOnly placeholder="Not provided" /></FormField><FormField label="Phone"><input name="phone" defaultValue={user.phone} type="tel" placeholder="Add a number for handoffs" /></FormField><button className="button primary">Save profile</button></form><button className="text-button sign-out" onClick={async () => { await api('/session/', { method: 'DELETE' }); setUser(null); setView('home') }}>Log out</button></main>}
    <footer className="footer">ClaimCheck · Made for the Stony Brook community <span>© OpenStreetMap contributors</span></footer>
  </div>
}
