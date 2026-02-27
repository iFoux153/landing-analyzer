require('dotenv').config();
const express = require('express');
const { chromium } = require('playwright');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const LD_PATH = process.env.PLAYWRIGHT_LIBS_PATH || '/home/clawadmin/.local/lib/playwright-deps/usr/lib/x86_64-linux-gnu';

// OpenClaw gateway proxy config (ou Anthropic API directe)
const GATEWAY_URL   = process.env.OPENCLAW_GATEWAY_URL   || 'http://127.0.0.1:18789/v1/chat/completions';
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || '';
const GATEWAY_MODEL = process.env.OPENCLAW_GATEWAY_MODEL || 'openclaw:cpo';

// Patch LD_LIBRARY_PATH for Playwright
process.env.LD_LIBRARY_PATH = `${LD_PATH}:${process.env.LD_LIBRARY_PATH || ''}`;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Scrape page ---
async function scrapePage(url) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const content = await page.evaluate(() => {
      ['script', 'style', 'noscript', 'svg', 'iframe'].forEach(tag =>
        document.querySelectorAll(tag).forEach(el => el.remove())
      );
      return {
        title: document.title,
        metaDesc: document.querySelector('meta[name="description"]')?.content || '',
        h1: [...document.querySelectorAll('h1')].map(el => el.innerText.trim()).filter(Boolean),
        h2: [...document.querySelectorAll('h2')].map(el => el.innerText.trim()).filter(Boolean),
        h3: [...document.querySelectorAll('h3')].map(el => el.innerText.trim()).filter(Boolean),
        paragraphs: [...document.querySelectorAll('p')].map(el => el.innerText.trim()).filter(Boolean),
        buttons: [...document.querySelectorAll('button, a')].map(el => el.innerText.trim()).filter(s => s.length > 1 && s.length < 80),
        bodyText: document.body.innerText.slice(0, 8000)
      };
    });

    await browser.close();
    return content;
  } catch (err) {
    await browser.close();
    throw err;
  }
}

// --- Analyse avec Claude via OpenClaw gateway ---
async function analyzePage(content) {
  const pageContent = `
TITRE : ${content.title}
META DESCRIPTION : ${content.metaDesc}
H1 : ${content.h1.join(' | ') || 'ABSENT'}
H2 : ${content.h2.join(' | ')}
H3 : ${content.h3.join(' | ')}
PARAGRAPHES : ${content.paragraphs.join('\n')}
BOUTONS & CTA : ${[...new Set(content.buttons)].join(' | ')}
CONTENU COMPLET :
${content.bodyText}
  `.trim();

  const prompt = `Tu es un expert CRO (Conversion Rate Optimization) et copywriter de haut niveau.
Tu analyses des landing pages basé sur les frameworks de Peep Laja (CXL), Joanna Wiebe (Copyhackers) et MECLABS.
Réponds UNIQUEMENT en JSON valide, sans texte avant ou après.

Analyse cette landing page selon les 7 piliers et retourne UNIQUEMENT ce JSON :

{
  "score_global": <number 0-100>,
  "scores": {
    "clarte_message": <0-20>,
    "proposition_valeur": <0-20>,
    "copywriting": <0-15>,
    "structure_flow": <0-15>,
    "call_to_action": <0-15>,
    "confiance_preuve": <0-10>,
    "mobile_performance": <0-5>
  },
  "top3_problemes": [
    {
      "titre": "<nom court du problème>",
      "constat": "<ce qui ne va pas précisément>",
      "action": "<ce qu'il faut faire concrètement>"
    }
  ],
  "reformulation": {
    "titre_actuel": "<titre actuel>",
    "titre_suggere": "<titre optimisé>",
    "pourquoi": "<explication courte>"
  },
  "verdict_global": "<2-3 phrases de synthèse sur la page>"
}

Critères de scoring :
1. Clarté du message (20pts) : compréhension en 5s, titre clair, pas de jargon
2. Proposition de valeur (20pts) : différenciante, orientée bénéfices, quantifiée
3. Copywriting (15pts) : voix du client, douleur réelle, ton cohérent
4. Structure & flow (15pts) : Hero→Problème→Solution→Preuve→CTA, objections traitées
5. Call to Action (15pts) : visible above fold, wording clair, bien répété
6. Confiance & preuve sociale (10pts) : témoignages, chiffres, garanties
7. Mobile & performance (5pts) : lisible mobile, CTA accessible

Contenu de la page :
${pageContent}`;

  const res = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GATEWAY_TOKEN}`
    },
    body: JSON.stringify({
      model: GATEWAY_MODEL,
      max_tokens: 2000,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const data = await res.json();
  const text = data.choices[0].message.content;

  // Extract JSON (remove possible markdown code blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Claude n\'a pas retourné de JSON valide');
  return JSON.parse(jsonMatch[0]);
}

// --- Générer version améliorée ---
async function generateImproved(content, analysis) {
  const problems = analysis.top3_problemes.map((p, i) => `${i+1}. ${p.titre} → ${p.action}`).join('\n');

  const prompt = `Tu es un expert copywriter CRO. Voici une landing page et son analyse.

PROBLÈMES IDENTIFIÉS :
${problems}

