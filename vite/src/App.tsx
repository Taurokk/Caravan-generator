import React, { useMemo, useState } from "react";

/** EcoNom – Générateur (Vite + React + TS) */
// RNG -------------------------------------------------------------------------
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
function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}
function pickN<T>(rng: () => number, arr: readonly T[], n: number): T[] {
  const a = Array.from(arr); const out: T[] = [];
  for (let i = 0; i < n && a.length; i++) { const idx = Math.floor(rng() * a.length); out.push(a[idx]); a.splice(idx, 1); }
  return out;
}
function pickWithReplacement<T>(rng: () => number, arr: readonly T[], n: number): T[] {
  const out: T[] = []; for (let i = 0; i < n; i++) out.push(arr[Math.floor(rng() * arr.length)] as T); return out;
}
function pick2<T>(rng: () => number, arr: readonly T[]): [T, T] {
  const a = arr[Math.floor(rng() * arr.length)];
  const b = arr[Math.floor(rng() * arr.length)];
  return [a, b];
}

// Données ---------------------------------------------------------------------
export const SKILLS = {
  Martial: ["Contact", "Distance", "Ruse"] as const,
  Survie: ["Traque", "Résilience", "Débrouillardise"] as const,
  Technique: ["Artisanat", "Érudition", "Occultisme"] as const,
  Social: ["Culture", "Communication", "Artistique"] as const,
} as const;
export type Famille = keyof typeof SKILLS;
export type Skill = (typeof SKILLS)[Famille][number];

const EPITHETES: Record<Skill, readonly string[]> = {
  Contact: ["Cornu","Chargeur","Épineux","Piquant","Heurtant","Sanglier"],
  Distance: ["Ailé","Guetteur","Perce-Ciel","Sagittaire","Faucon","Vigie"],
  Ruse: ["Tisseur","Araignée","Renard","Fourbe","Piégeur","Luron"],
  Traque: ["Flairant","Pistard","Lynx","Renifleur","Fouisseur","Loup"],
  Résilience: ["Rocailleux","Écorcé","Rustique","Endurant","Chêne","Tenace"],
  Débrouillardise: ["Lierre","Bricoleur","Récupérateur","Castor","Rat-des-sables","Trouve-Tout"],
  Artisanat: ["Forgeron","Tisserand","Sculpteur","Tanneur","Tailleur","Bâtisseur"],
  Érudition: ["Lettré","Sage","Archiviste","Hibou","Savant","Sagace"],
  Occultisme: ["Augure","Sibyllin","Runique","Corbeau","Chamanique","Occulte"],
  Culture: ["Totémique","Griot","Héritier","Tradition","Ancestral","Rituel"],
  Communication: ["Langue-d’Argent","Mielleux","Orateur","Diplomate","Négociant","Persuasif"],
  Artistique: ["Lyrique","Mélodique","Peintre","Tambour","Rossignol","Inspirant"],
};

export const CLANS = [
  { key: "yashan",  label: "Yashan",  famille: "Social" as const },
  { key: "veygirh", label: "Veygirh", famille: "Technique" as const },
  { key: "tengun",  label: "Tengun",  famille: "Martial" as const },
  { key: "bakaar",  label: "Bakaar",  famille: "Survie" as const },
  { key: "ulgar",   label: "Ulgar",   famille: "Technique" as const },
  { key: "khazrak", label: "Khazrak", famille: "Survie" as const },
] as const;
export type ClanKey = typeof CLANS[number]["key"];

export const DESERTS = [
  "Forêt Pétrifiée","Terres Fongales","Cité Fantôme","Tourbière Asséchée","Mont Noir","Salinière","Canyon Plat","Mer d’Ombre","Nuage Toxique"
] as const;
export const BIOMES = ["Forêt","Jungle","Plaine","Marais","Mont","Sable","Rivière","Lac","Oasis"] as const;
export type Terrain = typeof DESERTS[number] | typeof BIOMES[number];

const TERRAIN_ARTICLE: Record<Terrain, string> = {
  "Forêt Pétrifiée":"de la","Terres Fongales":"des","Cité Fantôme":"de la","Tourbière Asséchée":"de la","Mont Noir":"du","Salinière":"de la","Canyon Plat":"du","Mer d’Ombre":"de la","Nuage Toxique":"du",
  "Forêt":"de la","Jungle":"de la","Plaine":"de la","Marais":"du","Mont":"du","Sable":"du","Rivière":"de la","Lac":"du","Oasis":"de l’",
};
function titreFromSkillsAndTerrain(rng:()=>number, s1: Skill, s2: Skill, terrain: Terrain){
  const e1 = pick(rng, EPITHETES[s1]); const e2 = pick(rng, EPITHETES[s2]);
  return `${e1} ${e2} ${TERRAIN_ARTICLE[terrain]} ${terrain}`;
}

