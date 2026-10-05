/** Public (non-secret) backend address + publishable key, with built-in fallbacks so any host works without env setup. */
export function getPublicBackendConfig() {
  const url =
    process.env["SUPABASE_URL"] ||
    import.meta.env['VITE_SUPABASE_URL'] ||
    "https://c--2c7e26b4-94c7-4611-9343-2923d576881d-prod.lovable.cloud";
  const key =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ||
    import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] ||
    "sb_publishable_EzSRFijJhkflZBkGITIVlw_vkR6BtK1";
  return { url, key };
}
