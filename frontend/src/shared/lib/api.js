/** Thin fetch wrapper for the Flask API (same-origin via the Vite proxy). */
async function request(path, init) {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  })
  if (!res.ok) {
    let msg = `${res.status}`
    try {
      const data = await res.json()
      msg = data.error ?? msg
    } catch {
      // Response was not JSON.
    }
    throw new Error(msg)
  }
  return res.json()
}

export const api = {
  get: (path) => request(path),
  post: (path, body) =>
    request(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: (path, body) =>
    request(path, { method: "PUT", body: JSON.stringify(body) }),
}
