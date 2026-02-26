# 🔍 Landing Analyzer

Audit CRO automatisé de landing pages en quelques secondes.

Colle une URL → reçois un score /100, les 3 problèmes critiques et des recommandations actionnables.

![Landing Analyzer Screenshot](https://via.placeholder.com/800x500?text=Landing+Analyzer)

## Framework d'analyse

Basé sur les méthodes de **Peep Laja (CXL)**, **Joanna Wiebe (Copyhackers)** et **MECLABS** :

| Pilier | Points |
|--------|--------|
| Clarté du message | /20 |
| Proposition de valeur | /20 |
| Copywriting | /15 |
| Structure & flow | /15 |
| Call to Action | /15 |
| Confiance & preuve sociale | /10 |
| Mobile & performance | /5 |

## Stack

- **Scraping** : Playwright (gère les SPAs React/Vue/Next.js)
- **Analyse** : Claude via OpenClaw gateway ou Anthropic API
- **Frontend** : HTML/CSS vanilla, mobile-first

## Installation

```bash
git clone https://github.com/your-username/landing-analyzer
cd landing-analyzer
npm install
npx playwright install chromium
```

### Configuration

```bash
cp .env.example .env
```

Édite `.env` avec tes credentials :

```env
# Option A : Anthropic API directe
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx

# Option B : OpenClaw gateway
OPENCLAW_GATEWAY_URL=http://127.0.0.1:18789/v1/chat/completions
OPENCLAW_GATEWAY_TOKEN=your-token
OPENCLAW_GATEWAY_MODEL=openclaw:cpo
```

> **Note Linux** : Si Playwright manque des librairies système, installe-les avec :
> ```bash
> npx playwright install-deps chromium
> ```
> Sans sudo : voir `scripts/install-playwright-deps.sh`

## Lancement

```bash
npm start
# → http://localhost:3000
```

## Structure

```
landing-analyzer/
├── server.js          ← Backend Express + Playwright + Claude
├── scrape.js          ← Scraper standalone (CLI)
├── prompt.md          ← Framework d'analyse documenté
├── public/
│   └── index.html     ← Frontend mobile-first
├── .env.example       ← Config template
└── README.md
```

## Usage CLI (scraper seul)

```bash
node scrape.js https://example.com
```

## Roadmap

- [ ] Export PDF du rapport
- [ ] Historique des analyses
- [ ] Comparaison avant/après
- [ ] Mode agence (analyse en masse)
- [ ] API publique

## License

MIT
