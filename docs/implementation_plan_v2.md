# SUUNTOPO — Implementation Plan

## Cél (Best Case Scenario)

Egy interaktív mászótopo-megjelenítő a Suunto Race S (és kompatibilis Suunto) órákra,
SuuntoPlus Sports App formájában.

### Mit csinál

1. **Topo megjelenítés az órán**: A mászóút teljes topója megjelenik a 466×466 px-es
   kijelzőn, bezoomolva. A felhasználó az útvonal mentén navigál anchor-ról anchor-ra
   (pushButton up/down gombokkal). A fókusz az útvonal vonalát követi — nem feltétlenül
   vertikálisan, hanem ahogy a mászóút halad.

2. **Sziklajellegzetességek**: A topo nem csak vonal + anchorok, hanem a szikla
   jellegzetességei is látszanak (repedések, túlhajlások, párkányok, falkontúr stb.)
   — pontosan úgy ahogy egy rajzolt vagy fotó topón látszanának.

3. **Kötélhossz-információk**: Minden pitch-hez tartozó szöveges infó (fokozat,
   hossz, kulcsmozdulatok, megjegyzések) elérhető egy al-nézetként — lap gombbal
   vagy pushButton-nel váltható a topo és az infó nézet között.

4. **Több topo az órán**: Az órára szinkronizálható több topo (pl. 10), és a felhasználó
   workout indítás előtt vagy közben kiválasztja az aktuálisat.

5. **Topo-szerkesztő webapp**: Egy böngészős alkalmazás ahol a felhasználó:
   - Betölt egy topo képet (fotó vagy rajzolt)
   - Rárajzolja az útvonalat, jelöli az anchorokat, hozzáadja a sziklajellegzetességeket
   - Megadja a pitch-enkénti szöveges infókat
   - Az app legenerálja a digitális topo formátumot amit az óra megjelenít

6. **Szinkronizálás**: A webapp-ból az órára juttatás módja (USB deploy, data.json
   settings sync a Suunto mobil app-on keresztül, vagy app rebuild).

---

## Megerősített platform képességek

A SuuntoPlus Editor developer reference és példa appok feltárása után a következő
képességek **megerősítettek**:

### Renderelés