export const RESSOURCES = ["Bois","Résine","Fibre","Viande","Cuir","Os","Graisse","Plante","Glande","Pierre","Silex","Fer","Eau"] as const;

// Objets ----------------------------------------------------------------------
export type ObjetFamille =
  | "Arme" | "Outil" | "Armure" | "Piège" | "Abri" | "Instrument" | "Feu"
  | "Monte" | "Sac" | "Habits" | "Teinture" | "Livre" | "Lumière" | "Décoration";

export type Materiau = "Pierre" | "Silex" | "Fer";
export type Palier = "Rudimentaire" | "Raffiné" | "Transformé";

const FAMILLE_BONUS: Record<ObjetFamille, { type: "skills"|"pa"|"stock"|"voyage"; choices?: readonly Skill[] }>= {
  Arme: { type: "skills", choices: SKILLS.Martial.slice(0,2) }, // Contact/Distance
  Outil: { type: "skills", choices: ["Traque","Artisanat"] },
  Armure: { type: "pa" }, Piège: { type: "skills", choices:["Ruse","Traque"] },
  Abri: { type: "skills", choices:["Résilience"] }, Instrument: { type: "skills", choices:["Artistique","Culture"] },
  Feu: { type:"skills", choices:["Résilience"] }, Monte:{ type:"voyage" }, Sac:{ type:"stock" },
  Habits:{ type:"skills", choices:["Culture"] }, Teinture:{ type:"skills", choices:["Artistique"] },
  Livre:{ type:"skills", choices:["Érudition"] }, Lumière:{ type:"skills", choices:["Traque"] },
  Décoration:{ type:"skills", choices:["Culture","Artistique"] },
};
const OBJETS_PAR_FAMILLE: Record<ObjetFamille, readonly string[]> = {
  Arme:["Hache","Épée","Masse","Lance","Arc","Fronde"],
  Outil:["Boussole à mousse","Marteau","Pelle","Sceau","Corde","Couteau"],
  Armure:["Bouclier","Casque","Plastron","Jupe lamellaire"],
  Piège:["Collet","Pics","Poison"],
  Abri:["Hamac","Tente","Cocon","Yourte"],
  Instrument:["Flûte","Oud","Tambour"],
  Feu:["Pierre à feu","Briquet"],
  Monte:["Selle","Harnais","Étrier"],
  Sac:["Sacoche","Panier","Bourse","Sac de voyage","Bandoulière"],
  Habits:["Braies","Tunique","Sandales","Bijoux","Anneaux"],
  Teinture:["Peinture"],
  Livre:["Livre de recettes","Livre de cuisine","Journal de bord"],
  Lumière:["Torche","Bougie","Lanterne"],
  Décoration:["Totem","Sculpture"],
};
export type Objet = {
  id: string; famille: ObjetFamille; nom: string;
  materiau?: Materiau; palier?: Palier;
  bonuses: Skill[]; pa?: number; stock?: number; voyage?: number;
};
const MATERIAL_FAMILIES: ReadonlyArray<ObjetFamille> = ["Arme","Outil","Armure","Piège"];
function bonusesCountFor(material?: Materiau){ if(!material) return 1; if(material==="Pierre")return 1; if(material==="Silex")return 2; return 3; }
function generateObjet(rng:()=>number): Objet {
  const famille = pick(rng, Object.keys(OBJETS_PAR_FAMILLE) as unknown as ObjetFamille[]);
  const nom = pick(rng, OBJETS_PAR_FAMILLE[famille]);
  const spec = FAMILLE_BONUS[famille];
  let materiau: Materiau|undefined; let palier: Palier|undefined;
  let bonuses: Skill[] = []; let pa:number|undefined; let stock:number|undefined; let voyage:number|undefined;
  if (MATERIAL_FAMILIES.includes(famille)) { materiau = pick(rng, ["Pierre","Silex","Fer"] as const); }
  else { palier = pick(rng, ["Rudimentaire","Raffiné","Transformé"] as const); }
  if(spec.type==="skills"){ const n=bonusesCountFor(materiau); const base=spec.choices??[]; bonuses=pickWithReplacement(rng, base, Math.max(1,n)); }
  else if(spec.type==="pa"){ pa=1; } else if(spec.type==="stock"){ stock=pick(rng,[3,4,5] as const); } else if(spec.type==="voyage"){ voyage=1; }
  return { id:`${nom}-${Math.floor(rng()*1e9).toString(36)}`, famille, nom, materiau, palier, bonuses, pa, stock, voyage };
}

