// All regression providers must be explicit mocks. No live AI, email, payment or DB requests.
globalThis.fetch=async()=>{throw new Error('External network is disabled in release regression tests. Use an explicit mock.');};
