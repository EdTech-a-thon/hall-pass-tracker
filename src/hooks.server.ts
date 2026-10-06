import type { Handle } from '@sveltejs/kit/hooks';

/**
 * app.html names every page "Happy Hallways", since the app builds itself in
 * the browser. A page built ahead of time (the Guides) adds its own title, so
 * the default is taken out there: search engines should see just one.
 */
export const handle: Handle = ({ event, resolve }) =>
  resolve(event, {
    transformPageChunk: ({ html }) =>
      html.split('<title>').length > 2 ? html.replace('<title>Happy Hallways</title>', '') : html,
  });
