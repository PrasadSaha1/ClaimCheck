import { useEffect, useMemo, useState } from 'react'
import CampusMap, { inside } from './CampusMap'
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
          VERIFIED LOST & FOUND
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
                <small>Must be an SBU email</small>
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


            {message && (
              <p className={message.startsWith("Check") ? "success" : "error"}>
                {message}
              </p>
            )}
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

function PhotoPicker({ label, hint, photos, setPhotos }) {
  // Each pick adds to the list instead of replacing it, so photos can be added one at a time.
  const previews = useMemo(() => photos.map((file) => URL.createObjectURL(file)), [photos])
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews])
  function add(event) {
    const files = [...event.target.files]
    event.target.value = ''
    setPhotos((current) => [...current, ...files])
  }
  return <div className="field"><span>{label}</span>
    {photos.length > 0 && <div className="photo-grid">{photos.map((file, i) => <div className="photo-thumb" key={file.name + i}>
      <img src={previews[i]} alt={'Photo ' + (i + 1)} />
      <button type="button" aria-label="Remove photo" onClick={() => setPhotos((current) => current.filter((_, j) => j !== i))}>×</button>
    </div>)}</div>}
    <label className="photo-add"><input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={add} />+ {photos.length ? 'Add more photos' : 'Add photos'}</label>
    {hint && <small>{hint}</small>}
  </div>
}

function FormField({ label, children, hint }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>
}

function usePhotoDraft(path, apply) {
  const [draft, setDraft] = useState('')
  async function run(files) {
    if (!files.length) return
    const body = new FormData()
    files.forEach((file) => body.append('photos', file))
    setDraft('loading')
    try {
      const result = await api(path, { method: 'POST', body })
      apply(result)
      setDraft(result.confidence === 'low' ? 'low' : 'done')
    } catch {
      setDraft('failed')
    }
  }
  return [draft, run]
}

