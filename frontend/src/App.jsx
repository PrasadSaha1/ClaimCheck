import { useEffect, useId, useMemo, useState } from 'react'
import CampusMap, { inside } from './CampusMap'
import { api } from './api'
import './App.css'

const CATEGORIES = ['Electronics', 'Wallet & keys', 'Clothing', 'Books', 'Other']
const MAX_PHOTOS = 5
const NOOP = () => {}
const TABS = ['home', 'inbox', 'profile']

const localDate = (date) => {
  const d = new Date(date)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString()
function dayLabel(date) {
  const d = new Date(date)
  if (sameDay(d, Date.now())) return 'Today'
  if (sameDay(d, Date.now() - 86400000)) return 'Yesterday'
  if (Date.now() - d < 6 * 86400000) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}
const clock = (date) => new Date(date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/:00(?=\s)/, '')
const whenLabel = (date) => dayLabel(date) + ', ' + clock(date)
const rangeLabel = (a, b) => sameDay(a, b) ? `${dayLabel(a)}, ${clock(a)} – ${clock(b)}` : `${whenLabel(a)} – ${whenLabel(b)}`
function timeAgo(date) {
  const minutes = Math.round((Date.now() - new Date(date)) / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return minutes + 'm ago'
  if (minutes < 1440) return Math.round(minutes / 60) + 'h ago'
  return new Date(date).toLocaleDateString([], { month: 'short', day: 'numeric' })
}
const stampDate = (date = Date.now()) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).replace(',', '').toUpperCase()
const foundCode = (id) => 'F-' + String(id).padStart(4, '0')
const initials = (name = '') => name.slice(0, 2).toUpperCase()

// Adds the dashes while someone types, so "6315550142" shows as "631-555-0142". A dash only appears once a digit
// follows it, so backspacing never gets stuck on one.
function formatPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length < 4) return digits
  if (digits.length < 7) return digits.slice(0, 3) + '-' + digits.slice(3)
  return digits.slice(0, 3) + '-' + digits.slice(3, 6) + '-' + digits.slice(6)
}

// Public descriptions are one or two sentences; the first sentence reads as the item's name (CSS clamps it to two lines).
function splitTitle(text = '') {
  const [first = ''] = text.split(/(?<=[.!?])\s+/)
  return [first.replace(/[.!?]$/, ''), text.slice(first.length).trim()]
}

const BOARD_SKIP = new Set(['A', 'AN', 'THE', 'BLACK', 'WHITE', 'GRAY', 'GREY', 'BLUE', 'RED', 'GREEN', 'PINK', 'PURPLE', 'ORANGE', 'YELLOW', 'BROWN', 'SILVER', 'GOLD', 'LIGHT', 'DARK', 'SMALL', 'LARGE', 'BIG'])
const BOARD_STOP = /\s(?:WITH|AND|IN|ON|THAT|FROM|NEAR|OF)\s|,/

// The item's name for the 12 split-flap tiles: drop leading colors, cut at "with", keep the last words that fit.
// "Black Hydro Flask with a straw lid" -> "HYDRO FLASK"; "Grey Lenovo laptop" -> "LAPTOP".
function boardWord(title) {
  const words = title.toUpperCase().split(BOARD_STOP)[0].replace(/[^A-Z0-9 ]/g, '').split(' ').filter(Boolean)
  while (words.length > 1 && BOARD_SKIP.has(words[0])) words.shift()
  let word = ''
  for (const part of words.reverse()) {
    const next = word ? part + ' ' + word : part
    if (next.length > 12) break
    word = next
  }
  return word || words[0]?.slice(0, 12) || 'FOUND ITEM'
}

function noticeKind(message) {
  if (/strong match/i.test(message)) return 'New strong match'
  if (/needs your decision/i.test(message)) return 'Needs your decision'
  if (/claim passed/i.test(message)) return 'Claim passed'
  if (/was approved/i.test(message)) return 'Claim approved'
  if (/was rejected/i.test(message)) return 'Claim rejected'
  if (/is live|is posted/i.test(message)) return 'Posted'
  if (/donation/i.test(message)) return 'Donated'
  if (/returned/i.test(message)) return 'Returned'
  return 'Update'
}

const FOUND_STATUS = { open: ['Available', 'green'], handoff: ['Handoff pending', 'gold'], returned: ['Returned', 'muted'], donated: ['Donated', 'muted'] }
const LOST_STATUS = { open: ['Open', 'green'], handoff: ['Handoff pending', 'gold'], returned: ['Returned', 'muted'] }
const CLAIM_STATUS = { pending: ['Pending', 'gold'], approved: ['Approved', 'green'], rejected: ['Rejected', 'muted'] }

