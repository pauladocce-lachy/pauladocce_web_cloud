# Paula Docce – vlastní backend bez Supabase

Web nyní potřebuje Node.js 20+ server. Není možné jej provozovat jako čistě statický web, protože administrace zapisuje data na server. Server nabízí veřejné čtení ceníku a chráněné API pro správu ceníku a připomínek.

## Spuštění
1. Nainstalujte Node.js 20 nebo novější.
2. Zkopírujte `.env.example` do `.env` a nastavte `ADMIN_EMAIL` a silné `ADMIN_PASSWORD` (minimálně 16 znaků).
3. Nastavte `HOST=127.0.0.1` při provozu za reverzní proxy, případně `HOST=0.0.0.0`, pokud hosting vyžaduje naslouchání na všech rozhraních. Za HTTPS proxy nastavte `COOKIE_SECURE=true`.
4. Spusťte `npm start`; web poběží na portu nastaveném v `PORT` (výchozí 3000). Kód nemá externí npm závislosti.
5. Trvalá data jsou v `storage/db.json`. Tuto složku připojte jako persistentní disk, omezte přístup na uživatele serveru a nikdy ji nevystavujte přes web. Zálohujte ji pravidelně.

## Upozornění k úložišti
JSON je zvolen kvůli malému rozsahu tohoto webu a absenci databázových relací/Realtime/Storage. Zápisy jsou v rámci jednoho procesu serializované a soubor se nahrazuje atomicky. Toto řešení není vhodné pro více instancí serveru, síťové filesystémy bez zaručené atomické rename operace ani pro rozsáhlý provoz. Pro více instancí doporučujeme SQLite na trvalém lokálním disku nebo spravovanou databázi. Relace jsou uloženy v paměti a po restartu serveru se uživatel musí znovu přihlásit.

## Ceník a migrace
`storage/db.json` byl předvyplněn pouze z `data/pricing.json`, protože ZIP neobsahuje export tabulky `pricing` ze Supabase. Tato JSON data mohou být ukázková/neúplná; ověřte je v administraci před zveřejněním. Data připomínek nebyla v ZIPu dostupná.

Pro import aktuálních dat ze Supabase je potřeba jednorázově exportovat tabulky `pricing` a `feedback` do JSON nebo CSV a importovat je do `storage/db.json` při vypnutém serveru, po záloze stávajícího souboru. Nepoužívejte veřejné/publishable klíče jako důkaz oprávnění a nikdy nevkládejte tajné klíče do prohlížeče. Projekt v ZIPu neobsahuje definice tabulek ani RLS politiky; původní oprávnění proto nelze z archivu plně rekonstruovat. Nové API povoluje všechny zápisy jen po přihlášení administrátora.

## Bezpečnost
- HTTPS je v produkci povinné; pokud HTTPS končí na reverzní proxy, nastavte `COOKIE_SECURE=true`.
- Neveřejné soubory `.env` a `storage/` jsou blokovány ve statickém serveru.
- Před nasazením změňte ukázkové heslo a nastavte správného administrátora.
- Endpointy používají HttpOnly/SameSite cookie, limit těla, validaci a limit přihlášení. Pro veřejné nasazení za proxy přidejte omezení přístupu a bezpečnostní hlavičky na úrovni proxy.
- Tento server nepoužívá Supabase Auth, Storage, Realtime ani Edge Functions. V přiloženém kódu nebyly nalezeny uploady, realtime odběry ani jiné Supabase funkce než autentizace, tabulky `pricing` a `feedback`.

### Jednorázový import exportovaných tabulek
Připravte JSON soubor ve tvaru `{"pricing":[...],"feedback":[...]}` z exportu tabulek (přesná pole jako v původních tabulkách). Zastavte server, vytvořte samostatnou kopii `storage/db.json` a spusťte `node scripts/import-data.mjs /absolutni/cesta/export.json`. Skript vytvoří zálohu aktuální databáze, ověří kategorie a atomicky zapíše import. Neimportuje hesla ani relace. Nejdříve ověřte, že export obsahuje všechny řádky; ZIP žádný export ze Supabase neobsahoval, takže skutečná původní data nelze z archivu obnovit.


## Cloudflare D1 – požadavky z administrace
Administrace požadavků používá POST endpoint `https://contact-api.lachmanfrantisekk.workers.dev` a D1 tabulku `pauladocce_pozadavky`. Zdroj Workeru a SQL schéma jsou v `cloudflare-worker/`. Nasazený Worker musí podporovat JSON akce `create` a `list`; viz `cloudflare-worker/README.md`. Výpis požadavků vrací soukromá data, proto chraňte endpoint přes Cloudflare Access. Samotný frontend nemůže bezpečně skrýt tajný token.
