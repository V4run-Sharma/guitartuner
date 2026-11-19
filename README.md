# Guitar Tuner

An offline-capable PWA tuner for guitar, bass, ukulele and any chromatic note, built to be installed on an iPhone home screen.

**Live:** https://v4run-sharma.github.io/guitartuner/

## Features

- **23 tunings**: guitar (standard, drop, open, DADGAD…), 7-string, 4/5-string bass and ukulele
- **Chromatic mode** with sharp or flat note names
- **Auto string detection**, or tap a string to lock onto it; strings get a ✓ once held in tune
- **Settings**: sensitivity (with a live input meter), in-tune range (±2–10 ¢), needle response, A4 reference (415–466 Hz), keep screen on
- **Works offline** after the first visit, and installs as a standalone app

## Using it on an iPhone

1. Open the live link in Safari (iOS 16.4 or later).
2. Tap Share, then **Add to Home Screen**.
3. Open it from the home screen, tap **Start tuning** and allow the microphone.

## How it works

Pitch detection runs in an `AudioWorklet` off the main thread ([`src/lib/pitch-processor.ts`](src/lib/pitch-processor.ts)) using the McLeod Pitch Method, with the autocorrelation computed by FFT. Readings are gated by level and clarity, then median-smoothed ([`src/lib/tuner.svelte.ts`](src/lib/tuner.svelte.ts)).

Built with Svelte 5, Vite, Tailwind CSS 4 and `vite-plugin-pwa`.

## Development

```bash
npm install
npm run dev      # dev server
npm run check    # type-check
npm run lint
npm run build    # production build in dist/
npm run icons    # regenerate app icons from public/favicon.svg
npm run deploy   # build and publish to GitHub Pages (gh-pages branch)
```

To add a tuning, add an entry to [`src/lib/tunings.ts`](src/lib/tunings.ts).