function Icon({ name, size = 22 }) {
  const paths = {
    home: <path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z" />,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    back: <path d="m15 5-7 7 7 7" />,
    chevron: <path d="m9 5 7 7-7 7" />,
    down: <path d="m6 9 6 6 6-6" />,
    trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
    camera: <><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
    image: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 16 5-5 4 4 3-3 6 6" /><circle cx="15.5" cy="9.5" r="1.5" /></>,
    lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
    check: <path d="m4 12 5 5L20 6" />,
    eyeoff: <><path d="M3 3l18 18" /><path d="M10.6 6.1A9 9 0 0 1 12 6c6 0 9 6 9 6a15 15 0 0 1-3 3.7M6.5 7.6C4.2 9.2 3 12 3 12s3 6 9 6a8.6 8.6 0 0 0 4.3-1.1" /><path d="M9.9 10a3 3 0 0 0 4.1 4.1" /></>,
    retry: <><path d="M4 12a8 8 0 1 0 2.5-5.8" /><path d="M4 4v4h4" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    x: <path d="M6 6l12 12M18 6 6 18" />,
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    sparkle: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

// The ticket logo, same shapes as public/favicon.svg. Without the tile, the holes take the color of what's behind it.
function Logo({ size = 56, tile = true, punch = 'var(--green)' }) {
  const gold = useId()
  return <svg width={size} height={tile ? size : size * 0.6} viewBox={tile ? '0 0 100 100' : '9 24 84 50'} aria-hidden="true">
    <defs><linearGradient id={gold} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e4c793" /><stop offset="1" stopColor="#b08a52" /></linearGradient></defs>
    {tile && <rect width="100" height="100" rx="24" fill={punch} />}
    <g transform="rotate(-6 31 52)">
      <path d="M13 35H46L50 40L45 46L50 52L45 58L49 64L47 69H13Z" fill="#f2e8d6" />
      <circle cx="13" cy="52" r="5.5" fill={punch} /><rect x="22" y="44" width="15" height="3.6" fill={punch} /><rect x="23" y="53" width="11" height="3.6" fill={punch} />
    </g>
    <g transform="rotate(6 70 47)">
      <path d="M54 30H88V64H54L50 58L55 52L50 46L55 40L52 34Z" fill={`url(#${gold})`} />
      <circle cx="88" cy="47" r="5.5" fill={punch} /><circle cx="71" cy="46" r="5" fill={punch} />
    </g>
  </svg>
}

function useLoad(path) {
  const [state, setState] = useState({ data: null, error: '' })
  useEffect(() => {
    let live = true
    api(path).then((data) => live && setState({ data, error: '' })).catch((e) => live && setState({ data: null, error: e.message }))
    return () => { live = false }
  }, [path])
  return state
}

function Pill({ tone = 'green', children }) {
  return <span className={'pill ' + tone}>{children}</span>
}

function Photo({ src, label = 'photo' }) {
  // Photos uploaded from another computer can be missing; show the striped placeholder instead of a broken image.
  const [failed, setFailed] = useState(false)
  if (!src || failed) return <div className="placeholder"><span>{label}</span></div>
  return <img src={src} alt={label} onError={() => setFailed(true)} />
}

function Screen({ title, big, onBack, action, footer, tabbed, children }) {
  return <div className={'screen' + (tabbed ? ' tabbed' : '')}>
    {(title || onBack) && <header className={'screen-head' + (big ? ' big' : '')}>
      {onBack && <button type="button" className="round-button" onClick={onBack} aria-label="Back"><Icon name="back" /></button>}
      <h1>{title}</h1>{action}
    </header>}
    <div className="screen-body">{children}</div>
    {footer && <div className="screen-foot">{footer}</div>}
  </div>
}

function Loading({ title, back, error }) {
  return <Screen title={title} onBack={back}>{error ? <p className="notice error">{error}</p> : <p className="muted">Loading…</p>}</Screen>
}

function TabBar({ view, tab, unread }) {
  return <nav className="tabbar" aria-label="Main">{[['home', 'Home'], ['inbox', 'Inbox'], ['profile', 'Profile']].map(([name, label]) =>
    <button key={name} className={view === name ? 'on' : ''} aria-current={view === name ? 'page' : undefined} onClick={() => tab(name)}>
      <span className="tab-icon"><Icon name={name === 'inbox' ? 'bell' : name === 'profile' ? 'user' : 'home'} />{name === 'inbox' && unread > 0 && <i>{unread}</i>}</span>{label}
    </button>)}
  </nav>
}

function Section({ n, title, aside, children }) {
  return <section className="form-section"><div className="section-label"><h2><b>{n}</b>{title}</h2>{aside}</div>{children}</section>
}

function TagRow({ eyebrow, title, meta, note, noteTone, pill, onClick }) {
  const Element = onClick ? 'button' : 'div'
  return <Element className="tag-row" onClick={onClick}><div className="tag-row-inner">
    <span className="tag-row-hole" />
    <div className="tag-row-body"><span className="eyebrow">{eyebrow}</span><h3>{title}</h3>{meta && <p>{meta}</p>}{note && <strong className={noteTone}>{note}</strong>}</div>
    {pill}
  </div></Element>
}

function Carousel({ photos, label }) {
  const [index, setIndex] = useState(0)
  if (!photos.length) return <div className="carousel"><div className="slide"><Photo label={label} /></div></div>
  return <div className="carousel-wrap">
    <div className="carousel" onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
      {photos.map((p) => <div className="slide" key={p.id}><Photo src={p.url} label={label} /></div>)}
    </div>
    {photos.length > 1 && <><span className="counter">{index + 1} / {photos.length}</span><div className="dots">{photos.map((p, i) => <i key={p.id} className={i === index ? 'on' : ''} />)}</div></>}
  </div>
}

function PublicTag({ item, photos, pill, hiddenCount = 0, nearExtra, children }) {
  const [title, rest] = splitTitle(item.public_description)
  return <div className="tag-wrap"><article className="tag">
    <span className="tag-hole" />
    <div className="tag-top"><span className="eyebrow">FOUND · {item.category} · {foundCode(item.id)}</span>{pill}</div>
    <Carousel photos={photos} label={item.category.toLowerCase()} />
    {hiddenCount > 0 && <p className="hint-line"><Icon name="eyeoff" size={18} />{hiddenCount} photo{hiddenCount === 1 ? '' : 's'} kept private. {hiddenCount === 1 ? 'It' : 'They'} showed the hidden detail.</p>}
    <div><h2 className="tag-title">{title}</h2>{rest && <p>{rest}</p>}</div>
    <div className="facts">
      <div><span className="eyebrow">Found near</span><strong>{item.location_note || 'Pinned on the map'}</strong>{nearExtra}</div>
      <div><span className="eyebrow">When</span><strong>{whenLabel(item.found_at)}</strong></div>
    </div>
    {children}
  </article></div>
}

function ItemChip({ item, prefix, pill }) {
  const [title] = splitTitle(item.public_description)
  return <div className="item-chip"><div className="thumb"><Photo src={item.photos?.find((p) => p.public !== false)?.url} label="" /></div>
    <div><h3>{title}</h3>{pill || <p>{[prefix, item.location_note, foundCode(item.id)].filter(Boolean).join(' · ')}</p>}</div></div>
}

function Attempts({ left, boxed }) {
  return <p className={'attempts' + (boxed ? ' boxed' : '')}><span className="pips">{[0, 1].map((i) => <i key={i} className={i < left ? 'on' : ''} />)}</span>{left} attempt{left === 1 ? '' : 's'} {left === 2 ? 'remaining' : 'left'}</p>
}

function Contact({ person = {} }) {
  return <div className="contact"><strong>{person.name}</strong>
    {person.email && <a href={'mailto:' + person.email}>{person.email}</a>}
    <span>{person.phone ? <a className="plain" href={'tel:' + person.phone}>{person.phone}</a> : 'No phone added'}</span></div>
}

function Fact({ label, children }) {
  return <div className="fact"><span className="eyebrow">{label}</span>{children}</div>
}

function ConfirmDelete({ what, title, onCancel, onConfirm, busy }) {
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-title"><div className="modal">
    <span className="modal-icon"><Icon name="trash" /></span>
    <h2 id="delete-title">Delete this {what}?</h2>
    <p>{title} and its matches will be removed. This can’t be undone.</p>
    <p className="modal-note"><Icon name="info" size={18} />Only open posts can be deleted. Posts can’t be deleted during a handoff.</p>
    <div className="modal-actions"><button className="btn outline" onClick={onCancel}>Keep it</button><button className="btn red" disabled={busy} onClick={onConfirm}>Delete</button></div>
  </div></div>
}

function SignIn({ onSignIn, onSignUp, busy, message, onClearMessage }) {
  const [mode, setMode] = useState('login')
  const [values, setValues] = useState({ name: '', password: '', confirm_password: '', email: '', phone: '' })
  const set = (key) => (e) => setValues((current) => ({ ...current, [key]: e.target.value }))
  const signUp = mode === 'signup'
  function submit(event) {
    event.preventDefault()
    if (signUp) onSignUp(values)
    else onSignIn({ name: values.name, password: values.password })
  }
  return <form className="signin" onSubmit={submit}>
    <div className="signin-brand"><Logo size={150} tile={false} /><span className="eyebrow gold">Verified lost & found</span><h1>ClaimCheck</h1>
      <p>Good things find their way back. Report what you lost or found, and we'll help reconnect it.</p></div>
    <div className="segmented" role="tablist">{[['login', 'Log in'], ['signup', 'Sign up']].map(([key, label]) =>
      <button type="button" key={key} role="tab" aria-selected={mode === key} className={mode === key ? 'on' : ''} onClick={() => { setMode(key); onClearMessage() }}>{label}</button>)}</div>
    <div className="signin-fields">
      <label className="field"><span className="field-label">Username {signUp && <em>Required</em>}</span><input value={values.name} onChange={set('name')} required minLength={signUp ? 6 : undefined} maxLength={80} placeholder="e.g. alexrivera" autoComplete="username" />{signUp && <small>At least 6 characters.</small>}</label>
      <label className="field"><span className="field-label">Password {signUp && <em>Required</em>}</span><input type="password" value={values.password} onChange={set('password')} required minLength={signUp ? 8 : undefined} autoComplete={signUp ? 'new-password' : 'current-password'} />{signUp && <small>At least 8 characters.</small>}</label>
      {signUp && <>
        <label className="field"><span className="field-label">Confirm password <em>Required</em></span><input type="password" value={values.confirm_password} onChange={set('confirm_password')} required minLength={8} autoComplete="new-password" /></label>
        <label className="field"><span className="field-label">Email <em>Required</em></span><input type="email" value={values.email} onChange={set('email')} required placeholder="you@stonybrook.edu" autoComplete="email" /><small>We'll send a link to verify it.</small></label>
        <label className="field"><span className="field-label">Phone number <em>Required</em></span><input type="tel" inputMode="numeric" value={values.phone} onChange={(e) => setValues((current) => ({ ...current, phone: formatPhone(e.target.value) }))} required pattern="[0-9]{3}-[0-9]{3}-[0-9]{4}" maxLength={12} placeholder="123-456-7890" autoComplete="tel" title="10-digit phone number" /></label>
      </>}
      {message && <p className={'notice ' + (message.startsWith('Check') || message.startsWith('Email verified') ? 'success' : 'error')}>{message}</p>}
    </div>
    <div className="signin-foot"><button className="btn gold" disabled={busy}>{busy ? 'Please wait…' : signUp ? 'Create account' : 'Log in'}</button><p>Made for campuses, airports, and stations.</p></div>
  </form>
}

function PhotoPicker({ photos, setPhotos, max = MAX_PHOTOS, icon = 'camera' }) {
  // Each pick adds to the list instead of replacing it, so photos can be added one at a time.
  const previews = useMemo(() => photos.map((file) => URL.createObjectURL(file)), [photos])
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews])
  function add(event) {
    const files = [...event.target.files]
    event.target.value = ''
    setPhotos((current) => [...current, ...files].slice(0, max))
  }
  return <div className="photo-grid">
    {photos.map((file, i) => <div className="photo-thumb" key={file.name + i}>
      <img src={previews[i]} alt={'Photo ' + (i + 1)} />
      <button type="button" aria-label="Remove photo" onClick={() => setPhotos((current) => current.filter((_, j) => j !== i))}><Icon name="x" size={15} /></button>
    </div>)}
    {photos.length < max && <label className="photo-add"><input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple hidden onChange={add} /><Icon name={icon} /><span>Add photo</span></label>}
  </div>
}

