# Worth It Food Map

Every restaurant from BuzzFeed's *Worth It* on one map, with filters and a personal "been there" checklist.

- **No backend.** A static React site plus one `restaurants.json`, generated from `Data/Worth It Places Visited.xlsx`.
- **Checklist stays in your browser** (localStorage). Back it up or move it between devices with a file or a short sync code.
- **Hosted on the oil project's CloudFront** at `/worthit/`, from its own S3 bucket. Extra cost ≈ $0.

See [CLAUDE.md](CLAUDE.md) for the design.

---

## Updating the restaurant list

1. Edit `Data/Worth It Places Visited.xlsx` (close Excel when done).
2. Run the importer:
   ```bash
   cd importer
   pip install -r requirements.txt
   python -m worthit_import
   ```
   It shows a diff (`+3 added ~2 changed -0 removed`), geocodes only new addresses, and asks before writing.
3. Commit the xlsx **and** `frontend/public/data/restaurants.json` + `importer/geocode_cache.json`, then push. CI deploys.

A pin in the wrong place? Add `Lat` and `Lng` columns to the **Map** sheet and fill them in for that row. They override geocoding.

CI runs `python -m worthit_import --check`. It fails if the xlsx changed but the JSON wasn't regenerated.

## Local development

```bash
cd frontend
npm install
npm run dev        # http://localhost:5174/worthit/
npm test
```

---

## One-time setup

Done once, in this order.

### 1. Create the GitHub repo and push

Create an empty repo (e.g. `worthitfood`) on github.com, then:

```bash
git init -b main
git add .
git commit -m "Initial WorthItFood map"
git remote add origin https://github.com/<you>/worthitfood.git
git push -u origin main
```

### 2. Add the AWS secrets to the new repo

**Settings → Secrets and variables → Actions → Secrets.** Use the same values as the oil repo:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

### 3. Create the bucket

**Actions → Infrastructure → Run workflow.** When it finishes, the run summary shows three values.

### 4. Set the repo variables

**Settings → Secrets and variables → Actions → Variables.**

| Repo | Variable | Value |
|---|---|---|
| worthitfood | `SITE_BUCKET` | from step 3 |
| worthitfood | `CLOUDFRONT_DISTRIBUTION_ID` | from step 3 |
| oil_price_project | `TF_WORTHIT_BUCKET_DOMAIN` | from step 3 |

### 5. Turn on the `/worthit` route in the oil project

Push the oil repo change that adds the optional WorthItFood origin, then run **Deploy Infrastructure** in the oil repo. CloudFront takes about 5 minutes to propagate.

### 6. Deploy the site

**Actions → Deploy site → Run workflow**, or just push. The site is at `https://<oil-cloudfront-domain>/worthit/`.

---

## CI/CD

| Workflow | When | What |
|---|---|---|
| `ci.yml` | PRs, branch pushes | importer tests, JSON-in-sync check, frontend tests and build |
| `deploy.yml` | push to `main` (frontend/importer/Data) | runs CI, builds, uploads to S3 with the right cache headers, invalidates `/worthit/*` |
| `infra.yml` | changes to `terraform/**` | plan on PRs, apply on `main` |

## Credits

Spreadsheet started by reddit user u/pauseforasecond and extended by its maintainer. Map data and tiles © OpenStreetMap contributors, geocoding by Nominatim.
