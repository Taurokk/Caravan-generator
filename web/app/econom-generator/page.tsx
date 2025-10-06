"use client";
import React, { useMemo, useState } from "react";

/**
 * EcoNom – Générateur v1 (PNJ + Caravane)
 *
 * ⚙️ Spécs implémentées (v1):
 * - 12 compétences (4 familles). Titre = 2 compétences → 2 épithètes (animal/végétal) + article correct + Terrain.
 * - 6 Clans : Yashan (Social), Veygirh (Technique), Tengun (Martial), Bakaar (Survie), Ulgar (Technique), Khazrak (Survie)
 *   → +2 compétences au CHOIX dans la famille du clan (doublons autorisés).
 * - Biomes & Déserts complets. Article auto: du / de la / de l' / des.
 * - Inventaire PNJ : réglette globale 0–4 objets par PNJ (valeur exacte). Doublons autorisés.
 *   Familles d'objets = CHOIX de bonus au craft (ex. Arme Pierre=1 bonus, Silex=2, Fer=3). Armure = +1 PA cumulable.
 * - Caravane : réglette nombre de PNJ (placeholder), réglette TOTAL RESSOURCES (pool global non réparti pour l’instant), listes faune/flore.
 * - Export JSON, Impression cartes Recto/Verso.
 *
 * 🔜 À venir (v2+): répartition des ressources, règles Eau/Viande/Plantes, profils & compatibilité de clans, modules contraints, vitesse Voyage, gabarit visuel final.
 */