function usePhotoDraft(path, apply) {
  const [draft, setDraft] = useState('')
  const [reason, setReason] = useState('')
  async function run(files) {
    if (!files.length) return
    const body = new FormData()
    files.forEach((file) => body.append('photos', file))
    setDraft('loading')
    try {
      const result = await api(path, { method: 'POST', body })
      apply(result)
      setDraft(result.confidence === 'low' ? 'low' : 'done')
    } catch (e) {
      setDraft('failed')
      setReason(e.message)
    }
  }
  return [draft, run, reason]
}

function DraftControls({ draft, reason, photos, run }) {
  // Always shown so people know it exists; it only works once there is a photo to read.
  return <>
    <button type="button" className="draft-button" disabled={!photos.length || draft === 'loading'} onClick={() => run(photos)}>
      <Icon name="sparkle" size={17} />{draft === 'loading' ? 'Gemini is reading your photos…' : 'Describe with Gemini'}
    </button>
    {!photos.length && <p className="muted small">Add a photo and Gemini will write the description for you.</p>}
    {draft === 'done' && <p className="notice success">Drafted from your photos. Edit anything that's off.</p>}
    {draft === 'low' && <p className="notice info">The photos were hard to read. Please check and add details yourself.</p>}
    {draft === 'failed' && <p className="notice info">{reason || "Couldn't draft from these photos."} You can also write the details yourself.</p>}
  </>
}

function CategoryChips({ value, onChange }) {
  return <div className="chips">{CATEGORIES.map((c) => <button type="button" key={c} className={'chip' + (c === value ? ' on' : '')} aria-pressed={c === value} onClick={() => onChange(c)}>{c}</button>)}</div>
}

const REVIEW_STEPS = {
  found: ['Checking photos for private info', 'Writing the public description', 'Checking the private detail', 'Matching against lost reports'],
  lost: ['Reading your description', 'Reading your photos', 'Matching against found items', 'Comparing photos side by side'],
}

function Reviewing({ kind }) {
  // The server does all steps in one request, so the checklist advances on a timer and waits on the last step.
  const steps = REVIEW_STEPS[kind]
  const [done, setDone] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setDone((d) => Math.min(d + 1, steps.length - 1)), 1800)
    return () => clearInterval(timer)
  }, [steps.length])
  return <div className="reviewing" role="status">
    <span className="eyebrow gold">Inspection in progress</span>
    <h1>{kind === 'found' ? 'Reviewing your post' : 'Checking your report'}</h1>
    <p>This takes a few seconds.</p>
    <div className="slip"><div className="slip-head"><span>INSPECTION SLIP</span><span>{kind === 'found' ? 'FOUND' : 'LOST'} · NEW</span></div>
      <ol>{steps.map((step, i) => <li key={step} className={i < done ? 'done' : i === done ? 'current' : ''}><span className="tick">{i < done && <Icon name="check" size={15} />}</span>{step}</li>)}</ol></div>
    <div className="progress"><span style={{ width: ((done + 0.5) / steps.length) * 100 + '%' }} /></div>
  </div>
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
  const [draft, runDraft, draftReason] = usePhotoDraft('/lost/draft/', (result) => {
    setCategory(result.category)
    setDescription((current) => result.description || current)
  })
  async function onSubmit(event) {
    event.preventDefault()
    if (!point) { setError('Choose the area on the map.'); return }
    const form = new FormData(event.currentTarget)
    form.set('site', site.id)
    form.set('category', category)
    form.set('latitude', point.latitude)
    form.set('longitude', point.longitude)
    form.set('radius_m', radius)
    form.set('lost_after', new Date(after).toISOString())
    form.set('lost_before', new Date(before).toISOString())
    photos.forEach((file) => form.append('photos', file))
    try { setError(''); await submit(form, 'lost') } catch (e) { setError(e.message) }
  }
  return <form onSubmit={onSubmit}><Screen title="Report a lost item" onBack={goBack} footer={<button className="btn green" disabled={busy || draft === 'loading'}>Create lost report</button>}>
    <Section n="01" title="What did you lose?" aside={<span className="req">Required</span>}>
      <label className="field"><span className="sr-only">Description</span>
        <textarea name="description" rows={4} required maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Black 32 oz Hydro Flask with a straw lid and lots of stickers" />
        <small>Include color, brand, markings, and anything distinctive. Finders never see your report.</small></label>
    </Section>
    <Section n="02" title="Photos of the item" aside={<span className="opt">Optional</span>}>
      <PhotoPicker photos={photos} setPhotos={setPhotos} icon="image" />
      <p className="muted small">These stay private to your report. Gemini can write your description from them.</p>
      <DraftControls draft={draft} reason={draftReason} photos={photos} run={runDraft} />
    </Section>
    <Section n="03" title="Category"><CategoryChips value={category} onChange={setCategory} /></Section>
    <Section n="04" title="Where might it be?">
      <p className="muted small">Tap the {site.short} map to center your lost area, then set how far it could be.</p>
      <CampusMap site={site} value={point} onChange={setPoint} radius={radius} />
      <div className="range-row"><span>Search radius</span><input type="range" min="50" max="1200" step="50" value={radius} onChange={(e) => setRadius(Number(e.target.value))} aria-label="Search radius in meters" /><strong>{radius} m</strong></div>
    </Section>
    <Section n="05" title="When did you lose it?">
      <div className="form-grid">
        <label className="field"><span className="field-label">Lost after</span><input type="datetime-local" value={after} onChange={(e) => setAfter(e.target.value)} required /></label>
        <label className="field"><span className="field-label">Lost before</span><input type="datetime-local" value={before} onChange={(e) => setBefore(e.target.value)} required /></label>
      </div>
    </Section>
    {error && <p className="notice error">{error}</p>}
    {busy && <Reviewing kind="lost" />}
  </Screen></form>
}

