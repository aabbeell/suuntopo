# Fázis 0 — Teszterv

## Előfeltétel

1. VS Code telepítve
2. SuuntoPlus Editor `.vsix` telepítve (https://apizone.suunto.com/suuntoplusEditor)
3. Suunto Race S csatlakoztatva USB-n vagy BT-n
4. Futtatni: `SuuntoPlus: Open Documentation` — átolvasni a teljes API reference-t
5. Futtatni: `SuuntoPlus: Open Examples` — megnézni a beépített példákat,
   különösen a **climbing tracker**-t (ha van benne kép vagy komplex UI, az sokat elárul)

---

## Megerősített build info

A SuuntoPlus build process explicit lépései:
1. Minify `main.js` (kommentek, whitespace eltávolítás, változónevek rövidítés)
2. **HTML és kép fájlok konvertálása óra-kompatibilis formátumba**
3. Csomagolás tömörítetlen ZIP-be (`.fea` vagy `.dev`)

A 2. lépés megerősíti hogy kép fájlok a build pipeline részei — valamilyen
formában a képmegjelenítés szinte biztosan támogatott. A kérdés már csak az,
hogy milyen méretben/formátumban és hogyan hivatkozhatóak a HTML-ből.

---

## Teszt #1 — Kép megjelenítés

**Vakfolt**: Tud-e az óra PNG-t renderelni HTML template-ben? (Valószínűleg IGEN,
a build process konvertálja a képeket.)

**Teszt app** (`test_image`):
```
manifest.json
main.js
t.html
test_image.png   (egy egyszerű, kis méretű topo részlet, ~50KB)
```

**manifest.json**:
```json
{
  "name": "Test Image",
  "description": "Image rendering test",
  "author": "Vitya",
  "version": "1.00",
  "modificationTime": 1710400000,
  "type": "feature",
  "usage": "workout",
  "template": [{"name": "t.html"}]
}
```

**main.js**:
```javascript
function getUserInterface() { return {template: 't'}; }
```

**t.html** — 3 módszert tesztelünk egyszerre:
```html
<uiView>
  <div id="suuntoplus" style="width:100%;height:100%;background-color:#000000;">
    <!-- Módszer 1: img tag -->
    <img src="test_image.png" style="width:80%;height:auto;" />

    <!-- Módszer 2: CSS background-image -->
    <div style="width:80%;height:40%;background-image:url('test_image.png');
         background-size:contain;background-repeat:no-repeat;">
    </div>

    <!-- Módszer 3: szöveges fallback indikátor -->
    <div style="color:#FFFFFF;font-size:20px;">IMG TEST</div>
  </div>
</uiView>
```

**Elvárt kimenet**:
- ✅ **LEGJOBB**: mindkét kép megjelenik → A/C2 megoldás lehetséges
- ⚠️ **RÉSZLEGES**: csak az egyik módszer működik → arra építünk
- ❌ **WORST**: egyik sem jelenik meg, csak a szöveg → vektor-only irány (B/C1)

---

## Teszt #2 — CSS viewport eltolás

**Vakfolt**: Működik-e `setStyle()` + position offset + `overflow:hidden`?

**Teszt app** (`test_viewport`):

**t.html**:
```html
<uiView>
  <div id="viewport" style="width:100%;height:100%;overflow:hidden;position:relative;">
    <div id="canvas" style="position:absolute;top:0px;left:0px;width:100%;height:300%;">
      <!-- 3 szekció, különböző színekkel -->
      <div style="width:80%;height:33%;background-color:#FF0000;margin:0 auto;">
        <div style="color:#FFFFFF;font-size:24px;">SECTION 1</div>
      </div>
      <div style="width:80%;height:33%;background-color:#00FF00;margin:0 auto;">
        <div style="color:#000000;font-size:24px;">SECTION 2</div>
      </div>
      <div style="width:80%;height:33%;background-color:#0000FF;margin:0 auto;">
        <div style="color:#FFFFFF;font-size:24px;">SECTION 3</div>
      </div>
    </div>
  </div>
</uiView>
```

**main.js**:
```javascript
var currentSection = 0;
var offsets = ['0px', '-100%', '-200%'];

function getUserInterface() { return {template: 't'}; }

// Ha a tap event-ből hívható JS függvény:
// onTap="moveNext()" a HTML-ben
```

**t.html (interaktív verzió)** — a div-re rakunk tap handler-t:
```html
<uiView>
  <div id="viewport" style="width:100%;height:100%;overflow:hidden;position:relative;"
       onTap="setStyle('#canvas','top','-100%')"
       onDoubleTap="setStyle('#canvas','top','0px')">
    <div id="canvas" style="position:absolute;top:0px;left:0px;width:100%;height:300%;">
      <div style="width:80%;height:33%;background-color:#FF0000;">
        <div style="color:#FFFFFF;font-size:24px;">SEC 1 - tap to move</div>
      </div>
      <div style="width:80%;height:33%;background-color:#00FF00;">
        <div style="color:#000000;font-size:24px;">SEC 2</div>
      </div>
      <div style="width:80%;height:33%;background-color:#0000FF;">
        <div style="color:#FFFFFF;font-size:24px;">SEC 3</div>
      </div>
    </div>
  </div>
</uiView>
```

**Elvárt kimenet**:
- ✅ **LEGJOBB**: `overflow:hidden` vág, `setStyle top` mozgatja → B megoldás működik!
- ⚠️ **RÉSZLEGES**: `overflow:hidden` nem vág de `setStyle` működik → workaround keresés
- ❌ **WORST**: `setStyle` nem mozgat pozíciót → szegmentált nézetek (A megoldás)

---

## Teszt #3 — CSS transition (animáció)

**Vakfolt**: Animálható-e a pozícióváltás?

**t.html** — Teszt #2 módosítása transition-nel:
```html
<uiView>
  <div id="viewport" style="width:100%;height:100%;overflow:hidden;position:relative;">
    <div id="canvas" style="position:absolute;top:0px;left:0px;width:100%;height:300%;
         transition:top 0.3s ease;"
         >
      <!-- ... same sections ... -->
    </div>
  </div>
</uiView>
```

Tap handler: `onTap="setStyle('#canvas','top','-100%')"`

**Elvárt kimenet**:
- ✅ Sima animáció a szekciók között → C megoldás lehetséges
- ❌ Ugrik animáció nélkül → nem gond, azonnali váltás is OK

---

## Teszt #4 — HTML elem limit

**Vakfolt**: Hány div-et bír az óra mielőtt lassul?

**Teszt app** (`test_elements`):

Generálunk egy HTML-t egyre több elemmel és mérjük a reakcióidőt.

**t_10.html** — 10 div (alap)
**t_50.html** — 50 div
**t_100.html** — 100 div
**t_200.html** — 200 div

Minden div:
```html
<div style="width:10px;height:10px;background-color:#FF0000;
     position:absolute;left:XXpx;top:YYpx;border-radius:50%;">
</div>
```

A `main.js`-ben `getUserInterface()` mindig a következő template-et adja vissza
(ha template váltás működik), vagy csinálunk 4 külön appot.

**Elvárt kimenet**:
- Megtudjuk az elem limit-et (< 50 = probléma, 50-100 = OK, > 100 = bőven elég
  komplex topóhoz sziklajellegzetességekkel)

---

## Teszt #5 — Template váltás (nézet váltás)

**Vakfolt**: Tud-e az app futás közben template-et váltani?

**Teszt app** (`test_switch`):

**manifest.json** — 2 template:
```json
{
  "name": "Test Switch",
  "description": "Template switching test",
  "author": "Vitya",
  "version": "1.00",
  "modificationTime": 1710400000,
  "type": "feature",
  "usage": "workout",
  "template": [{"name": "topo.html"}, {"name": "info.html"}]
}
```

**topo.html**:
```html
<uiView>
  <div style="width:100%;height:100%;background-color:#222222;">
    <div style="color:#FF0000;font-size:30px;">TOPO VIEW</div>
  </div>
</uiView>
```

**info.html**:
```html
<uiView>
  <div style="width:100%;height:100%;background-color:#002244;">
    <div style="color:#FFFFFF;font-size:20px;">
      Pitch 1: III.\nRepedés mentén\n25m
    </div>
  </div>
</uiView>
```

**main.js**:
```javascript
var showTopo = true;

function getUserInterface() {
  return {template: showTopo ? 'topo' : 'info'};
}

function onLap(input, output) {
  showTopo = !showTopo;
}
```

**Elvárt kimenet**:
- ✅ Lap gomb megnyomásra vált a két nézet között → pitch info megoldva!
- ❌ Nem vált → fallback: info overlay a topo nézeten belül

---

## Teszt #6 — data.json olvasás

**Vakfolt**: Hogyan olvassa az app a settings-et? Mekkora lehet?

**Amit tudunk**:
- A `data.json` a SuuntoPlus app settings fájlja
- A szimulátor betölti és JS API-n keresztül olvasható (API nevek: lásd belső docs)
- **Read-only az app oldalon** — az app nem ír bele
- A settings a Suunto mobil app "My Apps" nézetéből konfigurálhatók
- A settings változások automatikusan szinkronizálódnak az órára

**Következmény**: Ha a `data.json`-ba elég nagy struktúrát tehetünk (topo adatok),
és a Suunto mobil app-ból konfigurálható, az egy szinkronizálási csatorna lehet.
De ehhez tudnunk kell a méret limitet és a struktúra rugalmasságát.

**data.json**:
```json
{
  "settings": {
    "topo_name": "Tupa Bleda",
    "anchors": [
      {"grade": "II.", "info": "Könnyű repedés"},
      {"grade": "III.", "info": "Jobbra a párkányon"}
    ]
  }
}
```

**main.js**:
```javascript
function onLoad() {
  // A dokumentáció alapján derül ki hogyan kell olvasni
  // Valószínűleg: var settings = SUUNTO.settings vagy hasonló
  // Ezt a "SuuntoPlus: Open Documentation"-ból kell kideríteni
}
```

**Elvárt kimenet**:
- Megtudjuk a settings olvasás API-t
- Megtudjuk a `data.json` méret limitjét (kicsi = nem alkalmas topo adatnak,
  nagy = topo adat szinkronizálható a Suunto mobil app-on keresztül!)

---

## Teszt #7 — Persistent storage

**Vakfolt**: Milyen API-val lehet adatot tárolni workout-ok között?

Ez is a belső dokumentációból derül ki. A teszt:

**main.js**:
```javascript
var counter = 0;

function onLoad() {
  // Dokumentáció alapján: counter = retrieve('counter') vagy hasonló
}

function onLap(input, output) {
  counter++;
  // Dokumentáció alapján: store('counter', counter) vagy hasonló
}

function evaluate(input, output) {
  // Kiírjuk a counter-t a kijelzőre valamilyen módon
}
```

**Elvárt kimenet**:
- Megtudjuk a store/retrieve API-t
- Megtudjuk a tárolt adat méret limitjét

---

## Teszt #8 — Csomag méret limit

**Vakfolt**: Mekkora app-csomagot bír el az óra?

Progresszív teszt:
1. App 50KB PNG-vel
2. App 200KB PNG-vel
3. App 500KB PNG-vel
4. App 1MB PNG-vel

(Csak ha Teszt #1 kép renderelés működik. Ha nem → JSON méret tesztelés.)

**Elvárt kimenet**:
- A maximális csomag méret → meghatározza hány topo/milyen részletességű topo
  fér el egy appban

---

## Teszt #9 — setStyle hívás JS-ből (nem csak inline handler-ből)

**Vakfolt**: A `setStyle()` inline HTML attribútumból működik (megerősített).
De hívható-e `evaluate()`-ból vagy `onLap()`-ból is?

**main.js**:
```javascript
var position = 0;

function onLap(input, output) {
  position -= 100;
  setStyle('#canvas', 'top', position + 'px');
}
```

**Elvárt kimenet**:
- ✅ Működik JS-ből is → teljes programmatikus kontroll a navigáció felett
- ❌ Csak inline HTML-ből → korlátozott, de workaround-olható (inline handler
  ami globális state-et módosít)

---

## Összefoglaló — döntési fa

```
Teszt #1 (kép) → IGEN → Teszt #8 (méret) → elég nagy → A megoldás (kép csíkok)
                                            → kicsi    → C2 (kisebb renderelt képek)
                → NEM  → Teszt #2 (viewport eltolás) → IGEN → B megoldás (vektor)
                                                      → NEM  → szegmentált HTML nézetek

Teszt #5 (template váltás) → IGEN → lap gomb = topo/info váltás
                           → NEM  → overlay infó a topo nézeten

Teszt #9 (setStyle JS-ből) → IGEN → programmatikus navigáció, state machine
                           → NEM  → inline handler-ek + globális változók
```

## A tesztek sorrendje

1. **Először**: Nyisd meg a `SuuntoPlus: Open Documentation` és
   `SuuntoPlus: Open Examples` — ezek megválaszolhatják a kérdések felét
   kód írás nélkül
2. **Teszt #1** (kép) — ez a legfontosabb döntő kérdés
3. **Teszt #2 + #9** (viewport eltolás + JS setStyle) — együtt tesztelhetők
4. **Teszt #5** (template váltás) — gyors teszt, nagy hatás
5. **Teszt #4** (elem limit) — ha vektor irányba megyünk
6. **Teszt #6 + #7** (data.json + persistent storage) — a dokumentációból
   kiderülhet, nem feltétlenül kell appot írni hozzá
7. **Teszt #3** (transition) — nice-to-have, nem kritikus
8. **Teszt #8** (csomag méret) — csak ha kép működik
