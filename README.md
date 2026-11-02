# Coming soon

A minimal black landing page with a single-outline Newton's cradle, softly shaded spheres, and a single “Coming soon” heading. Plain HTML, CSS, and JavaScript; no dependencies, external assets, or build step.

## Preview locally

From this directory, run:

```sh
python3 -m http.server 3000 --directory public
```

Open http://localhost:3000.

## Deploy to Vercel

Push `public/`, `vercel.json`, and `.gitignore` to a GitHub repository, then import that repository into Vercel. The included configuration selects **Other**, skips the build, and serves **public**. Click **Deploy**.

Alternatively, with the Vercel CLI installed, run `vercel` from this directory for a preview deployment, then `vercel --prod` when ready to publish.

Static deployment documentation: https://vercel.com/docs/builds/configure-a-build

## Customize

- Text, title, and description: `public/index.html`
- Typography, spacing, and colors: `public/style.css`
- Swing speed and angle: `PERIOD` and `AMPLITUDE` in `public/cradle.js`
- Browser icon: `public/favicon.svg`
- Desktop cursors: `public/cursor-dot.svg`, `public/cursor-grab.svg`, and `public/cursor-grabbing.svg`

Drag either outer ball outward and release it to change the swing. A small “Drag a ball” hint and two gentle highlight pulses identify the draggable balls; these cues fade after the first drag or keyboard push. Keyboard focus shows an Enter-key hint. A simple click or tap leaves the animation running. On desktop, moving over the cradle gently tilts it and shifts the lighting; move away to return it to center. Keyboard users can Tab to either outer ball and press Enter or Space to give it a push.

The animation pauses when the tab is hidden and honors reduced-motion preferences. With reduced motion enabled, you can position a ball directly by dragging it, but automatic swinging and hover movement stay off. Without JavaScript, the cradle and page remain visible.

On desktop, the cursor is a small off-white dot. It becomes a thin ring over an outer ball and contracts while dragging. These are native SVG cursors, so they track the pointer directly; touch devices retain their usual behavior.