CONTENU ACTUEL DE LA PAGE :
Titre : ${content.title}
Meta description : ${content.metaDesc}
H1 : ${content.h1.join(' | ') || 'ABSENT'}
Paragraphes principaux : ${content.paragraphs.slice(0, 5).join(' | ')}
CTAs : ${[...new Set(content.buttons)].slice(0, 8).join(' | ')}

Génère des versions améliorées pour les sections clés. Retourne UNIQUEMENT ce JSON :

{
  "sections": [
    {
      "section": "Titre principal (H1)",
      "original": "<titre actuel>",
      "improved": "<nouvelle version orientée bénéfice + cible>",
      "note": "<explication courte>"
    },
    {
      "section": "Meta description",
      "original": "<meta actuelle>",
      "improved": "<nouvelle meta : accroche + bénéfice + CTA implicite, max 155 caractères>",
      "note": null
    },
    {
      "section": "Hero paragraph",
      "original": "<paragraphe hero actuel>",
      "improved": "<version réécrite orientée douleur → solution>",
      "note": "<explication>"
    },
    {
      "section": "Call to Action principal",
      "original": "<CTA actuel>",
      "improved": "<CTA réécrit orienté valeur>",
      "note": "<pourquoi ce wording>"
    }
  ]
}`;

  const res = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GATEWAY_TOKEN}`
    },
    body: JSON.stringify({
      model: GATEWAY_MODEL,
      max_tokens: 2000,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const data = await res.json();
  const text = data.choices[0].message.content;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Réponse JSON invalide');
  return JSON.parse(jsonMatch[0]);
}

// Cache temporaire du contenu scrapé (clé = url)
const pageCache = new Map();

// --- API route : analyze ---
app.post('/api/analyze', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL manquante' });

  try {
    console.log(`🔍 Scraping: ${url}`);
    const content = await scrapePage(url);
    pageCache.set(url, content); // on garde pour /api/improve
    console.log(`🤖 Analysing with Claude...`);
    const analysis = await analyzePage(content);
    res.json({ success: true, url, analysis });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// --- API route : improve ---
app.post('/api/improve', async (req, res) => {
  const { url, analysis } = req.body;
  if (!url || !analysis) return res.status(400).json({ error: 'URL et analyse requises' });

  try {
    let content = pageCache.get(url);
    if (!content) {
      console.log(`🔍 Re-scraping for improve: ${url}`);
      content = await scrapePage(url);
    }
    console.log(`✨ Generating improved version...`);
    const improved = await generateImproved(content, analysis);
    res.json({ success: true, improved });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// --- Générer le HTML amélioré ---
async function generateHTML(content, analysis, improved) {
  const sections = improved?.sections || [];
  const improvements = sections.map(s => `• ${s.section} : ${s.improved}`).join('\n');
  const problems = analysis.top3_problemes.map(p => `• ${p.titre} → ${p.action}`).join('\n');

  const prompt = `Tu es un expert CRO et développeur frontend. Génère une landing page HTML complète et autonome basée sur les informations suivantes.

CONTENU ORIGINAL :
- Nom/Titre du produit : ${content.title}
- Description : ${content.metaDesc}
- Proposition de valeur : ${content.paragraphs.slice(0, 3).join(' | ')}
- Features clés : ${content.paragraphs.slice(3, 8).join(' | ')}
- CTAs : ${[...new Set(content.buttons)].slice(0, 6).join(' | ')}
- Témoignages/preuves : ${content.paragraphs.filter(p => p.length > 40 && p.length < 200).slice(0, 3).join(' | ')}

AMÉLIORATIONS À INTÉGRER :
${improvements}

PROBLÈMES À CORRIGER :
${problems}

CONTRAINTES :
- HTML complet autonome (tout inline — CSS dans <style>, pas de dépendances externes sauf Google Fonts)
- Mobile-first, responsive
- Design dark moderne et professionnel (pas de couleurs criardes)
- Structure : Hero → Problème → Solution → Features → Preuves sociales → Prix (si dispo) → FAQ → CTA final
- H1 présent et optimisé
- CTA above the fold obligatoire
- Pas de Lorem ipsum — utilise le vrai contenu amélioré
- Code propre et commenté par section

Retourne UNIQUEMENT le code HTML complet, sans explication, sans markdown, sans backticks.`;

  const res = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GATEWAY_TOKEN}` },
    body: JSON.stringify({
      model: GATEWAY_MODEL,
      max_tokens: 8000,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const data = await res.json();
  let html = data.choices[0].message.content.trim();
  // Nettoyer si Claude wrap dans des backticks
  html = html.replace(/^```html?\n?/, '').replace(/\n?```$/, '').trim();
  return html;
}

// --- API route : generate ---
app.post('/api/generate', async (req, res) => {
  const { url, analysis, improved } = req.body;
  if (!url || !analysis) return res.status(400).json({ error: 'Données manquantes' });

  try {
    let content = pageCache.get(url);
    if (!content) {
      console.log(`🔍 Re-scraping for generate: ${url}`);
      content = await scrapePage(url);
    }
    console.log(`🏗️ Generating HTML...`);
    const html = await generateHTML(content, analysis, improved);
    res.json({ success: true, html });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Landing Analyzer running on http://localhost:${PORT}`);
});