// ———————————————————————————— RNG (seeded)
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function strToSeed(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function pick<T>(rng: () => number, arr: readonly T[]): T { return arr[Math.floor(rng() * arr.length)]; }
function pickN<T>(rng: () => number, arr: readonly T[], n: number): T[] {
  const a = Array.from(arr);
  const out: T[] = [];
  for (let i = 0; i < n && a.length; i++) { const idx = Math.floor(rng() * a.length); out.push(a[idx]); a.splice(idx,1); }
  return out;
}
function pickWithReplacement<T>(rng: () => number, arr: readonly T[], n: number): T[] {
  const out: T[] = [];
  for (let i=0;i<n;i++) out.push(arr[Math.floor(rng()*arr.length)] as T);
  return out;
}

// ———————————————————————————— Données Règles
export const SKILLS = {
  Martial: ["Contact", "Distance", "Ruse"],
  Survie: ["Traque", "Résilience", "Débrouillardise"],
  Technique: ["Artisanat", "Érudition", "Occultisme"],
  Social: ["Culture", "Communication", "Artistique"],
} as const;
export type Skill = (typeof SKILLS)[keyof typeof SKILLS][number];
export type Famille = keyof typeof SKILLS;

// Dictionnaire d'épithètes (starter pack – modifiable). 6–8/compétence.
const EPITHETES: Record<Skill, string[]> = {
  Contact: ["Cornu", "Chargeur", "Épineux", "Piquant", "Heurtant", "Sanglier"],
  Distance: ["Ailé", "Guetteur", "Perce‑Ciel", "Sagittaire", "Faucon", "Vigie"],
  Ruse: ["Tisseur", "Araignée", "Renard", "Fourbe", "Piégeur", "Luron"],
  Traque: ["Flairant", "Pistard", "Lynx", "Renifleur", "Fouisseur", "Loup"],
  Résilience: ["Rocailleux", "Écorcé", "Rustique", "Endurant", "Chêne", "Tenace"],
  Débrouillardise: ["Lierre", "Bricoleur", "Récupérateur", "Castor", "Rat‑des‑sables", "Trouve‑Tout"],
  Artisanat: ["Forgeron", "Tisserand", "Sculpteur", "Tanneur", "Tailleur", "Bâtisseur"],
  Érudition: ["Lettré", "Sage", "Archiviste", "Hibou", "Savant", "Sagace"],
  Occultisme: ["Augure", "Sibyllin", "Runique", "Corbeau", "Chamanique", "Occulte"],
  Culture: ["Totémique", "Griot", "Héritier", "Tradition", "Ancestral", "Rituel"],
  Communication: ["Langue‑d’Argent", "Mielleux", "Orateur", "Diplomate", "Négociant", "Persuasif"],
  Artistique: ["Lyrique", "Mélodique", "Peintre", "Tambour", "Rossignol", "Inspirant"],
};

// Clans & familles
export const CLANS = [
  { key: "yashan", label: "Yashan", famille: "Social" },
  { key: "veygirh", label: "Veygirh", famille: "Technique" },
  { key: "tengun", label: "Tengun", famille: "Martial" },
  { key: "bakaar", label: "Bakaar", famille: "Survie" },
  { key: "ulgar", label: "Ulgar", famille: "Technique" },
  { key: "khazrak", label: "Khazrak", famille: "Survie" },
] as const;
export type ClanKey = typeof CLANS[number]["key"];

// Terrains
export const DESERTS = [
  "Forêt Pétrifiée","Terres Fongales","Cité Fantôme","Tourbière Asséchée","Mont Noir","Salinière","Canyon Plat","Mer d’Ombre","Nuage Toxique"
] as const;
export const BIOMES = ["Forêt","Jungle","Plaine","Marais","Mont","Sable","Rivière","Lac","Oasis"] as const;
export type Terrain = typeof DESERTS[number] | typeof BIOMES[number];

const TERRAIN_ARTICLE: Record<Terrain, string> = {
  // Déserts
  "Forêt Pétrifiée": "de la",
  "Terres Fongales": "des",
  "Cité Fantôme": "de la",
  "Tourbière Asséchée": "de la",
  "Mont Noir": "du",
  "Salinière": "de la",
  "Canyon Plat": "du",
  "Mer d’Ombre": "de la",
  "Nuage Toxique": "du",
  // Biomes
  "Forêt": "de la",
  "Jungle": "de la",
  "Plaine": "de la",
  "Marais": "du",
  "Mont": "du",
  "Sable": "du",
  "Rivière": "de la",
  "Lac": "du",
  "Oasis": "de l’",
};

function titreFromSkillsAndTerrain(rng:()=>number, s1: Skill, s2: Skill, terrain: Terrain){
  const e1 = pick(rng, EPITHETES[s1]);
  const e2 = pick(rng, EPITHETES[s2]);
  const art = TERRAIN_ARTICLE[terrain];
  return `${e1} ${e2} ${art} ${terrain}`;
}

// Ressources (pool global v1)
export const RESSOURCES = [
  "Bois","Résine","Fibre","Viande","Cuir","Os","Graisse","Plante","Glande","Pierre","Silex","Fer","Eau"
] as const;

// ———————————————————————————— Inventaire (familles d’objets)
export type ObjetFamille =
  | "Arme" | "Outil" | "Armure" | "Piège" | "Abri" | "Instrument" | "Feu"
  | "Monte" | "Sac" | "Habits" | "Teinture" | "Livre" | "Lumière" | "Décoration";

export type Materiau = "Pierre" | "Silex" | "Fer"; // pour armes/outils/armures/pièges
export type Palier = "Rudimentaire" | "Raffiné" | "Transformé"; // autres familles

const FAMILLE_BONUS: Record<ObjetFamille, { type: "skills"|"pa"|"stock"|"voyage"|"tag"; choices?: Skill[] }>= {
  Arme:        { type: "skills", choices: ["Contact","Distance"] as Skill[] },
  Outil:       { type: "skills", choices: ["Traque","Artisanat"] as Skill[] },
  Armure:      { type: "pa" },
  Piège:       { type: "skills", choices: ["Ruse","Traque"] as Skill[] },
  Abri:        { type: "skills", choices: ["Résilience"] as Skill[] },
  Instrument:  { type: "skills", choices: ["Artistique","Culture"] as Skill[] },
  Feu:         { type: "skills", choices: ["Résilience"] as Skill[] }, // + tag chaleur (later)
  Monte:       { type: "voyage" },
  Sac:         { type: "stock" },
  Habits:      { type: "skills", choices: ["Culture"] as Skill[] },
  Teinture:    { type: "skills", choices: ["Artistique"] as Skill[] },
  Livre:       { type: "skills", choices: ["Érudition"] as Skill[] },
  Lumière:     { type: "skills", choices: ["Traque"] as Skill[] },
  Décoration:  { type: "skills", choices: ["Culture","Artistique"] as Skill[] },
};

const OBJETS_PAR_FAMILLE: Record<ObjetFamille, string[]> = {
  Arme: ["Hache","Épée","Masse","Lance","Arc","Fronde"],
  Outil: ["Boussole à mousse","Marteau","Pelle","Sceau","Corde","Couteau"],
  Armure: ["Bouclier","Casque","Plastron","Jupe lamellaire"],
  Piège: ["Collet","Pics","Poison"],
  Abri: ["Hamac","Tente","Cocon","Yourte"],
  Instrument: ["Flûte","Oud","Tambour"],
  Feu: ["Pierre à feu","Briquet"],
  Monte: ["Selle","Harnais","Étrier"],
  Sac: ["Sacoche","Panier","Bourse","Sac de voyage","Bandoulière"],
  Habits: ["Braies","Tunique","Sandales","Bijoux","Anneaux"],
  Teinture: ["Peinture"],
  Livre: ["Livre de recettes","Livre de cuisine","Journal de bord"],
  Lumière: ["Torche","Bougie","Lanterne"],
  Décoration: ["Totem","Sculpture"],
};

export type Objet = {
  id: string;
  famille: ObjetFamille;
  nom: string;
  materiau?: Materiau;
  palier?: Palier;
  bonuses: Skill[]; // doublons autorisés
  pa?: number;      // armure cumulable
  stock?: number;   // +3/+4/+5
  voyage?: number;  // jetons voyage (placeholder)
};

function bonusesCountFor(material?: Materiau){
  if(!material) return 1; // fallback
  if(material === "Pierre") return 1;
  if(material === "Silex") return 2; // conforme v1
  return 3; // Fer
}

function generateObjet(rng:()=>number): Objet {
  const famille = pick(rng, Object.keys(OBJETS_PAR_FAMILLE) as ObjetFamille[]);
  const nom = pick(rng, OBJETS_PAR_FAMILLE[famille]);
  const spec = FAMILLE_BONUS[famille];

  let materiau: Materiau | undefined; let palier: Palier | undefined;
  let bonuses: Skill[] = [];
  let pa: number | undefined; let stock: number | undefined; let voyage: number | undefined;

  if(["Arme","Outil","Armure","Piège"].includes(famille as any)){
    materiau = pick(rng, ["Pierre","Silex","Fer"]);
  } else {
    palier = pick(rng, ["Rudimentaire","Raffiné","Transformé"]);
  }

  if(spec.type === "skills"){
    const n = bonusesCountFor(materiau);
    const baseChoices = spec.choices ?? [];
    // doublons autorisés
    bonuses = pickWithReplacement(rng, baseChoices, Math.max(1,n));
  } else if(spec.type === "pa"){
    pa = 1; // +1 point d’armure par pièce
  } else if(spec.type === "stock"){
    stock = pick(rng, [3,4,5]);
  } else if(spec.type === "voyage"){
    voyage = 1; // jeton voyage
  } else if(spec.type === "tag"){
    // réservé pour props futures
  }

  return {
    id: `${nom}-${Math.floor(rng()*1e9).toString(36)}`,
    famille: famille as ObjetFamille,
    nom,
    materiau,
    palier,
    bonuses,
    pa, stock, voyage,
  };
}

// ———————————————————————————— PNJ
const NOMS = [
  "Aren","Belka","Caro","Darel","Edrin","Faro","Galen","Haska","Irin","Jaro","Kael","Leni","Maro","Neris","Orin","Pasha","Ryn","Sora","Talan","Vaska","Yaro","Zerin"
];

export type PNJ = {
  id: string;
  nom: string;
  clan: ClanKey;
  clanLabel: string;
  clanFamille: Famille;
  clanBonus: Skill[]; // 2 choix dans la famille
  titreSkills: [Skill, Skill];
  terrain: Terrain;
  titre: string;
  inventaire: Objet[]; // EXACT nb via slider (0–4)
  competencesFinales: Skill[]; // union (titre 2 + clan 2 + objets skills)
  pa: number; // total armure
  stockBonus: number; // total +Stock
  voyage: number; // jetons voyage
};

function generatePNJ(rng:()=>number, objetsParPNJ:number): PNJ {
  const clan = pick(rng, CLANS);
  // +2 compétences dans la famille (doublons autorisés)
  const famSkills = SKILLS[clan.famille] as readonly Skill[];
  const clanBonus = pickWithReplacement(rng, famSkills as unknown as Skill[], 2) as Skill[];

  // Titre = 2 compétences parmi les 12 (doublons autorisés)
  const allSkills: Skill[] = [...SKILLS.Martial, ...SKILLS.Survie, ...SKILLS.Technique, ...SKILLS.Social] as unknown as Skill[];
  const titreSkills = pickWithReplacement(rng, allSkills, 2) as [Skill, Skill];

  const terrain = pick(rng, [...DESERTS, ...BIOMES] as unknown as Terrain[]);
  const titre = titreFromSkillsAndTerrain(rng, titreSkills[0], titreSkills[1], terrain);

  // Inventaire
  const inventaire: Objet[] = [];
  for(let i=0;i<objetsParPNJ;i++) inventaire.push(generateObjet(rng));

  // Agrégation
  const set = new Set<Skill>();
  clanBonus.forEach(s=>set.add(s));
  titreSkills.forEach(s=>set.add(s));
  let pa = 0; let stockBonus = 0; let voyage = 0;
  inventaire.forEach(o=>{
    o.bonuses.forEach(b=>set.add(b));
    if(o.pa) pa += o.pa;
    if(o.stock) stockBonus += o.stock;
    if(o.voyage) voyage += o.voyage;
  });

  return {
    id: `pnj-${Math.floor(rng()*1e9).toString(36)}`,
    nom: pick(rng, NOMS),
    clan: clan.key,
    clanLabel: clan.label,
    clanFamille: clan.famille,
    clanBonus,
    titreSkills,
    terrain,
    titre,
    inventaire,
    competencesFinales: Array.from(set),
    pa, stockBonus, voyage,
  };
}

// ———————————————————————————— Caravane (v1 placeholders)
const CAR_NAMES = ["La Pèlerine","La Girelle","L’Errante","La Rosée Nocturne","La Braise Douce","L’Aiguille des Sables"];
const FAUNE = ["Chèvres des sables","Rocs juvéniles","Lézards de bât","Corbeaux messagers","Chien pisteur"];
const FLORE = ["Herbes médicinales","Mousses rituelles","Graines nutritives","Lianes tressables","Champignons alchimiques"];

export type Caravane = {
  id: string;
  nom: string;
  totalRessources: number; // pool global (non réparti)
  pnjHeberges: number;     // via slider
  faune: string[];         // list only (règles plus tard)
  flore: string[];         // list only (règles plus tard)
};

function generateCaravane(rng:()=>number, totalR:number, pnjCount:number): Caravane {
  return {
    id: `car-${Math.floor(rng()*1e9).toString(36)}`,
    nom: pick(rng, CAR_NAMES),
    totalRessources: totalR,
    pnjHeberges: pnjCount,
    faune: pickN(rng, FAUNE, 2),
    flore: pickN(rng, FLORE, 2),
  };
}

// ———————————————————————————— UI helpers
function Badge({children}:{children:React.ReactNode}){return <span className="px-2 py-0.5 rounded-lg bg-white/10 border border-white/15 text-xs">{children}</span>;}

function Progress({value}:{value:number}){return (
  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
    <div className="h-2 bg-white/70" style={{width: `${Math.max(0,Math.min(100,value))}%`}} />
  </div>
);}

function ArticleTerrain({t}:{t:Terrain}){return <>{TERRAIN_ARTICLE[t]} {t}</>}

// ———————————————————————————— Cartes PNJ
function PNJCard({pnj}:{pnj:PNJ}){
  const initials = pnj.nom.split(" ").map(s=>s[0]).join("").slice(0,2).toUpperCase();
  return (
    <div className="grid grid-cols-2 gap-3 print:grid-cols-2">
      {/* Recto */}
      <article className="bg-white/5 rounded-2xl p-4 border border-white/10 min-h-64">
        <div className="flex items-start justify-between">
          <h3 className="text-xl font-semibold">{pnj.nom}</h3>
          <span className="text-xs text-neutral-400">{pnj.id.slice(-6)}</span>
        </div>
        <div className="mt-2 text-sm flex flex-wrap gap-2">
          <Badge>{pnj.clanLabel}</Badge>
          <Badge>Terrain : <ArticleTerrain t={pnj.terrain} /></Badge>
          <Badge>Relance/jour sur le terrain</Badge>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div className="w-20 h-20 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-2xl font-bold">{initials}</div>
          <div>
            <div className="text-neutral-400 text-xs">Titre</div>
            <div className="text-lg font-semibold">{pnj.titre}</div>
            <div className="text-xs text-neutral-400">({pnj.titreSkills[0]} + {pnj.titreSkills[1]})</div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div className="bg-white/5 rounded-xl p-2 border border-white/10">
            <div className="text-neutral-400 text-xs">Armure</div>
            <div className="text-lg font-semibold">+{pnj.pa} PA</div>
          </div>
          <div className="bg-white/5 rounded-xl p-2 border border-white/10">
            <div className="text-neutral-400 text-xs">Stock</div>
            <div className="text-lg font-semibold">+{pnj.stockBonus}</div>
          </div>
          <div className="bg-white/5 rounded-xl p-2 border border-white/10">
            <div className="text-neutral-400 text-xs">Voyage</div>
            <div className="text-lg font-semibold">{pnj.voyage}</div>
          </div>
        </div>
      </article>

      {/* Verso */}
      <article className="bg-white/5 rounded-2xl p-4 border border-white/10">
        <div className="text-neutral-400 text-sm">Compétences (Titre ∪ Clan ∪ Objets)</div>
        <div className="mt-1 flex flex-wrap gap-2">
          {pnj.competencesFinales.map(c=> <Badge key={c}>{c}</Badge>)}
        </div>
        <div className="mt-3 text-sm">
          <div className="text-neutral-400">Bonus de Clan ({pnj.clanFamille})</div>
          <div className="mt-1 flex flex-wrap gap-2">{pnj.clanBonus.map((b,i)=> <Badge key={i}>{b}</Badge>)}</div>
        </div>
        <div className="mt-3 text-sm">
          <div className="text-neutral-400">Inventaire ({pnj.inventaire.length})</div>
          <ul className="list-disc list-inside space-y-1">
            {pnj.inventaire.map(o=> (
              <li key={o.id}>
                <span className="font-medium">{o.nom}</span>
                {o.materiau ? <> — <span className="text-neutral-400">{o.materiau}</span></> : null}
                {o.palier ? <> — <span className="text-neutral-400">{o.palier}</span></> : null}
                {o.bonuses.length>0 && <>
                  <span className="text-neutral-400"> — Bonus:</span> {o.bonuses.join(" + ")}
                </>}
                {o.pa ? <> — <Badge>+{o.pa} PA</Badge></> : null}
                {o.stock ? <> — <Badge>+{o.stock} Stock</Badge></> : null}
                {o.voyage ? <> — <Badge>+{o.voyage} Voyage</Badge></> : null}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-3 text-xs text-neutral-400">Règle: 1 relance/jour quand le PNJ agit sur son terrain de prédilection.</div>
      </article>
    </div>
  );
}

// ———————————————————————————— Caravane Panel (v1)
function CaravanePanel({car}:{car:Caravane}){
  return (
    <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
      <div className="flex items-start justify-between">
        <h3 className="text-xl font-semibold">{car.nom}</h3>
        <span className="text-xs text-neutral-400">{car.id.slice(-6)}</span>
      </div>
      <div className="mt-2 text-sm flex flex-wrap gap-2">
        <Badge>PNJ hébergés: {car.pnjHeberges}</Badge>
        <Badge>Total ressources: {car.totalRessources}</Badge>
      </div>
      <div className="mt-4 grid sm:grid-cols-2 gap-4">
        <div>
          <div className="text-neutral-400 text-sm mb-1">Faune</div>
          <div className="flex flex-wrap gap-2">{car.faune.map(f=> <Badge key={f}>{f}</Badge>)}</div>
        </div>
        <div>
          <div className="text-neutral-400 text-sm mb-1">Flore</div>
          <div className="flex flex-wrap gap-2">{car.flore.map(f=> <Badge key={f}>{f}</Badge>)}</div>
        </div>
      </div>
      <div className="mt-4 text-xs text-neutral-400">La répartition par type (Bois, Résine, Eau, …) sera gérée dans une prochaine version.</div>
    </div>
  );
}

// ———————————————————————————— Export helpers
function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

// ———————————————————————————— Composant principal
export default function EcoNomGeneratorV1(){
  const [seed, setSeed] = useState("EcoNom-v1");
  const [pnjCount, setPnjCount] = useState(6);
  const [objetsParPNJ, setObjetsParPNJ] = useState(2); // réglette 0–4 EXACT
  const [carPNJ, setCarPNJ] = useState(6); // réglette PNJ côté caravane (placeholder)
  const [totalR, setTotalR] = useState(30); // slider total ressources (pool)

  const reroll = () => setSeed((s)=> s + ":" + Math.floor(Math.random()*1e6).toString(36));

  const pnjList = useMemo(()=>{
    const r = mulberry32(strToSeed(seed));
    return Array.from({length: Math.max(1, Math.min(50, pnjCount))}, ()=> generatePNJ(r, Math.max(0, Math.min(4, objetsParPNJ))));
  }, [seed, pnjCount, objetsParPNJ]);

  const caravan = useMemo(()=>{
    const r = mulberry32(strToSeed(seed+"/car"));
    return generateCaravane(r, totalR, carPNJ);
  }, [seed, totalR, carPNJ]);

  const handleCopyJSON = () => {
    const payload = { pnjs: pnjList, caravane: caravan };
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
  };

  const handleExportJSON = () => {
    const payload = { pnjs: pnjList, caravane: caravan };
    download(`EcoNom_Gen_v1_${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(payload, null, 2), "application/json");
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">EcoNom – Générateur (v1)</h1>
            <p className="text-neutral-400 mt-1">PNJ (Titre/Clan/Terrain/Inventaire) + Caravane (Total ressources, PNJ, Faune/Flore). Doublons autorisés partout.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={reroll} className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15">Relancer</button>
            <button onClick={handleCopyJSON} className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15">Copier JSON</button>
            <button onClick={handleExportJSON} className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15">Exporter JSON</button>
            <button onClick={()=>window.print()} className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 print:hidden">Imprimer</button>
          </div>
        </header>

        {/* Contrôles */}
        <section className="grid gap-4 md:grid-cols-5 mb-6">
          <div className="bg-white/5 rounded-2xl p-4">
            <label className="block text-sm text-neutral-400 mb-1">Seed</label>
            <input value={seed} onChange={(e)=>setSeed(e.target.value)} className="w-full bg-black/30 rounded-xl px-3 py-2 outline-none" />
          </div>
          <div className="bg-white/5 rounded-2xl p-4">
            <label className="block text-sm text-neutral-400 mb-1">Nombre de PNJ</label>
            <input type="range" min={1} max={30} value={pnjCount} onChange={(e)=>setPnjCount(parseInt(e.target.value))} className="w-full" />
            <div className="text-sm mt-1">{pnjCount}</div>
          </div>
          <div className="bg-white/5 rounded-2xl p-4">
            <label className="block text-sm text-neutral-400 mb-1">Objets par PNJ</label>
            <input type="range" min={0} max={4} value={objetsParPNJ} onChange={(e)=>setObjetsParPNJ(parseInt(e.target.value))} className="w-full" />
            <div className="text-sm mt-1">{objetsParPNJ}</div>
          </div>
          <div className="bg-white/5 rounded-2xl p-4">
            <label className="block text-sm text-neutral-400 mb-1">Caravane · PNJ hébergés</label>
            <input type="range" min={0} max={50} value={carPNJ} onChange={(e)=>setCarPNJ(parseInt(e.target.value))} className="w-full" />
            <div className="text-sm mt-1">{carPNJ}</div>
          </div>
          <div className="bg-white/5 rounded-2xl p-4">
            <label className="block text-sm text-neutral-400 mb-1">Caravane · Total ressources</label>
            <input type="range" min={0} max={200} value={totalR} onChange={(e)=>setTotalR(parseInt(e.target.value))} className="w-full" />
            <div className="text-sm mt-1">{totalR}</div>
          </div>
        </section>

        {/* Caravane */}
        <section className="mb-8">
          <CaravanePanel car={caravan} />
        </section>

        {/* PNJ Cards */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 print:grid-cols-1">
          {pnjList.map(p=> <PNJCard key={p.id} pnj={p} />)}
        </section>

        <footer className="text-center text-neutral-500 text-xs mt-8">
          <p>Recto = Présentation | Verso = Infos mécaniques. Titres générés avec articles corrects (« du », « de la », « de l’ », « des »).</p>
        </footer>
      </div>
    </div>
  );
}