| Képesség | Státusz | Részletek |
|---|---|---|
| `<canvas>` elem | **MEGERŐSÍTETT** | Teljes drawing API: beginPath, moveTo, lineTo, arc, arcTo, stroke, fill, fillRect, fillText, measureText, rotate, translate, scale, setTransform. **Frissítés: `control('#id', 'REFRESH')` szükséges minden rajzolás után!** Csak hex színek működnek (#FFF, #FFFFFF, #FFFFFFFF). Shadows, gradients, patterns NEM elérhetők. |
| `<img>` tag | **MEGERŐSÍTETT** | PNG only, max 64 szín, max 2 kép per app, manifest-ben deklarálandó: `"image": [{"name": "logo.png", "type": "a64"}]` |
| HTML/CSS elemek | **MEGERŐSÍTETT** | div, span, stb. inline style-lal. `setStyle(selector, property, value)` működik JS-ből |
| `<uiViewSet>` | **MEGERŐSÍTETT** | Beépített carousel nézet-váltás transition animációval. Navigáció: `next()`, `previous()`, `first()`, `last()`, `navigate(target, index)` (közvetlen ugrás). Események: onSelectionChanged, onIdle, onWakeUp |

### Input / Navigáció

| Képesség | Státusz | Részletek |
|---|---|---|
| `<pushButton>` | **MEGERŐSÍTETT** | **5 fizikai gomb**: up, next, down, upleft, downleft. Események: onClick, onLongPress, onLongPressStart, onLongPressFull, onLongPressCancel, onButtonEvent. `onClick` → `$.put('/Zapp/{zapp_index}/Event', id)` → `onEvent(input, output, eventId)` |
| Touch events | **MEGERŐSÍTETT** | `onTap`, `onDoubleTap`, `onLongTapStart` — de magasabb akkufogyasztás |
| Lap gomb | **MEGERŐSÍTETT** | `onLap(input, output)` callback |
| Template váltás | **MEGERŐSÍTETT** | `unload('_cm')` kikényszeríti `getUserInterface()` újrahívását → dinamikus template váltás |

### Adattárolás

| Képesség | Státusz | Részletek |
|---|---|---|
| `localStorage` | **MEGERŐSÍTETT** | `setItem(key, value)`, `getItem(key)`, `setObject(key, obj)`, `getObject(key)` — workout-ok között megmarad |
| `data.json` | **MEGERŐSÍTETT** | Read-only az app JS-ből. Suunto mobil app "My Apps" nézetéből konfigurálható, auto-sync az órára. Manifest `settings` tömb definiálja (int/float/string/boolean/enum típusok) |
| App-ba csomagolt fájlok | **MEGERŐSÍTETT** | manifest.json + main.js + HTML templates + max 2 PNG + külső JS fájlok (`ext0.js`, `ext1.js`, stb.) betölthetők `evalFile()`-lal |

### Egyéb

| Képesség | Státusz | Részletek |
|---|---|---|
| Display ID | **MEGERŐSÍTETT** | `q` = 466×466 px (Race, Race 2, Vertical 2, Ocean) |
| JavaScript | **ES5** | Nincs Date object, nincs sessionStorage. Van: Int8Array, Uint8Array, Float32Array. **Custom függvények `var fn = function() {}` szintaxissal** — `function fn() {}` a platform callbackoknak van fenntartva. |
| Callbacks | **MEGERŐSÍTETT** | `evaluate()` (~1s), `onLoad()`, `onExerciseStart/Pause/Continue/End()`, `onLap()`, `onAutoLap()`, `onEvent()`, `getUserInterface()`, `getSummaryOutputs()`, `onAccelerometer()` |
| Resource system | **MEGERŐSÍTETT** | `$.subscribe(path, callback)`, `$.put(path, value, callback, typeSpecifier)`, `$.get(path, callback)` |
| Limitek | **MEGERŐSÍTETT** | Max 10 input resource, max 25 output resource (max 5 logged), max 2 kép, max 15 app az órán. Memória hibák: `Zapp: releaseMemoryCb (exec. zapp)` = JS kimerült, `(exec. ui)` = HTML kimerült |

---

## Architektúra áttekintés

```
┌─────────────────────┐         ┌──────────────────────┐
│   Webapp (Editor)   │         │  Suunto Watch App    │
│                     │         │  (SuuntoPlus)        │
│  Topo kép betöltés  │         │                      │
│  Útvonal rajzolás   │  ───►   │  Canvas topo rajz    │
│  Anchor jelölés     │  JSON   │  pushButton navigáció│
│  Feature rajzolás   │  adat   │  Pitch info nézet    │
│  Pitch info szöveg  │         │  Topo választó       │
│  Export             │         │                      │
└─────────────────────┘         └──────────────────────┘
```

A watch app "buta megjelenítő" — a webapp végzi az összes intelligens munkát.
Az óra egy előre elkészített adat-csomagot kap és megjeleníti.

---

## Megvalósítási megközelítések

A developer reference feltárása alapján a **`<canvas>` elem** a legígéretesebb
renderelési mód. A korábban tervezett megoldások újraértékelése:

### A megoldás — Canvas vektor topo (ELSŐDLEGES)

**Koncepció**: A webapp a topo-t vektor formátumba konvertálja (koordináták + rajz
parancsok JSON-ben). Az óra `<canvas>` elemre rajzolja a topót a natív drawing API-val,
és `translate()` / `scale()` műveletekkel navigál anchor-ról anchor-ra.

**Hogyan működik**:
1. A webapp-ban a user betölti a topo képet és rárajzol mindent:
   - Útvonal vonala (polyline koordináták)
   - Anchor pontok (pozíció + pitch infó)
   - Sziklajellegzetességek (kontúr vonalak, szimbólumok, jelölések)
2. Az export egy JSON adatstruktúrát generál (rajz parancsok koordinátákkal)
3. Az óra `<canvas>` elemre rajzolja az egész topót
4. Navigációkor `translate()` tolja a canvas origin-t hogy az aktuális anchor
   a képernyő közepére kerüljön, `scale()` a zoom szinthez

**Topo adatformátum** (minden szín hex formátumban — named colors NEM működnek az órán!):
```json
{
  "name": "Tupá, SZ stena, Tupa Bleda",
  "width": 1000,
  "height": 3000,
  "anchors": [
    {
      "id": 1,
      "x": 230, "y": 1800,
      "grade": "II.",
      "length": "25m",
      "info": "Könnyű repedés mentén egyenesen fel..."
    },
    {
      "id": 2,
      "x": 245, "y": 1500,
      "grade": "III.",
      "length": "30m",
      "info": "Jobbra a párkányon át..."
    }
  ],
  "route": [
    [230, 2000], [230, 1800], [245, 1500], [260, 1100]
  ],
  "features": [
    {"type": "crack", "points": [[225, 1900], [225, 1700]]},
    {"type": "overhang", "line": [[200, 1400], [290, 1400]]},
    {"type": "ledge", "line": [[180, 1200], [300, 1200]]},
    {"type": "contour", "points": [[...], [...]]}
  ]
}
```

**Óra-oldali renderelés** (main.js vázlat):
```javascript
// ABOUTME: Canvas-ra rajzolja a topót és kezeli a navigációt
// ABOUTME: A topo adatokat JSON-ből tölti be, anchor-ról anchor-ra navigál

var topo = { /* beégetett vagy evalFile()-ból */ };
var currentAnchor = 0;
var needsRedraw = true;

// Custom függvények KÖTELEZŐEN var szintaxissal!
var drawTopo = function(ctx) {
  ctx.save();
  // viewport pozicionálás az aktuális anchor-ra
  var a = topo.anchors[currentAnchor];
  ctx.translate(233 - a.x, 233 - a.y); // 233 = 466/2, képernyő közepe

  // sziklajellegzetességek rajzolása
  ctx.strokeStyle = '#666666'; // CSAK hex színek működnek!
  for (var f = 0; f < topo.features.length; f++) {
    drawFeature(ctx, topo.features[f]);
  }

  // útvonal rajzolása
  ctx.strokeStyle = '#FF0000';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(topo.route[0][0], topo.route[0][1]);
  for (var i = 1; i < topo.route.length; i++) {
    ctx.lineTo(topo.route[i][0], topo.route[i][1]);
  }
  ctx.stroke();

  // anchor-ok rajzolása
  for (var j = 0; j < topo.anchors.length; j++) {
    var anc = topo.anchors[j];
    ctx.beginPath();
    ctx.arc(anc.x, anc.y, 8, 0, 2 * Math.PI);
    ctx.fillStyle = j === currentAnchor ? '#FFFF00' : '#FFFFFF';
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(anc.grade, anc.x + 12, anc.y + 4);
  }

  ctx.restore();
  // KRITIKUS: canvas REFRESH nélkül a rajz nem jelenik meg!
  control('#topo-canvas', 'REFRESH');
};

// Platform callback — function kulcsszóval
function onEvent(input, output, eventId) {
  if (eventId === 1) { // up button → következő anchor
    if (currentAnchor < topo.anchors.length - 1) currentAnchor++;
    needsRedraw = true;
  } else if (eventId === 2) { // down button → előző anchor
    if (currentAnchor > 0) currentAnchor--;
    needsRedraw = true;
  } else if (eventId === 3) { // next button (crown press) → nézet váltás
    changeView('info');
  }
}

// evaluate() ~1/s — itt hívjuk a canvas újrarajzolást
function evaluate(input, output) {
  if (needsRedraw) {
    var canvas = /* canvas context */;
    drawTopo(canvas);
    needsRedraw = false;
  }
}
```

**Előnyök**:
- **Natív API** — a `<canvas>` drawing a legerősebb renderelési mód az órán
- **Kis fájlméret** — JSON koordináták, nem pixelek
- **Rugalmas zoom/pan** — `translate()` + `scale()` a canvas transform API-val
- **Sziklajellegzetességek** rajzolhatók vonalakkal, ívekkel, szimbólumokkal
- **Nincs 2 kép limit** — minden rajzolt, nem kép
- **Dinamikus kiemelés** — aktuális anchor, aktuális pitch vizuálisan jelölhető
- **Skálázható** bármilyen kijelzőre (466×466 → 280×280 is megy)
- **Szinkronizálható** — a topo adat JSON, mehet data.json-on vagy localStorage-on keresztül

**Hátrányok**:
- Canvas **teljesítménye és memória korlátja ismeretlen** komplex rajznál (sok feature elem)
- A sziklajellegzetességek **vektor rajza vizuálisan szegényebb** mint egy fotó/kézzel rajzolt topo
- A webapp topo-editor fejlesztése **komolyabb munka** (drawing editor)
- **Csak hex színek** — a webapp exportnak kizárólag hex formátumot szabad generálnia
- ES5 JavaScript — nincs arrow function, nincs template literal, nincs destructuring
- **Canvas REFRESH szükséges** — `control('#id', 'REFRESH')` nélkül a rajz nem jelenik meg

**Kockázat**: ALACSONY-KÖZEPES — a canvas API megerősített, a kérdés a teljesítmény és memória

---

### B megoldás — Háttérkép + Canvas overlay (HIBRID)

**Koncepció**: Az eredeti topo kép (fotó vagy kézzel rajzolt) mint háttér PNG,
a `<canvas>` rajzolja rá az interaktív elemeket (útvonal, anchorok, kiemelés).

**Hogyan működik**:
1. A webapp-ból export: egy optimalizált PNG háttér (64 szín, grayscale) + JSON az
   interaktív elemekhez
2. Az óra megjeleníti a PNG hátteret + a canvas-ra rajzolja az útvonalat és anchorokat
3. Navigáció: a háttérkép fix (vagy HTML `setStyle` pozícionálással mozgatható),
   a canvas overlay követi az aktuális anchor-t

**Korlátozás**: Max 2 kép per app → max 2 topo háttérkép. Ha egy topo hosszabb mint
amit egyetlen 466×466 kép lefed, a háttérképet a legfontosabb szeletként kell
használni, a rest-et canvas-szal rajzolni.

**Előnyök**:
- **Vizuálisan gazdagabb** — az eredeti topo kép megjelenik
- A 64 színes PNG **tökéletes grayscale-hez** (szikla textúra)
- Az interaktív elemek (útvonal, anchor kiemelés) a canvas-on dinamikusak

**Hátrányok**:
- **Max 2 kép** — erősen limitálja a több-topo forgatókönyvet
- **Nem skálázható** — a háttérkép fix felbontású
- **Pan/zoom bonyolultabb** — a PNG-t és a canvas-t szinkronban kell mozgatni
- **Szinkronizálás nehézkes** — a PNG az app csomagban van, nem frissíthető data.json-ból

**Kockázat**: KÖZEPES — a kép renderelés megerősített, de a 2 kép limit és a
koordináció a canvas-szal bonyolítja

**Mikor válasszuk**: Ha a Fázis 1 prototípus azt mutatja, hogy a pure canvas
vizuálisan túl szegény és szükség van fotó/kézzel rajzolt háttérre.

---

### C megoldás — Pre-renderelt szelet-képek (FALLBACK)

**Koncepció**: A webapp a topo-t anchor-központú szeletekre vágja (466×466 px
PNG-k), az óra csak képeket jelenít meg és lépked köztük.

**Korlátozás**: Max 2 kép per app teszi ezt **gyakorlatilag használhatatlanná**
több szelethez. Egyetlen overview kép lehetséges, de az nem elég egy teljes
interaktív topóhoz.

**Kockázat**: MAGAS — a 2 kép limit gyakorlatilag kizárja ezt a megoldást
önmagában. Csak mint kiegészítő használható (pl. overview kép a topo választó
nézetben).

---

## Összehasonlítás

| Szempont | A (Canvas vektor) | B (Kép + Canvas) | C (Szelet képek) |
|---|---|---|---|
| Óra-oldali komplexitás | Közepes | Magas | Alacsony |
| Webapp komplexitás | Magas | Magas | Alacsony |
| Vizuális minőség | Jó (vektor) | Legjobb (fotó+vektor) | Legjobb (fotó) |
| Memória használat | Alacsony (JSON) | Közepes (1 PNG+JSON) | Magas (de max 2 PNG) |
| Platform kockázat | Alacsony | Közepes | Magas (2 kép limit) |
| Sziklajellegzetességek | Vektor rajz | Fotóból + overlay | Fotóból |
| Több topo support | Jó (JSON csere) | Korlátozott (2 kép) | Nem megoldható |
| Szinkronizálhatóság | Jó (data.json/localStorage) | Korlátozott | Nincs |
| Skálázhatóság | Rugalmas | Fix kép | Fix kép |

**Ajánlás**: **A megoldás (Canvas vektor) az elsődleges irány.** Ha a vizuális
minőség nem elég → B megoldás (hibrid) kiegészítésként egy áttekintő háttérképpel.

---

## Ajánlott stratégia

### Fázis 0 — Canvas prototípus (1. hét)
> Az egyetlen kritikus ismeretlen: canvas teljesítmény

A legtöbb korábbi nyitott kérdés **megválaszolva** a developer reference-ből.
Ami maradt:

**Tesztelendő**:
- [ ] **Canvas rajzolás + REFRESH**: Működik-e `control('#id', 'REFRESH')`?
      Hány rajz parancsot bír a canvas? (10, 50, 200 feature)
- [ ] **Canvas + translate/scale**: Működik-e a viewport eltolás és zoom?
- [ ] **Canvas memória limit**: Mikor kapunk `Zapp: releaseMemoryCb` hibát?
- [ ] **Canvas újrarajzolás sebessége**: Navigate-kor újrarajzolás elég gyors-e?
- [ ] **data.json méret limit**: Mekkora JSON struktúra fér el a settings-ben?
- [ ] **App csomag méret limit**: Mekkora .fea/.dev fájlt bír el az óra?
- [ ] **evalFile() teszt**: Külső JS fájl betöltése on-demand működik-e?

**Teszt app**: Egy hardcoded canvas topo — 1 mászóút, 3-4 anchor, pár
sziklajellegzetesség (repedés, párkány, falkontúr). pushButton up/down navigálás
anchor-ról anchor-ra, pushButton next (crown) nézet váltás.

### Fázis 1 — Működő prototípus (2-3. hét)
> Hardcoded topo az órán, teljes navigáció

A Fázis 0 eredményei alapján:

- 1-2 példa topo az `example_topo/` mappából, kézzel konvertálva canvas rajz
  parancsokká
- **Navigáció**: pushButton up/down az anchorok között
- **Pitch info nézet**: pushButton `next` (crown press) → template váltás
  (`unload('_cm')` + `getUserInterface()`). Lap gomb szabadon marad a workout-hoz.
- **Aktuális anchor kiemelés**: sárga/piros szín, nagyobb méret
- **Zoom szint**: az anchor környékét mutatja, elég kontextussal
- Ha B megoldás kell → háttérkép + canvas overlay tesztelése
- **Nincs webapp, nincs szinkronizálás** — minden hardcoded a main.js-ben

### Fázis 2 — Topo választó + több topo (4. hét)
> Az app több topót kezel

- **Topo-választó nézet**: Indításkor lista a topókból (canvas-szal rajzolt lista,
  vagy HTML template a nevekkel)
- **Topo adatok betöltése `evalFile()`-lal**: Minden topo külön `ext{n}.js` fájl →
  on-demand betöltés → nincs memória overhead az összes topo-ból egyszerre.
  Példa: `var topoData = evalFile('{file_path}/ext' + topoIndex + '.js');`
- Topo-csomag formátum véglegesítés (JSON struktúra)
- **pushButton navigáció**: up/down a listán, next (crown) a kiválasztás
- **uiViewSet** tesztelése: `navigate('#vs', index)` közvetlen ugrás a kiválasztott
  topo nézetére (nem kell `next()` ismétlés)

### Fázis 3 — Webapp editor (5-8. hét)
> A felhasználó maga készíti a topókat

- Webapp: topo kép betöltés (fotó vagy rajzolt)
- Rajzoló felület: útvonal, anchorok, sziklajellegzetességek
- Szimbólum könyvtár: repedés, túlhajlás, párkány, kéményszerű hasadék, stb.
- Pitch info szerkesztő
- **Export**: JSON adat-csomag a véglegesített formátumban
- Manuális deploy (letöltés → data.json frissítés a Suunto mobil app-ban,
  vagy app rebuild + USB deploy)

### Fázis 4 — Szinkronizálás (9+. hét)
> Webapp → Óra automatikus szinkronizálás

**Legígéretesebb lehetőségek** (a megerősített platform képességek alapján):

| Opció | Megvalósíthatóság | Részletek |
|---|---|---|
| `data.json` settings sync | **MAGAS** | Webapp → Suunto mobil app "My Apps" settings → auto-sync órára. A topo JSON a settings-ben. Méret limit tesztelendő (Fázis 0). |
| `evalFile()` + app rebuild | **MAGAS** | Minden topo külön `ext{n}.js` fájlként → on-demand betöltés. Webapp generálja az ext fájlokat → rebuild → deploy. Memória-hatékony (egy topo a memóriában egyszerre). |
| `localStorage` + manuális import | **MAGAS** | Webapp generál JSON-t → user bemásolja → app betölti. Nem elegáns de működik. |
| App rebuild + USB | **BIZTOSAN MŰKÖDIK** | A webapp generálja az új main.js-t a friss topo adatokkal → rebuild → deploy. Kényelmetlen. |
| Guides Cloud API | **LEHETSÉGES** | Szöveges pitch infó kiegészítésként — de vizuális topo-hoz nem alkalmas (nincs custom grafika). |

---

## Bottleneck analízis

### 1. Fókusz mozgatása (anchor-ról anchor-ra navigáció)

| Kérdés | Státusz |
|---|---|
| Van-e input a navigációhoz? | **MEGOLDVA** — pushButton up/down + onEvent() |
| Működik-e viewport eltolás? | **MEGOLDVA** — canvas translate() megerősített |
| Van-e animáció lehetőség? | **MEGOLDVA** — uiViewSet transition, vagy manuális canvas újrarajzolás |
| Elég gyors-e a canvas újrarajzolás? | **TESZTELENDŐ** (Fázis 0) |

**Megoldás**: pushButton up → `currentAnchor++` → canvas újrarajzolás
`translate()` az új anchor pozícióra.

### 2. Topo renderelés

| Kérdés | Státusz |
|---|---|
| Van-e rajzolási API? | **MEGOLDVA** — `<canvas>` teljes drawing API |
| PNG megjelenítés? | **MEGOLDVA** — igen, de max 2 kép, max 64 szín |
| Hány rajz parancsot bír a canvas? | **TESZTELENDŐ** (Fázis 0) |
| Maximális adat-csomag méret? | **TESZTELENDŐ** (Fázis 0) |

**Fallback**: Ha a canvas túl lassú sok feature-rel → egyszerűsített rajz
(csak útvonal + anchorok + grade szöveg, jellegzetességek nélkül).

### 3. Szöveges infó megjelenítése

| Kérdés | Státusz |
|---|---|
| Tud-e az app nézetet váltani? | **MEGOLDVA** — `unload('_cm')` + `getUserInterface()` |
| `onLap()` megbízhatóan működik? | **MEGOLDVA** — megerősített callback |
| pushButton long-press? | **MEGOLDVA** — `<pushButton>` onClick esemény konfigurálható |

**Megoldás**: Lap gomb vagy pushButton → `unload('_cm')` → `getUserInterface()`
visszaadja az info template-et → az info nézet megjelenik a pitch adatokkal.

### 4. Adat fájlok létrehozása

**Fázis 1**: Kézzel készített JSON a main.js-be beégetve — nem bottleneck.

**Fázis 3**: Webapp editor — a legnagyobb fejlesztési munka, de standard web tech.
A `<canvas>` drawing API tükrözhető: a webapp-ban canvas-ra rajzol a user,
az export a rajz parancsokat JSON-ként menti → az óra-oldali canvas reprodukálja.
Ez a **szimmetria** a webapp és watch app között csökkenti a komplexitást.

### 5. Topo kiválasztás az órán

| Kérdés | Státusz |
|---|---|
| Dinamikus template-váltás? | **MEGOLDVA** — `unload('_cm')` + `getUserInterface()` |
| pushButton navigáció a listán? | **MEGOLDVA** — up/down gombok + onEvent() |
| Több topo tárolás? | **MEGOLDVA** — localStorage.setObject() + beégetett JS |

**Megoldás**: Induláskor topo-választó nézet (canvas-szal rajzolt lista vagy
HTML template). pushButton up/down a kiválasztáshoz, tap/lap a megerősítéshez.
A kiválasztott topo betöltődik a fő nézetbe.

### 6. Szinkronizálás (webapp → óra)

| Kérdés | Státusz |
|---|---|
| data.json auto-sync? | **MEGOLDVA** — Suunto mobil app → óra, automatikus |
| data.json méret limit? | **TESZTELENDŐ** (Fázis 0) — ez a kritikus kérdés |
| localStorage méret limit? | **TESZTELENDŐ** (Fázis 0) |

**Ha data.json elég nagy** (pl. >50KB): A webapp generálja a topo JSON-t →
a user a Suunto mobil app "My Apps" settings-ben beilleszti (vagy a webapp
automatikusan frissíti ha van API hozzáférés) → auto-sync az órára.

**Ha data.json túl kicsi**: App rebuild szükséges az új topo adatokkal,
vagy localStorage-ba manuális import.

---

## Megerősített input séma

Az óra **5 pushButton + lap + touch** bemenetet biztosít az app-nak:

### pushButton gombok (5 db)

| pushButton name | Fizikai gomb | Események |
|---|---|---|
| `up` | Felső jobb gomb | onClick, onLongPress, onLongPressStart, onLongPressFull, onLongPressCancel |
| `next` | Crown nyomás (középső jobb) | onClick, onLongPress, stb. |
| `down` | Alsó jobb gomb | onClick, onLongPress, stb. |
| `upleft` | Felső bal gomb | Nem minden modellen elérhető |
| `downleft` | Alsó bal gomb | Nem minden modellen elérhető |

### SUUNTOPO gomb kiosztás

| Input | Trigger | Felhasználás |
|---|---|---|
| pushButton **up** click | Felső gomb rövid nyomás | Navigáció: következő anchor (felfelé a falon) |
| pushButton **up** long press | Felső gomb hosszú nyomás | Zoom in |
| pushButton **down** click | Alsó gomb rövid nyomás | Navigáció: előző anchor (lefelé) |
| pushButton **down** long press | Alsó gomb hosszú nyomás | Zoom out |
| pushButton **next** click | Crown nyomás | **Nézet váltás** (topo ↔ pitch info) |
| **Lap** gomb | `onLap()` callback | Normál lap-marking funkció (nem foglaljuk el!) |
| **Tap** | Érintőképernyő | Kiegészítő input (pl. topo választó megerősítés) |

**Megjegyzés**: A crown *scroll* (tekerés) valószínűleg NEM elérhető az app számára —
az OS használja a display-ek közötti navigációhoz. De a crown *nyomás* (`pushButton
name="next"`) elérhető és ideális a nézet váltáshoz. A lap gombot meghagyjuk az
eredeti workout funkciónak — így a mászó közben is tud lapot jelölni.

---

## Nyitott kérdések (csökkentett lista)

A legtöbb korábbi kérdés megválaszolva. Ami maradt:

1. **Canvas teljesítmény + memória**: Hány draw call-t bír az óra mielőtt lassul
   vagy `releaseMemoryCb` hibát dob? Ez határozza meg a topo részletességet.
2. **data.json méret limit**: Ha elég nagy → szinkronizálás megoldva. Ha kicsi →
   `evalFile()` + app rebuild lesz a megoldás.
3. **App csomag méret limit**: A community ~200KB-os limitet jelzett — ez megerősítendő.
   A canvas-alapú megoldásnál kisebb csomag kell (JSON, nem PNG-k).
4. **Canvas + kép együtt**: Ha B megoldás (hibrid) kell, a `<canvas>` és `<img>`
   egymásra rétegezhetők-e? (z-index, absolute positioning)
5. **evalFile() megbízhatósága**: A külső JS fájl betöltés mennyire stabil?
   Topo váltáskor a régi topo memóriája felszabadul-e?

---

## A phase0_test_plan.md frissítése

A korábbi 9 teszt közül a legtöbb **megválaszolva** a developer reference-ből:

| Korábbi teszt | Státusz | Részletek |
|---|---|---|
| #1 Kép megjelenítés | **MEGVÁLASZOLVA** | PNG támogatott, max 2 kép, max 64 szín |
| #2 CSS viewport eltolás | **RÉSZBEN MEGVÁLASZOLVA** | `setStyle()` megerősített, de canvas `translate()` jobb megoldás |
| #3 CSS transition | **MEGVÁLASZOLVA** | `uiViewSet` transition támogatott |
| #4 HTML elem limit | **IRRELEVÁNS** | Canvas-alapú megoldásnál nem sok HTML elem kell |
| #5 Template váltás | **MEGVÁLASZOLVA** | `unload('_cm')` + `getUserInterface()` működik |
| #6 data.json olvasás | **RÉSZBEN MEGVÁLASZOLVA** | API ismert (manifest settings), méret limit nem |
| #7 Persistent storage | **MEGVÁLASZOLVA** | `localStorage.setItem/getItem/setObject/getObject` |
| #8 Csomag méret limit | **TESZTELENDŐ** | Továbbra is nyitott |
| #9 setStyle JS-ből | **MEGVÁLASZOLVA** | Igen, megerősített. De canvas `translate()` jobb megoldás a topóhoz. |

**Fázis 0 csökkentett teszt-lista** (5 teszt a korábbi 9 helyett):
1. **Canvas teljesítmény teszt** — rajzolj egy komplex topót (30+ feature) és mérd a reakcióidőt.
   Ellenőrizd: `control('#id', 'REFRESH')` működik-e, translate/scale működik-e.
2. **Canvas memória stressz teszt** — növeld a feature-ök számát amíg `Zapp: releaseMemoryCb`
   hibát kapsz. Figyeld: `(exec. zapp)` = JS memória, `(exec. ui)` = HTML memória.
3. **data.json méret teszt** — tegyél 10KB, 50KB, 200KB JSON-t a settings-be
4. **App csomag méret teszt** — építs 100KB, 500KB, 1MB méretű appot
5. **evalFile() teszt** — topo adat betöltése külső `ext0.js` fájlból on-demand
