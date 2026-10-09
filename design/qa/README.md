# Browser QA

The fixture server uses an in-memory database and synthetic users. It never opens the production/app database.

From the repository root:
```powershell
.\backend\venv\Scripts\python.exe design/qa/server.py
```
In another shell, from `frontend`:
```powershell
$env:NEXT_PUBLIC_API_URL='http://localhost:5001/api'
npm run dev -- --port 3001
```
In another shell, from the repository root:
```powershell
npm install --prefix design/qa
node design/qa/browser.cjs
```

The suite launches installed Google Chrome headlessly. It verifies login/signup, group creation, search, payment reporting and verification, profile saving, theme switching, desktop/mobile routes, matchroom sizing and runtime errors. It saves screenshots here.

Restart the fixture server before another run because the tests submit payments and create an account/group in its disposable database. Stop both QA servers when finished. Screenshots contain synthetic fixture data.