function FoundForm({ site, submit, busy, goBack }) {
  const [point, setPoint] = useState(null)
  const [photos, setPhotos] = useState([])
  const [error, setError] = useState('')
  const [foundAt, setFoundAt] = useState(() => localDate(Date.now()))
  const [description, setDescription] = useState('')
  const [secret, setSecret] = useState('')
  const [holding, setHolding] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [secretMissing, setSecretMissing] = useState(false)
  const [draft, runDraft, draftReason] = usePhotoDraft('/found/draft/', (result) => {
    setCategory(result.category)
    setDescription((current) => result.description || current)
    setSecret((current) => result.secret_detail || current)
    setSecretMissing(!result.secret_detail)
  })
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
    form.set('category', category)
    form.set('latitude', point.latitude)
    form.set('longitude', point.longitude)
    form.set('found_at', new Date(foundAt).toISOString())
    photos.forEach((file) => form.append('photos', file))
    try { setError(''); await submit(form, 'found', secret) } catch (e) { setError(e.message) }
  }
  return <form onSubmit={onSubmit}><Screen title="Post a found item" onBack={goBack} footer={<button className="btn gold" disabled={busy || draft === 'loading'}>Post found item</button>}>
    <Section n="01" title="Photos" aside={<span className="opt">1 to {MAX_PHOTOS}</span>}>
      <PhotoPicker photos={photos} setPhotos={setPhotos} />
      <DraftControls draft={draft} reason={draftReason} photos={photos} run={runDraft} />
    </Section>
    <Section n="02" title="Description" aside={<span className="opt">Optional</span>}>
      <label className="field"><span className="sr-only">Description</span>
        <textarea name="description" rows={3} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Found on a table by the windows around lunch." />
        <small>Only you see this. We write a public version that leaves out the private detail.</small></label>
    </Section>
    <section className="private-card">
      <div className="private-head"><Icon name="lock" size={19} /><h3>Private identifying detail</h3><span>Required</span></div>
      <p>Something the real owner would remember, like a sticker, a keychain, a name written on it, or what's inside. Only you and the claim review can see it. If it's too general, the AI will choose a better one.</p>
      <input name="secret_detail" required maxLength={500} value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="A sticker, engraving, or item inside" aria-label="Private identifying detail" />
      {secretMissing && !secret && <p className="small gold">Gemini couldn't spot a private detail in the photos. Add one only the owner would know.</p>}
    </section>
    <Section n="03" title="Category"><CategoryChips value={category} onChange={setCategory} /></Section>
    <Section n="04" title={'Where at ' + site.short + '?'}>
      <CampusMap site={site} value={point} onChange={setPoint} />
      <label className="field"><span className="field-label">Place note <em className="opt">Optional</em></span><input name="location_note" maxLength={200} placeholder="Table by the windows, East Side Dining" /></label>
    </Section>
    <Section n="05" title="When">
      <label className="field"><span className="sr-only">When you found it</span><input type="datetime-local" value={foundAt} onChange={(e) => setFoundAt(e.target.value)} required /></label>
    </Section>
    <Section n="06" title="Where is it now?" aside={<span className="req">Required</span>}>
      <label className="field"><span className="sr-only">Where the item is now</span><input name="holding_location" required maxLength={200} value={holding} onChange={(e) => setHolding(e.target.value)} placeholder={'With me / ' + site.desks[0]} />
        <small>This stays private until a claim is approved.</small></label>
      <div className="chips">{['With me', ...site.desks].map((desk) => <button type="button" key={desk} className={'chip small' + (holding === desk ? ' on' : '')} onClick={() => setHolding(desk)}>{desk}</button>)}</div>
    </Section>
    {error && <p className="notice error">{error}</p>}
    {busy && <Reviewing kind="found" />}
  </Screen></form>
}

function Impact({ impact, site }) {
  const counts = impact.sites[site.id] || {}
  return <section className="impact">
    <div className="section-head"><h2>Impact</h2><span className="eyebrow">{site.short}</span></div>
    <div className="impact-grid">{[['returned', 'Returned to owners'], ['donated', 'Unclaimed, donated'], ['blocked', 'Wrong claims stopped']].map(([key, label]) =>
      <div className="impact-tile" key={key}><strong>{counts[key] ?? 0}</strong><span>{label}</span></div>)}</div>
    <small>Across the network: {impact.network.returned} returned · {impact.network.donated} donated · {impact.network.blocked} wrong claims stopped</small>
  </section>
}

function claimRow(c) {
  // Where each claim leads, from the point of view of the person looking at it.
  const mine = !c.claimant
  if (c.status === 'pending') return mine ? ['Waiting for the finder', '', 'waiting'] : ['A claim needs your decision', 'red', 'review']
  if (c.status === 'approved') return c.item.status === 'returned' ? ['Returned', '', 'returned'] : ['Handoff pending', '', 'handoff']
  return [mine ? "Your answer didn't match" : 'Wrong claim stopped', '', null]
}

