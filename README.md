# Roblox – animacje

## ChestOpenUltraRare (R15)

Animacja otwierania skrzyni „ULTRA RARE” w stylu nagrody z gry gacha.

| | |
|---|---|
| Rig | R15 (proporcje rigu **Block** z Rig Buildera), wszystkie 15 stawów Motor6D |
| Długość | 2,5 s, 76 klatek, 30 FPS |
| Priorytet | `Action` |
| Pętla | nie |
| Format | `KeyframeSequence` (`.rbxmx`), klatki kluczowe R15 |

### Przebieg

| Czas | Co się dzieje |
|---|---|
| 0,0–0,4 s | lekkie nabranie powietrza, pochylenie, obie dłonie lądują na wieku |
| 0,4–0,8 s | przysiad z prostymi rękami i tułowiem odchylonym do tyłu. Pierwsze szarpnięcie, wieko opada, mocniejszy przysiad (antycypacja), potem dźwignięcie z drżeniem |
| 0,8–1,1 s | wieko wyskakuje, wybuch światła. Postać odrzuca do tyłu, cofa prawą stopę i zasłania oczy prawą ręką, a lewa ręka wylatuje do tyłu (follow-through) |
| 1,1–1,6 s | złote cząsteczki, postać opuszcza rękę, wspina się na palce i patrzy w górę z zachwytem |
| 1,6–2,1 s | przysiad i zamach rąk, skok z rękami w górze, obrót do kamery w powietrzu |
| 2,1–2,5 s | lądowanie z amortyzacją, dumna poza z otwartymi ramionami, przodem do kamery |

Stopy oparte na ziemi nie ślizgają się, a dłonie trzymają się wieka do momentu wybuchu. Generator sprawdza to przy każdym budowaniu.

**Kamera:** na końcu postać obraca się o **75° w lewo**, przodem do kamery ustawionej po jej lewej stronie (tak jak w podglądzie). Skrypt z zestawu sam ustawia taką kamerę.

### Markery (`KeyframeMarker`)

| Nazwa | Czas | Do czego |
|---|---|---|
| `Grab` | 0,33 s | dłonie na wieku |
| `Pull` | 0,43 s | początek podnoszenia |
| `LidBurst` | 0,80 s | wybuch światła, dźwięk, błysk |
| `Awe` | 1,10 s | baner „ULTRA RARE”, cząsteczki |
| `Jump` | 1,73 s | wybicie |
| `Land` | 2,03 s | lądowanie, iskry pod stopami |
| `Pose` | 2,33 s | poza końcowa |

## Pliki

| Plik | Co to jest |
|---|---|
| `animations/ChestOpenUltraRare.rbxmx` | sama animacja (`KeyframeSequence`) do wstawienia w Studio |
| `roblox/UltraRareChestKit.rbxmx` | gotowa scena demo: skrzynia, ProximityPrompt, efekty, kamera i animacja |
| `roblox/src/ChestClient.lua` | kod skryptu z zestawu (Script z `RunContext = Client`) |
| `roblox/src/ChestOpeningData.lua` | generowane dane: krzywa wieka 60 FPS, markery, wymiary skrzyni |
| `animations/ChestOpenUltraRare.json` | wypieczone transformacje stawów (z tego korzysta podgląd) |
| `preview/index.html` | podgląd 3D na telefon |
| `tools/` | generator animacji (Node.js) |

## Jak użyć w Roblox Studio

### 1. Publikacja animacji

1. W Studio wstaw rig: **Avatar → Rig Builder → R15 → Block** (albo użyj swojej postaci R15).
2. Prawy klik na **ServerStorage → Insert from File…** i wybierz `animations/ChestOpenUltraRare.rbxmx`.
3. Opublikuj animację jednym z dwóch sposobów:
   - prawy klik na `ChestOpenUltraRare` w Explorerze → **Save to Roblox…**, albo
   - przenieś `ChestOpenUltraRare` do `ServerStorage › RBX_ANIMSAVES › <nazwa riga>`. Ten folder tworzy Animation Editor przy pierwszym zapisie animacji dla danego riga. Potem otwórz Animation Editor na tym rigu, wybierz **Load → ChestOpenUltraRare** i **Publish to Roblox**.
4. Skopiuj ID animacji (`rbxassetid://…`).

### 2. Odtwarzanie w grze

```lua
local animator = humanoid:FindFirstChildOfClass("Animator")
local animation = Instance.new("Animation")
animation.AnimationId = "rbxassetid://TWOJE_ID"

local track = animator:LoadAnimation(animation)
track:GetMarkerReachedSignal("LidBurst"):Connect(function()
	-- wybuch światła, dźwięk, cząsteczki
end)
track:Play()
```

Animacja nie ma pętli. Jeśli postać ma zostać w pozie końcowej, wywołaj `track:AdjustSpeed(0)` tuż przed końcem (tak robi skrypt z zestawu).

### 3. Gotowa scena demo

1. Prawy klik na **Workspace → Insert from File…** i wybierz `roblox/UltraRareChestKit.rbxmx`.
2. Przesuń i obróć model `UltraRareChest`. Niewidoczna część `Anchor` to środek podstawy skrzyni, a jej przód (`LookVector`) wskazuje kierunek od gracza do skrzyni.
3. Naciśnij **Play**, podejdź do skrzyni i naciśnij **E**.
   - W Studio działa to bez publikacji, bo skrypt rejestruje tymczasowe ID przez `KeyframeSequenceProvider`.
   - W opublikowanej grze wpisz ID animacji do `StringValue` o nazwie `AnimationId` w modelu.
   - `CinematicCamera` (`BoolValue`) włącza i wyłącza kamerę filmową.

Wieko jest ustawiane w każdej klatce na podstawie `AnimationTrack.TimePosition`, więc dłonie zawsze trafiają w wieko. Całe otwieranie dzieje się po stronie klienta (prywatna nagroda gracza), a samą animację postaci widzą wszyscy gracze.

**Proporcje:** animacja jest dopasowana do rigu R15 Block i do skrzyni oddalonej o 2,7 studa (od środka HumanoidRootPart do środka skrzyni). Na awatarach Rthro i innych proporcjach ruch zostaje ten sam, ale dłonie mogą lekko mijać wieko.

## Generator (dla chętnych)

Ruch jest opisany kluczami w `tools/anim/choreo.mjs`: biodra, kręgosłup, głowa, tor rąk i stopy. Dłonie i stopy liczy IK (`tools/anim/solve.mjs`). Krzywa wieka jest w `tools/anim/scene.mjs`. Po zmianach:

```bash
cd tools
npm install
npm run build   # przelicza animację, .rbxmx, dane Luau i podgląd
npm run check   # test zapisu/odczytu .rbxmx, składnia Luau, skoki prędkości stawów
```

`npm run build` przerywa pracę, jeśli stopa zacznie się ślizgać, dłoń zejdzie z wieka albo cel IK będzie poza zasięgiem ręki lub nogi.