function DraftControls({ draft, photos, run }) {
  if (!photos.length) return null
  return <>
    <button type="button" className="text-button draft-button" disabled={draft === 'loading'} onClick={() => run(photos)}>
      {draft === 'loading' ? 'Gemini is reading your photos…' : '✨ Describe with Gemini'}
    </button>
    {draft === 'done' && <p className="success">Drafted from your photos. Edit anything that's off.</p>}
    {draft === 'low' && <p className="error">The photos were hard to read. Please check and add details yourself.</p>}
    {draft === 'failed' && <p className="field-copy">Couldn't draft from these photos. Write the details yourself.</p>}
  </>
}

function LostForm({ site, submit, busy, goBack }) {
  const [point, setPoint] = useState(null)
  const [radius, setRadius] = useState(400)
  const [photos, setPhotos] = useState([])
  const [error, setError] = useState('')
  const [after, setAfter] = useState(() => localDate(Date.now() - 86400000))
  const [before, setBefore] = useState(() => localDate(Date.now()))
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [draft, runDraft] = usePhotoDraft('/lost/draft/', (result) => {
    setCategory(result.category)
    setDescription((current) => result.description || current)
  })
  async function onSubmit(event) {
    event.preventDefault()
    if (!point) { setError('Choose the area on the map.'); return }
    const form = new FormData(event.currentTarget)
    form.set('site', site.id)
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
      <PhotoPicker label="Old photos" hint="Optional. These are private to your report. Gemini can write your description from them." photos={photos} setPhotos={setPhotos} />
      <DraftControls draft={draft} photos={photos} run={runDraft} />
      <FormField label="What did you lose? *" hint="Include color, brand, markings, and anything distinctive.">
        <textarea name="description" rows={4} required maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A black water bottle with a yellow sticker..." />
      </FormField>
      <FormField label="Category"><select name="category" value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></FormField>
      <div className="field"><span>Where might it be? *</span><p className="field-copy">Tap the {site.short} map and adjust the rough search area.</p><CampusMap site={site} value={point} onChange={setPoint} radius={radius} />
        <div className="range-row"><span>Search radius</span><input type="range" min="50" max="1200" step="50" value={radius} onChange={(e) => setRadius(Number(e.target.value))} /><strong>{radius} m</strong></div>
      </div>
      <div className="form-grid"><FormField label="Lost after"><input type="datetime-local" value={after} onChange={(e) => setAfter(e.target.value)} required /></FormField><FormField label="Lost before"><input type="datetime-local" value={before} onChange={(e) => setBefore(e.target.value)} required /></FormField></div>
      {error && <p className="error">{error}</p>}
      <button className="button primary" disabled={busy || draft === 'loading'}>{busy ? 'Saving report…' : 'Create lost report'} <Icon name="arrow" size={18} /></button>
    </form>
  </section>
}

function FoundForm({ site, submit, busy, goBack }) {
  const [point, setPoint] = useState(null)
  const [photos, setPhotos] = useState([])
  const [error, setError] = useState('')
  const [foundAt, setFoundAt] = useState(() => localDate(Date.now()))
  const [description, setDescription] = useState('')
  const [secret, setSecret] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [draft, runDraft] = usePhotoDraft('/found/draft/', (result) => {
    setCategory(result.category)
    setDescription((current) => result.description || current)
    setSecret((current) => result.secret_detail || current)
    setSecretMissing(!result.secret_detail)
  })
  const [secretMissing, setSecretMissing] = useState(false)
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(({ coords }) => {
      const { latitude, longitude } = coords
      if (inside(site, latitude, longitude)) {
        setPoint((current) => current || { latitude: Number(latitude.toFixed(6)), longitude: Number(longitude.toFixed(6)) })
      }
    }, () => {}, { timeout: 8000 })
  }, [site])
  async function onSubmit(event) {
    event.preventDefault()
    if (!photos.length) { setError('Add at least one photo.'); return }
    if (!point) { setError('Pin where you found the item.'); return }
    const form = new FormData(event.currentTarget)
    form.set('site', site.id)
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
      <PhotoPicker label="Photos *" hint="Add as many clear photos as you like. Gemini can describe the item from them, and we review which can be shown to other people." photos={photos} setPhotos={setPhotos} />
      <DraftControls draft={draft} photos={photos} run={runDraft} />
      <FormField label="Describe the item" hint="Only you see this. We write a public version that leaves out the private detail."><textarea name="description" rows={3} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Found near the library entrance..." /></FormField>
      <FormField label="Private identifying detail *" hint="Only you and the claim review can see this.">
        <input name="secret_detail" required maxLength={500} value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="A mark, sticker, engraving, or item inside" />
      </FormField>
      {secretMissing && !secret && <p className="error">Gemini couldn't spot a private detail in the photos. Add one only the owner would know.</p>}
      <FormField label="Category"><select name="category" value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></FormField>
      <div className="field"><span>Where at {site.short} did you find it? *</span><CampusMap site={site} value={point} onChange={setPoint} /></div>
      <div className="form-grid"><FormField label="When"><input type="datetime-local" value={foundAt} onChange={(e) => setFoundAt(e.target.value)} required /></FormField><FormField label="Place note"><input name="location_note" maxLength={200} placeholder="Near the main entrance" /></FormField></div>
      <FormField label="Where is it now? *" hint="This stays private until a claim is approved."><input name="holding_location" required maxLength={200} list="desks" placeholder={'With me / ' + site.desks[0]} />
        <datalist id="desks"><option value="With me" />{site.desks.map((desk) => <option key={desk} value={desk} />)}</datalist></FormField>
      {error && <p className="error">{error}</p>}
      <button className="button primary" disabled={busy || draft === 'loading'}>{busy ? 'Posting item…' : 'Post found item'} <Icon name="arrow" size={18} /></button>
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
  const [question, setQuestion] = useState('')
  const [offerQuestion, setOfferQuestion] = useState(false)
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
      setMessage(result.status === 'approved' ? 'Claim approved. Contact details are now available on your home screen.' : result.status === 'pending' ? 'Request sent to the finder for review.' : result.attempts >= 2 ? 'That answer did not verify the item. You can send a manual request to the finder.' : 'That answer did not verify the item. You have one try left.')
      setOfferQuestion(result.status === 'rejected' && result.attempts === 1 && !question)
      setSubmitted(result.status !== 'rejected')
      setAnswer(''); await reload()
    } catch (e) { setLocalError(e.message) } finally { setBusy(false) }
  }
  async function newQuestion() {
    try {
      setBusy(true); setLocalError('')
      const result = await api('/found/' + item.id + '/question/', { method: 'POST' })
      setQuestion(result.claim_question)
      setMessage('Here is a different question. This is your last try.')
    } catch (e) { setLocalError(e.message) } finally { setBusy(false); setOfferQuestion(false) }
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
      <div className="info-card"><div><Icon name="pin" size={19} /><strong>Found near</strong></div><p>{item.location_note || 'the pinned location'}</p><small>{item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}</small></div>
      {own ? <div className="private-card"><span className="eyebrow">ONLY YOU CAN SEE THIS</span><h3>Private claim detail</h3><p>{item.secret_detail}</p><small>{item.ai_review === 'gemini' ? 'Reviewed with Gemini' : 'Basic review · photos remain private until AI review is available'}</small><p>Currently: {item.holding_location}</p></div> : item.status === 'open' && reportId ? <div className="claim-card"><span className="eyebrow">THINK IT'S YOURS?</span><h2>Claim this item</h2><p>{question || item.claim_question}</p>
        {submitted ? <p className="success">{message}</p> :
        <form onSubmit={sendClaim}><textarea value={answer} onChange={(e) => setAnswer(e.target.value)} required minLength={3} placeholder={manual ? 'Explain why it is yours and what proof you have…' : 'Describe the detail in your own words…'} rows={3} />
          <label className="checkbox"><input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} /> Manual request after two failed answers</label>
          {manual && <label className="field"><span>Proof photo (optional)</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setProof(e.target.files[0] || null)} /></label>}
          {localError && <p className="error">{localError}</p>}{message && <p className="success">{message}</p>}
          {offerQuestion && <div className="question-offer"><span>Would you like a different question?</span><div className="claim-actions"><button type="button" disabled={busy} onClick={newQuestion}>{busy ? 'Making one…' : 'Yes'}</button><button type="button" disabled={busy} onClick={() => setOfferQuestion(false)}>No, keep this one</button></div></div>}
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
  const [sites, setSites] = useState([])
  const [siteId, setSiteId] = useState(() => { try { return localStorage.getItem('site') } catch { return null } })
  const site = sites.find((s) => s.id === siteId) || sites[0]
  const siteName = (id) => sites.find((s) => s.id === id)?.short || ''
  function chooseSite(id) {
    setSiteId(id)
    try { localStorage.setItem('site', id) } catch { /* remembered for this visit only */ }
  }
  const [impact, setImpact] = useState(null)
  async function reload() {
    const [nextDashboard, nextImpact] = await Promise.all([api('/dashboard/'), api('/impact/')])
    setDashboard(nextDashboard); setImpact(nextImpact)
  }
  useEffect(() => { api('/session/').then(async (session) => { setSites([...session.sites].sort((a, b) => (b.id === session.default_site) - (a.id === session.default_site))); setUser(session.user); if (session.user) await reload() }).catch((e) => setMessage(e.message)).finally(() => setLoading(false)) }, [])
  async function signIn(values) {
    try { setBusy(true); setMessage(''); const result = await api('/login/', { method: 'POST', body: values }); setUser(result.user); await reload() }
    catch (e) { setMessage(e.message) } finally { setBusy(false) }
  }
async function signUp(values) {
  setBusy(true)
  setMessage("")

  try {
    const result = await api("/signup/", {
      method: "POST",
body: values,    })

    setMessage(result.message)
  } catch (err) {
    setMessage(err.message)
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
  async function clearClaims() {
    if (!window.confirm('Clear your claims? Rejected claims and returned items are removed from your list (the other person still sees them). Claims waiting on a decision or a handoff stay.')) return
    try {
      const result = await api('/claims/clear/', { method: 'POST' })
      await reload()
      if (result.kept) setMessage(result.kept + (result.kept === 1 ? ' claim still needs' : ' claims still need') + ' a decision or handoff, so ' + (result.kept === 1 ? 'it was' : 'they were') + ' kept.')
    } catch (e) { setMessage(e.message) }
  }
  async function clearReports() {
    if (!window.confirm('Clear all your reports? Open reports are deleted and returned ones are removed from this list. Items in a handoff stay until they are returned.')) return
    try {
      const result = await api('/reports/clear/', { method: 'POST' })
      await reload()
      if (result.kept) setMessage(result.kept + (result.kept === 1 ? ' report is' : ' reports are') + ' still in a handoff, so ' + (result.kept === 1 ? 'it was' : 'they were') + ' kept.')
    } catch (e) { setMessage(e.message) }
  }
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
      <section className="hero"><div className="hero-copy"><span className="eyebrow">{site ? site.short.toUpperCase() + ' · ' : ''}VERIFIED LOST & FOUND</span><h1>Find your way<br /><em>back together.</em></h1><p>One network for campuses, airports, and stations. Items only go back to people who can prove they own them.</p>
        {sites.length > 1 && <label className="site-picker"><span>Location</span><select value={site?.id} onChange={(e) => chooseSite(e.target.value)}>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}</div><div className="hero-decoration"><div className="hero-ring" /><span><Icon name="pin" size={52} /></span></div></section>
      <div className="action-grid"><button className="action-card lost-action" onClick={() => setView('lost-form')}><span className="action-icon"><Icon name="search" size={28} /></span><span><strong>I lost something</strong><small>Create a report and see your matches</small></span><Icon name="arrow" size={20} /></button><button className="action-card found-action" onClick={() => setView('found-form')}><span className="action-icon"><Icon name="box" size={28} /></span><span><strong>I found something</strong><small>Help an item get home</small></span><Icon name="arrow" size={20} /></button></div>
      {impact && site && <section className="impact"><div className="section-heading"><div><span className="eyebrow">IMPACT AT {site.short.toUpperCase()}</span><h2>What ClaimCheck has done</h2></div></div>
        <div className="impact-grid">{[['returned', 'Items returned to owners'], ['donated', 'Unclaimed items donated'], ['blocked', 'Wrong claims stopped']].map(([key, label]) => <div className="impact-tile" key={key}><strong>{impact.sites[site.id]?.[key] ?? 0}</strong><span>{label}</span></div>)}</div>
        <small className="impact-network">Across the network: {impact.network.returned} returned · {impact.network.donated} donated · {impact.network.blocked} wrong claims stopped</small></section>}
      <div className="home-grid"><section><div className="section-heading"><div><span className="eyebrow">YOUR ACTIVITY</span><h2>Open reports</h2></div>{(dashboard.lost.length > 0 || dashboard.found.length > 0) && <button className="text-button danger clear-all" onClick={clearReports}>Clear all</button>}</div><div className="list">{dashboard.lost.length || dashboard.found.length ? <>
        {dashboard.lost.map((r) => <button key={'l' + r.id} className="list-card" onClick={() => openDetail('lost', r.id)}><span className="mini-icon blue"><Icon name="search" size={19} /></span><span><strong>{r.category}</strong><small>Lost · {siteName(r.site)} · {r.status} · {formatDate(r.created_at)}</small></span><Icon name="arrow" size={18} /></button>)}
        {dashboard.found.map((i) => <button key={'f' + i.id} className="list-card" onClick={() => openDetail('found', i.id)}><span className="mini-icon gold"><Icon name="box" size={19} /></span><span><strong>{i.category}</strong><small>Found · {siteName(i.site)} · {i.status} · {formatDate(i.found_at)}</small></span><Icon name="arrow" size={18} /></button>)}
      </> : <div className="empty-inline">Your reports will show up here.</div>}</div></section>
      <section><div className="section-heading"><div><span className="eyebrow">STAY IN THE LOOP</span><h2>Inbox</h2></div><button className="text-button" onClick={() => setView('notifications')}>View all →</button></div><div className="list">{dashboard.notifications.length ? dashboard.notifications.slice(0, 3).map((n) => <div className="notice-card" key={n.id}><span className="notice-dot" /><p>{n.message}</p></div>) : <div className="empty-inline">No updates yet. We’ll let you know when something happens.</div>}</div></section></div>
      {dashboard.claims.length > 0 && <section className="claims-section"><div className="section-heading"><div><span className="eyebrow">NEXT STEPS</span><h2>Claims & handoffs</h2></div><button className="text-button danger clear-all" onClick={clearClaims}>Clear all</button></div><div className="list">{dashboard.claims.map((c) => <div className="claim-row" key={c.id}><div><strong>{c.item.category} · {c.status}</strong><small>{c.contact ? 'Connect with ' + c.contact.name + (c.contact.email ? ' · ' + c.contact.email : '') + (c.contact.phone ? ' · ' + c.contact.phone : '') : c.claimant ? 'Claim from ' + c.claimant.name : 'Waiting for a decision'}</small><p>{c.answer}</p>{c.alt_question && <small>They asked for a new question: {c.alt_question.question} Expected: {c.alt_question.secret_detail}</small>}{c.proof_url && <a href={c.proof_url} target="_blank" rel="noreferrer">View proof photo</a>}</div><div className="claim-actions">{c.claimant && c.status === 'pending' && <><button onClick={async () => { await api('/claims/' + c.id + '/decision/', { method: 'POST', body: { approve: true } }); reload() }}>Approve</button><button onClick={async () => { await api('/claims/' + c.id + '/decision/', { method: 'POST', body: { approve: false } }); reload() }}>Reject</button></>}{c.status === 'approved' && c.item.status === 'handoff' && <button onClick={async () => { await api('/found/' + c.item_id + '/return/', { method: 'POST' }); reload() }}>Mark returned</button>}</div></div>)}</div></section>}
    </main>}
    {view === 'lost-form' && site && <LostForm site={site} submit={submit} busy={busy} goBack={home} />}
    {view === 'found-form' && site && <FoundForm site={site} submit={submit} busy={busy} goBack={home} />}
    {view === 'detail' && <Detail key={selected?.kind + selected?.id} selected={selected} data={detail} reportId={reportId} reload={reload} goBack={home} busy={busy} setBusy={setBusy} />}
    {view === 'notifications' && <main className="content narrow"><button className="back-link" onClick={home}>← Back to home</button><div className="page-heading"><span className="eyebrow">YOUR UPDATES</span><h1>Inbox</h1></div><div className="inbox-actions"><button className="text-button" onClick={async () => { await api('/notifications/read/', { method: 'POST' }); reload() }}>Mark all read</button>{dashboard.notifications.length > 0 && <button className="text-button danger clear-all" onClick={async () => { if (!window.confirm('Clear all notifications from your inbox?')) return; await api('/notifications/clear/', { method: 'POST' }); reload() }}>Clear all</button>}</div><div className="list">{dashboard.notifications.length ? dashboard.notifications.map((n) => <div className="notice-card" key={n.id}><span className={'notice-dot ' + (n.read ? 'muted' : '')} /><p>{n.message}</p></div>) : <div className="empty-state"><Icon name="bell" size={30} /><h3>All caught up</h3><p>New match and claim updates will land here.</p></div>}</div></main>}
    {view === 'profile' && <main className="content narrow"><button className="back-link" onClick={home}>← Back to home</button><div className="page-heading"><span className="eyebrow">ACCOUNT</span><h1>Your profile</h1><p>Contact details appear to the other person only after a claim is approved.</p></div><form className="form-card" onSubmit={async (e) => { e.preventDefault(); try { const result = await api('/profile/', { method: 'PATCH', body: { phone: e.currentTarget.phone.value } }); setUser(result); setMessage('Profile saved.') } catch (err) { setMessage(err.message) } }}><FormField label="Name"><input value={user.name} readOnly /></FormField><FormField label="Email"><input value={user.email} readOnly placeholder="Not provided" /></FormField><FormField label="Phone"><input name="phone" defaultValue={user.phone} type="tel" placeholder="Add a number for handoffs" /></FormField><button className="button primary">Save profile</button></form><button className="text-button sign-out" onClick={async () => { await api('/session/', { method: 'DELETE' }); setUser(null); setView('home') }}>Log out</button></main>}
    <footer className="footer">ClaimCheck · Verified returns for campuses, airports, and stations <span>© OpenStreetMap contributors</span></footer>
  </div>
}
