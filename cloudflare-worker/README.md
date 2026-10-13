# Cloudflare Worker + D1: požadavky Paula Docce

Worker používá D1 binding s názvem `DB` a tabulku `pauladocce_pozadavky`.

## Nasazení
1. V Cloudflare otevřete Workers & Pages a Worker `contact-api`.
2. V nastavení Bindings přidejte D1 database binding s proměnnou `DB` a vyberte správnou databázi.
3. V D1 Console spusťte obsah `schema.sql` (pokud tabulka již existuje, nejdříve ověřte její sloupce; schema předpokládá `id`, `message`, `status`, `created_at`).
4. Nahraďte kód Workeru obsahem `worker.js` a nasaďte jej.
5. **Před povolením výpisu požadavků chraňte Worker přes Cloudflare Access.** Akce `list` vrací uložené zprávy a nesmí být veřejně dostupná.

## API
Všechny operace používají POST JSON:
- `{"action":"create","message":"Text požadavku"}`
- `{"action":"list"}`

Před nasazením ověřte, zda již existující tabulka má stejné sloupce. Pokud používá jiné názvy, upravte SQL v worker.js podle skutečného schématu.