// PNJ -------------------------------------------------------------------------
const NOMS: readonly string[] = ["Aren","Belka","Caro","Darel","Edrin","Faro","Galen","Haska","Irin","Jaro","Kael","Leni","Maro","Neris","Orin","Pasha","Ryn","Sora","Talan","Vaska","Yaro","Zerin"];
export type PNJ = {
  id:string; nom:string; clan:ClanKey; clanLabel:string; clanFamille:Famille; clanBonus:Skill[];
  titreSkills:[Skill,Skill]; terrain:Terrain; titre:string;
  inventaire:Objet[]; competencesFinales:Skill[]; pa:number; stockBonus:number; voyage:number;
};
function generatePNJ(rng:()=>number, objetsParPNJ:number): PNJ {
  const clanObj = pick(rng, CLANS); const famSkills = SKILLS[clanObj.famille]; const clanBonus = pickWithReplacement(rng, famSkills, 2);
  const allSkills: readonly Skill[] = [...SKILLS.Martial, ...SKILLS.Survie, ...SKILLS.Technique, ...SKILLS.Social];
  const [s1, s2] = pick2(rng, allSkills); const terrain = pick(rng, [...DESERTS, ...BIOMES] as const);
  const titre = titreFromSkillsAndTerrain(rng, s1, s2, terrain);
  const inventaire: Objet[] = []; for(let i=0;i<objetsParPNJ;i++) inventaire.push(generateObjet(rng));
  const set = new Set<Skill>(); clanBonus.forEach(s=>set.add(s)); set.add(s1); set.add(s2);
  let pa=0, stockBonus=0, voyage=0; inventaire.forEach(o=>{ o.bonuses.forEach(b=>set.add(b)); if(o.pa)pa+=o.pa; if(o.stock)stockBonus+=o.stock; if(o.voyage)voyage+=o.voyage; });
  return { id:`pnj-${Math.floor(rng()*1e9).toString(36)}`, nom: pick(rng, NOMS), clan:clanObj.key, clanLabel:clanObj.label, clanFamille:clanObj.famille,
    clanBonus, titreSkills:[s1,s2], terrain, titre, inventaire, competencesFinales:Array.from(set), pa, stockBonus, voyage };
}

// Caravane --------------------------------------------------------------------
const CAR_NAMES = ["La Pèlerine","La Girelle","L’Errante","La Rosée Nocturne","La Braise Douce","L’Aiguille des Sables"] as const;
const FAUNE = ["Chèvres des sables","Rocs juvéniles","Lézards de bât","Corbeaux messagers","Chien pisteur"] as const;
const FLORE = ["Herbes médicinales","Mousses rituelles","Graines nutritives","Lianes tressables","Champignons alchimiques"] as const;
export type Caravane = { id:string; nom:string; totalRessources:number; pnjHeberges:number; faune:readonly string[]; flore:readonly string[]; };
function generateCaravane(rng:()=>number, totalR:number, pnjCount:number): Caravane {
  return { id:`car-${Math.floor(rng()*1e9).toString(36)}`, nom: pick(rng, CAR_NAMES), totalRessources: totalR, pnjHeberges: pnjCount,
    faune: pickN(rng, FAUNE, 2), flore: pickN(rng, FLORE, 2) };
}

// UI helpers ------------------------------------------------------------------
function Badge({children}:{children:React.ReactNode}){ return <span className="px-2 py-0.5 rounded-lg bg-white/10 border border-white/15 text-xs">{children}</span>; }
function ArticleTerrain({t}:{t:Terrain}){ return <>{TERRAIN_ARTICLE[t]} {t}</>; }