function Home({ dashboard, impact, site, sites, chooseSite, go, tab, unread, clearReports, clearClaims }) {
  const siteName = (id) => sites.find((s) => s.id === id)?.short || ''
  const needsDecision = (itemId) => dashboard.claims.some((c) => c.claimant && c.item_id === itemId && c.status === 'pending')
  const hasReports = dashboard.lost.length + dashboard.found.length > 0
  // Earlier wrong answers stay on the review screen; the list shows only each person's latest claim per item.
  const seen = new Set()
  const claims = dashboard.claims.filter((c) => { const key = c.item_id + ':' + (c.claimant?.name || ''); return !seen.has(key) && seen.add(key) })
  return <div className="screen tabbed">
    <header className="home-head">
      <div className="lockup"><Logo size={54} /><div><span className="eyebrow">Lost property office</span><h1>ClaimCheck</h1></div></div>
      <button className="bell" onClick={() => tab('inbox')} aria-label={'Inbox' + (unread ? ', ' + unread + ' unread' : '')}><Icon name="bell" />{unread > 0 && <i>{unread}</i>}</button>
    </header>
    <div className="screen-body">
      {sites.length > 1 && <label className="place"><Icon name="pin" size={18} /><span className="sr-only">Location</span>
        <select value={site?.id} onChange={(e) => chooseSite(e.target.value)}>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select><Icon name="down" size={18} /></label>}
      <div className="actions">
        <button className="action green" onClick={() => go('lost-form')}><span className="eyebrow">Report</span><strong>I lost<br />something</strong></button>
        <button className="action gold" onClick={() => go('found-form')}><span className="eyebrow">Post</span><strong>I found<br />something</strong></button>
      </div>
      {hasReports ? <section>
        <div className="section-head"><h2>Open reports</h2><span className="eyebrow">Your activity</span></div>
        <div className="list">
          {dashboard.lost.map((r) => { const [label, tone] = LOST_STATUS[r.status] || [r.status, 'muted']; return <TagRow key={'l' + r.id} onClick={() => go('lost', { id: r.id })}
            eyebrow={`Lost · ${r.category} · #${r.id}`} title={splitTitle(r.description)[0]} meta={`${siteName(r.site)} · ${rangeLabel(r.lost_after, r.lost_before)}`} pill={<Pill tone={tone}>{label}</Pill>} /> })}
          {dashboard.found.map((i) => { const [label, tone] = FOUND_STATUS[i.status] || [i.status, 'muted']; return <TagRow key={'f' + i.id} onClick={() => go('found', { id: i.id })}
            eyebrow={`Found · ${i.category} · ${foundCode(i.id)}`} title={splitTitle(i.public_description)[0]} meta={`${i.location_note || siteName(i.site)} · ${whenLabel(i.found_at)}`}
            note={needsDecision(i.id) && 'A claim needs your decision'} noteTone="red" pill={<Pill tone={tone}>{label}</Pill>} /> })}
        </div>
        <button className="btn-text danger" onClick={clearReports}>Clear all reports</button>
      </section> : <div className="empty-rack"><div className="empty-tag"><span className="tag-hole" /><i /><i /></div><h3>Nothing on the rack yet</h3>
        <p>Lost something? File a report and we'll watch for matches. Found something? Post it and we'll help find the owner.</p></div>}
      {claims.length > 0 && <section>
        <div className="section-head"><h2>Claims & handoffs</h2><span className="eyebrow">Next steps</span></div>
        <div className="list">{claims.map((c) => {
          const [note, tone, target] = claimRow(c)
          const [label, pillTone] = CLAIM_STATUS[c.status] || [c.status, 'muted']
          return <TagRow key={'c' + c.id} onClick={target ? () => go(target, { claimId: c.id }) : undefined}
            eyebrow={`Claim · ${c.claimant ? 'on your post' : 'yours'} · ${foundCode(c.item_id)}`} title={splitTitle(c.item.public_description)[0]}
            meta={c.claimant ? 'From ' + c.claimant.name : null} note={note} noteTone={tone} pill={<Pill tone={pillTone}>{label}</Pill>} />
        })}</div>
        <button className="btn-text danger" onClick={clearClaims}>Clear finished claims</button>
      </section>}
      {impact && site && <Impact impact={impact} site={site} />}
      <section>
        <div className="section-head"><h2>Inbox</h2><button className="btn-text gold" onClick={() => tab('inbox')}>View all →</button></div>
        {dashboard.notifications.length ? <div className="list">{dashboard.notifications.slice(0, 2).map((n) => <Notice key={n.id} notice={n} />)}</div>
          : <p className="empty-inline">No updates yet. We'll let you know when something happens.</p>}
      </section>
    </div>
  </div>
}

function Notice({ notice }) {
  return <div className={'notice-card' + (notice.read ? ' read' : '')}><span className="notice-dot" /><div>
    <div className="notice-top"><span className="eyebrow">{noticeKind(notice.message)}</span><span>{timeAgo(notice.created_at)}</span></div>
    <p>{notice.message}</p></div></div>
}

function Inbox({ notifications, reload, setMessage }) {
  async function run(path, confirm) {
    if (confirm && !window.confirm(confirm)) return
    try { await api(path, { method: 'POST' }); await reload() } catch (e) { setMessage(e.message) }
  }
  return <Screen title="Inbox" big tabbed action={<button className="btn-text gold" onClick={() => run('/notifications/read/')}>Mark all read</button>}>
    {notifications.length ? <>
      <div className="list">{notifications.map((n) => <Notice key={n.id} notice={n} />)}</div>
      <button className="btn-text danger" onClick={() => run('/notifications/clear/', 'Clear all notifications from your inbox?')}>Clear all</button>
    </> : <div className="empty-rack"><span className="result-icon"><Icon name="bell" /></span><h3>All caught up</h3><p>New match and claim updates will land here.</p></div>}
  </Screen>
}

// The kinds match NOTIFICATION_KINDS in backend/api/views.py.
const NOTIFICATION_OPTIONS = [
  ['match', 'Strong matches', 'Someone found an item that looks like one you reported lost'],
  ['posted', 'Post confirmations', 'Your lost report or found item went live'],
  ['decision', 'Claims to review', 'Someone claims an item you found and needs your decision'],
  ['claim_passed', 'Claims that passed', 'Someone proved an item you found is theirs'],
  ['claim_result', 'Your claim results', 'Your claim was approved or rejected'],
  ['returned', 'Returns', 'An item in a handoff was marked as returned'],
  ['donated', 'Donations', 'An item you found went unclaimed for 30 days'],
]

function Profile({ user, setUser, setMessage, logout }) {
  const [phone, setPhone] = useState(formatPhone(user.phone || ''))
  const choices = user.notifications || {}
  async function save(event) {
    event.preventDefault()
    try { setUser(await api('/profile/', { method: 'PATCH', body: { phone } })); setMessage('Profile saved.') } catch (e) { setMessage(e.message) }
  }
  async function toggle(kind) {
    // Saves right away; the switch flips first so it feels instant, and flips back if saving fails.
    const next = { ...choices, [kind]: !choices[kind] }
    setUser({ ...user, notifications: next })
    try { setUser(await api('/profile/', { method: 'PATCH', body: { notifications: { [kind]: next[kind] } } })) }
    catch (e) { setUser(user); setMessage(e.message) }
  }
  return <form onSubmit={save}><Screen title="Profile" big tabbed>
    <div className="person"><span className="avatar">{initials(user.name)}</span><div><h2>{user.name}</h2><span className="verified"><Icon name="check" size={16} />Email verified</span></div></div>
    <label className="field"><span className="field-label">Email</span><input className="readonly" value={user.email} readOnly /></label>
    <label className="field"><span className="field-label">Phone number <em>Required</em></span><input type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} required pattern="[0-9]{3}-[0-9]{3}-[0-9]{4}" maxLength={12} placeholder="123-456-7890" autoComplete="tel" title="10-digit phone number" />
      <small>Only shared with the other person after a claim is approved.</small></label>
    <section className="settings" aria-labelledby="notify-title">
      <div className="section-head"><h2 id="notify-title">Notifications</h2><span className="eyebrow">Inbox alerts</span></div>
      <p className="muted small">Choose what lands in your inbox. Changes save right away.</p>
      <div className="setting-list">{NOTIFICATION_OPTIONS.map(([kind, label, detail]) =>
        <button type="button" key={kind} role="switch" aria-checked={choices[kind] !== false} className="setting" onClick={() => toggle(kind)}>
          <span><strong>{label}</strong><small>{detail}</small></span><span className="switch" aria-hidden="true"><i /></span>
        </button>)}</div>
    </section>
    <div className="profile-actions"><button className="btn green">Save profile</button><button type="button" className="btn outline" onClick={logout}>Log out</button></div>
  </Screen></form>
}

function LostDetail({ id, back, go, sites }) {
  const { data, error } = useLoad('/lost/' + id + '/')
  const [confirm, setConfirm] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  if (!data) return <Loading title="Lost report" back={back} error={error} />
  const { report, matches } = data
  const [title] = splitTitle(report.description)
  const [label, tone] = LOST_STATUS[report.status] || [report.status, 'muted']
  const site = sites.find((s) => s.id === report.site)
  async function remove() {
    try { await api('/lost/' + id + '/', { method: 'DELETE' }); back() } catch (e) { setConfirm(false); setDeleteError(e.message) }
  }
  return <Screen title="Lost report" onBack={back} action={report.status === 'open' && <button className="icon-button" aria-label="Delete report" onClick={() => setConfirm(true)}><Icon name="trash" /></button>}>
    <div className="stack"><span className="eyebrow">Lost report · #{report.id}</span><h2 className="report-title">{title}</h2>
      <p className="meta">{site ? site.short + ' · ' : ''}{rangeLabel(report.lost_after, report.lost_before)}</p><Pill tone={tone}>{label}</Pill></div>
    {report.photos.length > 0 && <div className="mini-photos">{report.photos.map((p) => <div className="thumb" key={p.id}><Photo src={p.url} label="" /></div>)}</div>}
    {deleteError && <p className="notice error">{deleteError}</p>}
    <section className="board" aria-label="Matching found items">
      <div className="board-head"><span>ARRIVALS · FOUND ITEMS</span><span>{new Date().toTimeString().slice(0, 5)}</span></div>
      <div className="flaps" aria-hidden="true">{(matches.length ? boardWord(title) : 'NO ARRIVALS').padEnd(12, ' ').split('').map((letter, i) => <span key={i}>{letter.trim()}</span>)}</div>
      <div className="board-head sub"><span>ITEM · FOUND NEAR · WHEN</span><span>{matches.length} OF 10</span></div>
      {matches.length ? matches.map((m) => {
        const [itemTitle, rest] = splitTitle(m.item.public_description)
        const strong = m.confidence === 'Strong match'
        return <button key={m.item.id} className="board-row" onClick={() => go('match', { id: m.item.id, reportId: report.id, confidence: m.confidence, distance: m.distance_m })}>
          <div className="thumb dark"><Photo src={m.item.photos[0]?.url} label={m.item.category.toLowerCase()} /></div>
          <div><h3>{itemTitle}</h3>{rest && <p>{rest}</p>}<Pill tone={strong ? 'board-strong' : 'board-possible'}>{m.confidence}</Pill>
            <small>Found {whenLabel(m.item.found_at)} · about {m.distance_m} m away</small></div>
          <Icon name="chevron" size={18} />
        </button>
      }) : <div className="board-empty"><span className="eyebrow gold">No arrivals yet</span><h3>Nothing has matched so far</h3>
        <p>{report.status === 'open' ? 'Your report stays open. A strong new match will appear in your inbox.' : 'This report is in a handoff or already returned. See Claims & handoffs on your home screen.'}</p></div>}
      <p className="board-foot">Strong matches first. Only you can see this list.</p>
    </section>
    {confirm && <ConfirmDelete what="lost report" title={title} onCancel={() => setConfirm(false)} onConfirm={remove} />}
  </Screen>
}

