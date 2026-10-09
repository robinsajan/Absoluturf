# Railway frontend deployment

Set the frontend service root directory to `/frontend`.

Set `NEXT_PUBLIC_API_URL=https://absoluturf-production.up.railway.app/api` in the frontend service variables before building. Next.js embeds this value during the build.

The Dockerfile builds Next.js and starts its production server on Railway's `PORT`, listening on `0.0.0.0`. It excludes local environment files from the image.

Clear any custom start command that runs `npm run dev` or `next dev`. Allow Railway to use the Dockerfile's start command, then redeploy. In the build logs, confirm that Railway detects `frontend/Dockerfile`.

If using Railpack instead of Docker, set the build command to `npm run build` and start command to `npm run start -- --hostname 0.0.0.0`.

After deployment, check `/login?mode=signup`: the form must submit an API request, and the frontend must no longer request `/_next/webpack-hmr` or load Next.js development tools.