// Cartes ----------------------------------------------------------------------
function PNJCard({pnj}:{pnj:PNJ}) {
  const initials = pnj.nom.split(" ").map(s=>s[0]).join("").slice(0,2).toUpperCase();
  return (
    <div className="grid grid-cols-2 gap-3 print:grid-cols-2">
      <article className="bg-white/5 rounded-2xl p-4 border border-white/10 min-h-64">
        <div className="flex items-start justify-between">
          <h3 className="text-xl font-semibold">{pnj.nom}</h3>
          <span className="text-xs text-neutral-400">{pnj.id.slice(-6)}</span>
        </div>
        <div className="mt-2 text-sm flex flex-wrap gap-2">
          <Badge>{pnj.clanLabel}</Badge>
          <Badge>Terrain : <ArticleTerrain t={pnj.terrain} /></Badge>
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
          <div className="bg-white/5 rounded-xl p-2 border border-white/10"><div className="text-neutral-400 text-xs">Armure</div><div className="text-lg font-semibold">+{pnj.pa} PA</div></div>
          <div className="bg-white/5 rounded-xl p-2 border border-white/10"><div className="text-neutral-400 text-xs">Stock</div><div className="text-lg font-semibold">+{pnj.stockBonus}</div></div>
          <div className="bg-white/5 rounded-xl p-2 border border-white/10"><div className="text-neutral-400 text-xs">Voyage</div><div className="text-lg font-semibold">{pnj.voyage}</div></div>
        </div>
      </article>

      <article className="bg-white/5 rounded-2xl p-4 border border-white/10">
        <div className="text-neutral-400 text-sm">Compétences (Titre ∪ Clan ∪ Objets)</div>
        <div className="mt-1 flex flex-wrap gap-2">{pnj.competencesFinales.map(c=> <Badge key={c}>{c}</Badge>)}</div>
        <div className="mt-3 text-sm">
          <div className="text-neutral-400">Bonus de Clan ({pnj.clanFamille})</div>
          <div className="mt-1 flex flex-wrap gap-2">{pnj.clanBonus.map((b,i)=> <Badge key={`${b}-${i}`}>{b}</Badge>)}</div>
        </div>
        <div className="mt-3 text-sm">
          <div className="text-neutral-400">Inventaire ({pnj.inventaire.length})</div>
          <ul className="list-disc list-inside space-y-1">
            {pnj.inventaire.map(o=> (
              <li key={o.id}>
                <span className="font-medium">{o.nom}</span>
                {o.materiau ? <> — <span className="text-neutral-400">{o.materiau}</span></> : null}
                {o.palier ? <> — <span className="text-neutral-400">{o.palier}</span></> : null}
                {o.bonuses.length>0 && <><span className="text-neutral-400"> — Bonus:</span> {o.bonuses.join(" + ")}</>}
                {o.pa ? <> — <Badge>+{o.pa} PA</Badge></> : null}
                {o.stock ? <> — <Badge>+{o.stock} Stock</Badge></> : null}
                {o.voyage ? <> — <Badge>+{o.voyage} Voyage</Badge></> : null}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-3 text-xs text-neutral-400">Règle : 1 relance/jour quand le PNJ agit sur son terrain de prédilection.</div>
      </article>
    </div>
  );
}

function CaravanePanel({car}:{car:Caravane}) {
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
        <div><div className="text-neutral-400 text-sm mb-1">Faune</div><div className="flex flex-wrap gap-2">{car.faune.map(f=> <Badge key={f}>{f}</Badge>)}</div></div>
        <div><div className="text-neutral-400 text-sm mb-1">Flore</div><div className="flex flex-wrap gap-2">{car.flore.map(f=> <Badge key={f}>{f}</Badge>)}</div></div>
      </div>
      <div className="mt-4 text-xs text-neutral-400">Répartition détaillée et règles spéciales (Eau/Viande/Plantes) à venir.</div>
    </div>
  );
}

// App -------------------------------------------------------------------------
export default function App() {
  const [seed, setSeed] = useState("EcoNom-v1");
  const [pnjCount, setPnjCount] = useState(6);
  const [objetsParPNJ, setObjetsParPNJ] = useState(2);
  const [carPNJ, setCarPNJ] = useState(6);
  const [totalR, setTotalR] = useState(30);

  const reroll = () => setSeed((s)=> s + ":" + Math.floor(Math.random()*1e6).toString(36));

  const pnjs = useMemo(()=>{
    const count = Math.max(1, Math.min(50, pnjCount));
    const obj = Math.max(0, Math.min(4, objetsParPNJ));
    const r = mulberry32(strToSeed(seed));
    return Array.from({length: count}, ()=> generatePNJ(r, obj));
  }, [seed, pnjCount, objetsParPNJ]);

  const caravan = useMemo(()=>{
    const r = mulberry32(strToSeed(seed+"/car"));
    return generateCaravane(r, totalR, carPNJ);
  }, [seed, totalR, carPNJ]);

  const copyJSON = () => navigator.clipboard.writeText(JSON.stringify({ pnjs, caravane: caravan }, null, 2));
  const exportJSON = () => {
    const payload = { pnjs, caravane: caravan };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = `EcoNom_Gen_vite_${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">EcoNom – Générateur (Vite)</h1>
            <p className="text-neutral-400 mt-1">PNJ + Caravane. Doublons autorisés. Seed = génération déterministe.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={reroll} className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15">Relancer</button>
            <button onClick={copyJSON} className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15">Copier JSON</button>
            <button onClick={exportJSON} className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15">Exporter JSON</button>
            <button onClick={()=>window.print()} className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 print:hidden">Imprimer</button>
          </div>
        </header>

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

        <section className="mb-8">
          <CaravanePanel car={caravan} />
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 print:grid-cols-1">
          {pnjs.map(p=> <PNJCard key={p.id} pnj={p} />)}
        </section>

        <footer className="text-center text-neutral-500 text-xs mt-8">
          <p>Recto = Présentation | Verso = Infos mécaniques. Titres avec articles corrects (« du », « de la », « de l’ », « des »).</p>
        </footer>
      </div>
    </div>
  );
}