function OwnItem({ item, posted, typedSecret, back, home }) {
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState('')
  const publicPhotos = item.photos.filter((p) => p.public)
  const [label, tone] = FOUND_STATUS[item.status] || [item.status, 'muted']
  const heading = { open: 'Your post is live', handoff: 'Handoff in progress', returned: 'Back with its owner', donated: 'Marked for donation' }[item.status] || 'Your post'
  const replaced = typedSecret && typedSecret.trim().toLowerCase() !== item.secret_detail.trim().toLowerCase()
  async function remove() {
    try { await api('/found/' + item.id + '/', { method: 'DELETE' }); home() } catch (e) { setConfirm(false); setError(e.message) }
  }
  return <Screen onBack={posted ? null : back} footer={<>
    {item.status === 'open' && <button className="btn-text danger" onClick={() => setConfirm(true)}>Delete item</button>}
    <button className="btn green" onClick={home}>Done</button>
  </>}>
    <div className="stack"><span className="eyebrow dot">{posted ? 'Posted' : 'Your post'} · {foundCode(item.id)}</span><h1 className="title">{heading}</h1>
      <p className="lede">{item.status === 'donated' ? 'Nobody claimed it within 30 days, so it is marked for donation.' : "It's only shown to people whose lost reports match."}</p></div>
    <span className="eyebrow">Public tag · what owners see</span>
    <PublicTag item={item} photos={publicPhotos} hiddenCount={item.photos.length - publicPhotos.length} pill={<Pill tone={tone}>{label}</Pill>} />
    <section className="private-card">
      <div className="private-head"><Icon name="lock" size={18} /><h3>Private claim detail</h3><span>Only you</span></div>
      <p className="secret">{item.secret_detail}</p>
      <p className="small">Owners are asked: “{item.claim_question}”</p>
      {replaced && <p className="small gold">Gemini picked a clearer detail than the one you entered, so the real owner can answer from memory.</p>}
      {item.ai_review !== 'gemini' && <p className="small">Basic review. Photos stay private until AI review is available.</p>}
    </section>
    <div className="info-card"><span className="eyebrow">Where it is now</span><span>{item.holding_location}</span></div>
    {error && <p className="notice error">{error}</p>}
    {confirm && <ConfirmDelete what="found item" title={splitTitle(item.public_description)[0]} onCancel={() => setConfirm(false)} onConfirm={remove} />}
  </Screen>
}

function MatchView({ item, reportId, confidence, distance, back, go, sites, myClaims }) {
  const site = sites.find((s) => s.id === item.site)
  const strong = confidence === 'Strong match'
  const mine = myClaims.filter((c) => c.item_id === item.id)
  const approved = mine.find((c) => c.status === 'approved')
  const pending = mine.find((c) => c.status === 'pending')
  const point = useMemo(() => ({ latitude: item.latitude, longitude: item.longitude }), [item.latitude, item.longitude])
  const footer = approved ? <button className="btn green" onClick={() => go('approved', { claimId: approved.id })}>View your claim ticket</button>
    : pending ? <button className="btn green" onClick={() => go('waiting', { claimId: pending.id })}>View your claim</button>
    : item.status === 'open' && reportId ? <button className="btn gold" onClick={() => go('claim', { item, reportId })}>Claim this item</button> : null
  return <Screen title={confidence || 'Found item'} onBack={back} footer={footer}>
    <PublicTag item={item} photos={item.photos} pill={confidence && <Pill tone={strong ? 'solid' : 'outline'}>{confidence}</Pill>}
      nearExtra={distance != null && <small>About {distance} m from your lost area</small>}>
      {site && <div className="tag-map"><CampusMap site={site} value={point} onChange={NOOP} readOnly /></div>}
    </PublicTag>
  </Screen>
}

function ItemScreen({ id, ...rest }) {
  const { data: item, error } = useLoad('/found/' + id + '/')
  if (!item) return <Loading title="Found item" back={rest.back} error={error} />
  return item.secret_detail !== undefined ? <OwnItem item={item} {...rest} /> : <MatchView item={item} {...rest} />
}

