/**
 * Cloudflare Web Analytics counts page views without cookies or anything that
 * identifies a visitor. It only loads when the site is built with
 * CF_BEACON_TOKEN set, so local development and forks send nothing.
 */
export function startAnalytics() {
  const token = import.meta.env.CF_BEACON_TOKEN as string | undefined;
  if (!token || document.querySelector('script[data-cf-beacon]')) return;

  const script = document.createElement('script');
  script.defer = true;
  script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  script.dataset.cfBeacon = JSON.stringify({ token });
  document.head.append(script);
}
