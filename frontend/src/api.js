function csrfToken() {
  return document.cookie.split('; ').find((part) => part.startsWith('csrftoken='))?.split('=')[1] || ''
}

export async function api(path, options = {}) {
  const headers = { 'X-CSRFToken': decodeURIComponent(csrfToken()), ...options.headers }
  const body = options.body instanceof FormData ? options.body : options.body ? JSON.stringify(options.body) : undefined
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json'
  const response = await fetch('/api' + path, { credentials: 'same-origin', ...options, body, headers })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Try again.')
  return data
}