function ClaimQuestion({ item, reportId, back, replace, reload, busy, setBusy }) {
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState('')
  async function submit(event) {
    event.preventDefault()
    try {
      setBusy(true); setError('')
      const result = await api('/found/' + item.id + '/claims/', { method: 'POST', body: { report_id: reportId, answer } })
      await reload()
      if (result.status === 'rejected') replace(result.attempts >= 2 ? 'locked' : 'wrong', { item, reportId })
      else replace(result.status === 'approved' ? 'approved' : 'waiting', { claimId: result.id })
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return <form onSubmit={submit}><Screen title="Verify it's yours" onBack={back} footer={<button className="btn green" disabled={busy}>{busy ? 'Checking…' : 'Submit claim'}</button>}>
    <ItemChip item={item} />
    <div className="question-card"><span className="eyebrow gold">Claim question</span><p>{item.claim_question}</p></div>
    <label className="field"><span className="field-label">Your answer</span>
      <textarea rows={4} required minLength={3} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Describe it in your own words" />
      <small>Spelling doesn't need to be perfect. The finder never sees your answer unless it goes to them for review.</small></label>
    <Attempts left={item.attemptsLeft} />
    {error && <p className="notice error">{error}</p>}
  </Screen></form>
}

function WrongAnswer({ item, reportId, replace, backToMatches, busy, setBusy }) {
  const [error, setError] = useState('')
  async function newQuestion() {
    try {
      setBusy(true); setError('')
      const result = await api('/found/' + item.id + '/question/', { method: 'POST' })
      replace('claim', { item: { ...item, claim_question: result.claim_question }, reportId })
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return <Screen footer={<>
    <button className="btn gold" onClick={() => replace('claim', { item, reportId })}>Try again</button>
    <button className="btn outline" disabled={busy} onClick={newQuestion}>{busy ? 'Making one…' : 'Ask me a different question'}</button>
    <button className="btn-text" onClick={backToMatches}>Back to matches</button>
  </>}>
    <div className="result"><span className="result-icon"><Icon name="retry" size={26} /></span><h1 className="title">That didn't match our record</h1>
      <p className="lede">Details are easy to misremember. Take a moment and try describing it a different way: color, shape, or what's written on it.</p>
      <Attempts left={1} boxed /></div>
    {error && <p className="notice error">{error}</p>}
  </Screen>
}

function Locked({ item, reportId, replace, backToMatches }) {
  const [title] = splitTitle(item.public_description)
  return <Screen footer={<>
    <button className="btn gold" onClick={() => replace('manual', { item, reportId })}>Send a claim request</button>
    <button className="btn outline" onClick={backToMatches}>Back to matches</button>
  </>}>
    <div className="result"><span className="result-icon dark"><Icon name="lock" size={24} /></span><h1 className="title">The question is locked for this item</h1>
      <p className="lede">You've used both attempts. If it's yours, you can still send a claim request. The finder will look at your explanation and decide.</p>
      <div className="box"><span className="eyebrow">Item</span><h3>{title}</h3><p>{[item.location_note, foundCode(item.id)].filter(Boolean).join(' · ')}</p></div></div>
  </Screen>
}

function ManualRequest({ item, reportId, back, replace, reload, busy, setBusy }) {
  const [answer, setAnswer] = useState('')
  const [proof, setProof] = useState([])
  const [error, setError] = useState('')
  async function submit(event) {
    event.preventDefault()
    const body = new FormData()
    body.set('report_id', reportId)
    body.set('answer', answer)
    body.set('manual', 'true')
    if (proof[0]) body.set('proof', proof[0])
    try {
      setBusy(true); setError('')
      const result = await api('/found/' + item.id + '/claims/', { method: 'POST', body })
      await reload()
      replace('waiting', { claimId: result.id })
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return <form onSubmit={submit}><Screen title="Claim request" onBack={back} footer={<button className="btn green" disabled={busy}>{busy ? 'Sending…' : 'Send to finder'}</button>}>
    <p className="lede">For <strong>{splitTitle(item.public_description)[0]}</strong>. The finder sees this request, but not your contact info unless they approve.</p>
    <label className="field"><span className="field-label">Why is this yours? <em>Required</em></span>
      <textarea rows={5} required minLength={3} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="When and where you last had it, what's on it, anything that shows it's yours." /></label>
    <div className="field"><span className="field-label">Proof photo <em className="opt">Optional</em></span>
      <PhotoPicker photos={proof} setPhotos={setProof} max={1} icon="plus" />
      <small>One photo: an old picture of the item, a receipt, or an order screenshot.</small></div>
    {error && <p className="notice error">{error}</p>}
  </Screen></form>
}

function Waiting({ claim, home }) {
  return <Screen footer={<button className="btn green" onClick={home}>Back to home</button>}>
    <div className="stack"><span className="eyebrow dot">Pending</span><h1 className="title">Waiting for the finder</h1></div>
    <div className="ticket"><div className="ticket-head dark"><span>CLAIM REQUEST</span><span>{foundCode(claim.item_id)}</span></div>
      <div className="ticket-body"><h3>{splitTitle(claim.item.public_description)[0]}</h3><span className="stamp pending">PENDING</span>
        <p>{claim.attempts >= 3 ? 'Your request was sent. The finder will compare it with the secret detail.' : "Gemini wasn't sure about your answer, so the finder will compare it with the secret detail."}</p></div></div>
    <ol className="steps"><li><b>01</b>Most finders respond within a day.</li><li><b>02</b>We'll notify you either way.</li><li><b>03</b>If approved, you'll both see each other's contact info.</li></ol>
  </Screen>
}

function Declined({ claim, home }) {
  return <Screen footer={<button className="btn green" onClick={home}>Back to home</button>}>
    <div className="result"><span className="result-icon"><Icon name="x" size={24} /></span><h1 className="title">This claim wasn't approved</h1>
      <p className="lede">The details didn't match what the finder has for {splitTitle(claim.item.public_description)[0]}. Your lost report stays open, so other matches can still find you.</p></div>
  </Screen>
}

function Approved({ claim, replace }) {
  const finder = claim.contact || {}
  return <Screen footer={<button className="btn gold" onClick={() => replace('handoff', { claimId: claim.id })}>Arrange the handoff</button>}>
    <div className="stack"><span className="eyebrow dot">Claim approved</span><h1 className="title">It's yours. Here's your ticket.</h1></div>
    <div className="ticket"><div className="ticket-head"><span>CLAIMCHECK · CLAIM TICKET</span><span>No. {String(claim.id).padStart(6, '0')}</span></div>
      <div className="ticket-body"><span className="stamp">CLAIMED<small>{stampDate()}</small></span>
        <Fact label="Item"><strong>{splitTitle(claim.item.public_description)[0]}</strong></Fact>
        <Fact label="Where it is now"><span>{claim.item.holding_location}</span><small>Ask for item {foundCode(claim.item_id)} and show your ID.</small></Fact>
        <Fact label="Finder"><Contact person={finder} /></Fact></div>
      <div className="ticket-stub"><span>ADMIT ONE ITEM<br />SHOW ID AT PICKUP</span><span>{foundCode(claim.item_id)}<br />{stampDate()}</span></div></div>
    <p className="lede small">{finder.name} can see your name, email, and phone too. These details are also on your home screen under Claims & handoffs.</p>
  </Screen>
}

function ReviewClaim({ claim, claims, back, replace, reload, home, busy, setBusy }) {
  const [error, setError] = useState('')
  const item = claim.item
  const manual = claim.attempts >= 3
  const earlier = claims.filter((c) => c.item_id === claim.item_id && c.id !== claim.id && c.status === 'rejected' && c.claimant?.name === claim.claimant.name).reverse()
  async function decide(approve) {
    try {
      setBusy(true); setError('')
      await api('/claims/' + claim.id + '/decision/', { method: 'POST', body: { approve } })
      await reload()
      if (approve) replace('connected', { claimId: claim.id })
      else home('Claim rejected. The owner was told.')
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return <Screen title="Review a claim" onBack={back} footer={<div className="split">
    <button className="btn outline" disabled={busy} onClick={() => decide(false)}>Reject</button>
    <button className="btn green" disabled={busy} onClick={() => decide(true)}>Approve</button>
  </div>}>
    <ItemChip item={item} prefix="Your post" />
    <div className="badges"><span className="badge gold">{manual ? 'Manual request' : "Gemini wasn't sure"}</span><span className="badge">From {claim.claimant.name} · verified email</span></div>
    <div className="label-gap"><span className="eyebrow">{manual ? 'Their explanation' : 'Their answer'}</span><blockquote className="quote">{claim.answer}</blockquote></div>
    {earlier.length > 0 && <div className="label-gap"><span className="eyebrow">Answers they gave before</span><ol className="answers">{earlier.map((c) => <li key={c.id}>“{c.answer}”</li>)}</ol></div>}
    {claim.proof_url && <div className="label-gap"><span className="eyebrow">Proof photo</span><a className="proof" href={claim.proof_url} target="_blank" rel="noreferrer"><Photo src={claim.proof_url} label="proof photo" /></a></div>}
    <section className="private-card"><div className="private-head"><Icon name="lock" size={16} /><span className="eyebrow gold">Your secret detail · for comparison</span></div>
      <p className="secret">{claim.alt_question ? claim.alt_question.secret_detail : item.secret_detail}</p>
      {claim.alt_question && <p className="small">They asked for a different question: “{claim.alt_question.question}”</p>}</section>
    {error && <p className="notice error">{error}</p>}
  </Screen>
}

function Connected({ claim, replace }) {
  const owner = claim.contact || {}
  return <Screen footer={<button className="btn green" onClick={() => replace('handoff', { claimId: claim.id })}>Go to handoff</button>}>
    <div className="stack"><span className="eyebrow dot">Claim approved · {foundCode(claim.item_id)}</span><h1 className="title">You're connected with the owner</h1>
      <p className="lede">Reach out to set a time and place for the handoff.</p></div>
    <div className="tag-wrap"><article className="tag"><span className="tag-hole" />
      <div className="person"><span className="avatar small">{initials(owner.name)}</span><div><span className="eyebrow">Owner</span><h3>{owner.name}</h3></div></div>
      <dl className="rows">
        <div><dt>Email</dt><dd><a href={'mailto:' + owner.email}>{owner.email}</a></dd></div>
        <div><dt>Phone</dt><dd>{owner.phone ? <a className="plain" href={'tel:' + owner.phone}>{owner.phone}</a> : 'Not added'}</dd></div>
        <div><dt>Item</dt><dd>{splitTitle(claim.item.public_description)[0]}</dd></div>
      </dl>
    </article></div>
  </Screen>
}

function Handoff({ claim, user, back, replace, reload, busy, setBusy }) {
  const [error, setError] = useState('')
  const mine = !claim.claimant
  const other = claim.contact || {}
  async function markReturned() {
    try {
      setBusy(true); setError('')
      await api('/found/' + claim.item_id + '/return/', { method: 'POST' })
      await reload()
      replace('returned', { claimId: claim.id })
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return <Screen title="Handoff" onBack={back} footer={<button className="btn green" disabled={busy} onClick={markReturned}>Mark as returned</button>}>
    <ItemChip item={claim.item} pill={<Pill tone="gold">Handoff pending</Pill>} />
    <div className="info-card"><span className="eyebrow">Where it is now</span><span>{claim.item.holding_location}</span></div>
    <div className="info-card"><span className="eyebrow">Owner {mine && <em>(you)</em>}</span><Contact person={mine ? user : other} /></div>
    <div className="info-card"><span className="eyebrow">Finder {!mine && <em>(you)</em>}</span><Contact person={mine ? other : user} /></div>
    <p className="muted">Either of you can mark it returned once it's back with the owner.</p>
    {error && <p className="notice error">{error}</p>}
  </Screen>
}

function Returned({ claim, site, home }) {
  return <Screen footer={<button className="btn green" onClick={home}>Back to home</button>}>
    <div className="stack"><span className="eyebrow dot">Journey complete</span><h1 className="title">Back where it belongs</h1></div>
    <div className="ticket"><div className="ticket-head"><span>CLAIMCHECK · CLAIM TICKET</span><span>{foundCode(claim.item_id)}</span></div>
      <div className="ticket-body"><span className="stamp green">RETURNED<small>{stampDate()}</small></span>
        <Fact label="Item"><strong>{splitTitle(claim.item.public_description)[0]}</strong></Fact><span className="eyebrow">Returned {stampDate()}</span></div></div>
    <p className="lede">Thanks for taking the time. Small favors like this make {site?.short || 'your community'} a better place.</p>
  </Screen>
}

export default function App() {
  const [user, setUser] = useState(null)
  const [dashboard, setDashboard] = useState({ lost: [], found: [], claims: [], notifications: [] })
  const [impact, setImpact] = useState(null)
  const [stack, setStack] = useState([{ name: 'home' }])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(() => new URLSearchParams(window.location.search).has('verified') ? 'Email verified. You can log in now.' : '')
  const [loading, setLoading] = useState(true)
  const [sites, setSites] = useState([])
  const [siteId, setSiteId] = useState(() => { try { return localStorage.getItem('site') } catch { return null } })
  const site = sites.find((s) => s.id === siteId) || sites[0]
  const view = stack[stack.length - 1]
  function chooseSite(id) {
    setSiteId(id)
    try { localStorage.setItem('site', id) } catch { /* remembered for this visit only */ }
  }
  async function reload() {
    const [nextDashboard, nextImpact] = await Promise.all([api('/dashboard/'), api('/impact/')])
    setDashboard(nextDashboard); setImpact(nextImpact)
  }
  const refresh = () => reload().catch((e) => setMessage(e.message))
  const go = (name, params = {}) => setStack((s) => [...s, { name, ...params }])
  const replace = (name, params = {}) => setStack((s) => [...s.slice(0, -1), { name, ...params }])
  const back = () => { setStack((s) => s.length > 1 ? s.slice(0, -1) : s); refresh() }
  const tab = (name) => { setStack([{ name }]); refresh() }
  const home = (note) => { tab('home'); if (typeof note === 'string') setMessage(note) }
  const backToMatches = () => { setStack((s) => { const i = s.map((v) => v.name).lastIndexOf('lost'); return i >= 0 ? s.slice(0, i + 1) : [{ name: 'home' }] }); refresh() }

  useEffect(() => {
    if (window.location.search) window.history.replaceState(null, '', window.location.pathname)
    api('/session/').then(async (session) => {
      setSites([...session.sites].sort((a, b) => (b.id === session.default_site) - (a.id === session.default_site)))
      setUser(session.user)
      if (session.user) await reload()
    }).catch((e) => setMessage(e.message)).finally(() => setLoading(false))
  }, [])
  useEffect(() => { window.scrollTo(0, 0) }, [view])
  useEffect(() => {
    if (!message || !user) return
    const timer = setTimeout(() => setMessage(''), 6000)
    return () => clearTimeout(timer)
  }, [message, user])

  async function signIn(values) {
    try { setBusy(true); setMessage(''); const result = await api('/login/', { method: 'POST', body: values }); setUser(result.user); await reload() }
    catch (e) { setMessage(e.message) } finally { setBusy(false) }
  }
  async function signUp(values) {
    try { setBusy(true); setMessage(''); setMessage((await api('/signup/', { method: 'POST', body: values })).message) }
    catch (e) { setMessage(e.message) } finally { setBusy(false) }
  }
  async function submit(form, kind, typedSecret) {
    setBusy(true)
    try {
      const result = await api('/' + kind + '/', { method: 'POST', body: form })
      await reload()
      replace(kind, { id: result.id, posted: true, typedSecret })
    } finally { setBusy(false) }
  }
  async function clearClaims() {
    if (!window.confirm('Clear your finished claims? Rejected claims and returned items are removed from your list (the other person still sees them). Claims waiting on a decision or a handoff stay.')) return
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
  async function logout() {
    await api('/session/', { method: 'DELETE' })
    setUser(null); setStack([{ name: 'home' }])
  }

  if (loading) return <div className="boot"><Logo size={120} tile={false} /></div>
  if (!user) return <SignIn onSignIn={signIn} onSignUp={signUp} busy={busy} message={message} onClearMessage={() => setMessage('')} />

  const unread = dashboard.notifications.filter((n) => !n.read).length
  const myClaims = dashboard.claims.filter((c) => !c.claimant)
  const claim = view.claimId && dashboard.claims.find((c) => c.id === view.claimId)
  const shared = { back, go, replace, reload, busy, setBusy, home, backToMatches, sites }
  const missing = <Loading title="Claim" back={back} error="This claim is no longer on your list." />

  let screen
  switch (view.name) {
    case 'home': screen = <Home dashboard={dashboard} impact={impact} site={site} sites={sites} chooseSite={chooseSite} go={go} tab={tab} unread={unread} clearReports={clearReports} clearClaims={clearClaims} />; break
    case 'inbox': screen = <Inbox notifications={dashboard.notifications} reload={reload} setMessage={setMessage} />; break
    case 'profile': screen = <Profile user={user} setUser={setUser} setMessage={setMessage} logout={logout} />; break
    case 'lost-form': screen = site && <LostForm site={site} submit={submit} busy={busy} goBack={back} />; break
    case 'found-form': screen = site && <FoundForm site={site} submit={submit} busy={busy} goBack={back} />; break
    case 'lost': screen = <LostDetail id={view.id} {...shared} />; break
    case 'found': case 'match': screen = <ItemScreen {...view} {...shared} myClaims={myClaims} />; break
    case 'claim': {
      const tries = myClaims.filter((c) => c.item_id === view.item.id)
      const open = tries.find((c) => c.status === 'pending' || c.status === 'approved')
      const left = Math.max(0, 2 - tries.filter((c) => c.status === 'rejected').length)
      screen = open ? (open.status === 'pending' ? <Waiting claim={open} home={home} /> : <Approved claim={open} replace={replace} />)
        : left === 0 ? <Locked {...view} {...shared} />
        : <ClaimQuestion {...view} item={{ ...view.item, attemptsLeft: left }} {...shared} />
      break
    }
    case 'wrong': screen = <WrongAnswer {...view} {...shared} />; break
    case 'locked': screen = <Locked {...view} {...shared} />; break
    case 'manual': screen = <ManualRequest {...view} {...shared} />; break
    case 'waiting': case 'approved': screen = !claim ? missing
      : claim.status === 'pending' ? <Waiting claim={claim} home={home} />
      : claim.status === 'rejected' ? <Declined claim={claim} home={home} />
      : claim.item.status === 'returned' ? <Returned claim={claim} site={site} home={home} />
      : <Approved claim={claim} replace={replace} />; break
    case 'review': screen = !claim ? missing
      : claim.status === 'pending' ? <ReviewClaim claim={claim} claims={dashboard.claims} {...shared} />
      : <Connected claim={claim} replace={replace} />; break
    case 'connected': screen = claim ? <Connected claim={claim} replace={replace} /> : missing; break
    case 'handoff': screen = !claim ? missing
      : claim.item.status === 'returned' ? <Returned claim={claim} site={site} home={home} />
      : <Handoff claim={claim} user={user} {...shared} />; break
    case 'returned': screen = claim ? <Returned claim={claim} site={site} home={home} /> : missing; break
    default: screen = null
  }

  return <div className="app">
    {message && <div className="toast" role="status"><span>{message}</span><button onClick={() => setMessage('')} aria-label="Dismiss">×</button></div>}
    <div className="view" key={stack.length + ':' + view.name}>{screen}</div>
    {TABS.includes(view.name) && <TabBar view={view.name} tab={tab} unread={unread} />}
  </div>
}
