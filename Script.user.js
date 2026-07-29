// ==UserScript==
// @name         Elefante Letrado Script
// @namespace    https://github.com/Dezin-fx
// @version      1.1.0
// @description  Runtime modular do Elefante Letrado Script
// @match        https://reader.elefanteletrado.com.br/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      cdn.jsdelivr.net
// @connect      openrouter.ai
// ==/UserScript==

/**
 * Elefante Letrado Script - Bootloader v1.1.0
 *
 * Responsabilidade única: baixar tudo e entregar ao Runtime.
 * Este script roda no sandbox privilegiado do Tampermonkey e tem acesso
 * real às funções GM_*. Scripts injetados no DOM NÃO têm esse acesso,
 * portanto TODO download de rede acontece aqui.
 *
 * Fluxo:
 *   1. Injeta __ElefanteGM no window e unsafeWindow (para Storage: getValue/setValue)
 *   2. Baixa o manifesto (stable.json)
 *   3. Baixa o código do Runtime
 *   4. Baixa o código de cada módulo declarado no manifesto
 *   5. Injeta o Runtime no DOM
 *   6. Chama ElefanteRuntime.bootFromModules(manifest, moduleCodes)
 */
(function () {
    'use strict';

    const LOADER_VERSION = '1.1.0';
    const CDN_BASE = 'https://cdn.jsdelivr.net/gh/Dezin-fx/Elefante-Letrado-Script-Releases@main/';
    const MANIFEST_URL = CDN_BASE + 'channels/stable.json';

    // ------------------------------------------------------------------
    // GM Bridge — expõe getValue/setValue no window para que o Runtime
    // e os módulos (injetados no DOM) possam ler/salvar configurações.
    // ------------------------------------------------------------------
    function injectGMBridge() {
        const bridge = {
            getValue:  (key, def) => GM_getValue(key, def),
            setValue:  (key, val) => GM_setValue(key, val),
            xmlhttpRequest: (details) => GM_xmlhttpRequest(details)
        };

        window.__ElefanteGM = bridge;
        if (typeof unsafeWindow !== 'undefined') {
            unsafeWindow.__ElefanteGM = bridge;
        }
        console.log('[🐘 Bootloader] GM Bridge injetada em window e unsafeWindow.');
    }

    // ------------------------------------------------------------------
    // Fetch via GM (único ponto de rede do bootloader)
    // ------------------------------------------------------------------
    function gmFetch(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                onload(r) {
                    if (r.status === 200) {
                        resolve(r.responseText);
                    } else {
                        reject(new Error(`HTTP ${r.status} para: ${url}`));
                    }
                },
                onerror(err) {
                    reject(new Error(`Erro de rede: ${url}`));
                }
            });
        });
    }

    function resolveUrl(base, relative) {
        if (/^https?:\/\//i.test(relative)) return relative;
        return base.replace(/\/+$/, '/') + relative.replace(/^\/+/, '');
    }

    // ------------------------------------------------------------------
    // Injeta um bloco de código JS como <script> no DOM da página
    // ------------------------------------------------------------------
    function injectScript(code, id) {
        const script = document.createElement('script');
        script.type = 'text/javascript';
        if (id) script.id = id;
        script.textContent = code;
        (document.head || document.documentElement).appendChild(script);
        // Mantém no DOM para facilitar debug no DevTools (não remove)
    }

    // ------------------------------------------------------------------
    // Boot principal
    // ------------------------------------------------------------------
    async function boot() {
        console.log(`[Bootloader] v${LOADER_VERSION} iniciando...`);

        try {
            // 1. Injeta a GM Bridge no window ANTES de qualquer script de página
            injectGMBridge();

            // 2. Baixa o manifesto
            console.log('[Bootloader] Baixando manifesto:', MANIFEST_URL);
            const manifestText = await gmFetch(MANIFEST_URL);
            const manifest = JSON.parse(manifestText);
            console.log(`[Bootloader] Manifesto OK — canal: ${manifest.channel}, versão: ${manifest.version}`);

            // 3. Baixa o Runtime
            const runtimeUrl = resolveUrl(CDN_BASE, manifest.runtime.file);
            console.log('[Bootloader] Baixando Runtime:', runtimeUrl);
            const runtimeCode = await gmFetch(runtimeUrl);
            console.log(`[Bootloader] Runtime OK (${runtimeCode.length} bytes)`);

            // 4. Baixa cada módulo declarado no manifesto
            const moduleCodes = {};
            const moduleEntries = Object.entries(manifest.modules || {});

            for (const [name, info] of moduleEntries) {
                const url = resolveUrl(CDN_BASE, info.file);
                console.log(`[Bootloader] Baixando módulo "${name}":`, url);
                try {
                    moduleCodes[name] = await gmFetch(url);
                    console.log(`[Bootloader] Módulo "${name}" OK (${moduleCodes[name].length} bytes)`);
                } catch (err) {
                    console.error(`[Bootloader] ❌ Falha ao baixar módulo "${name}":`, err.message);
                    // Módulo falhou mas não interrompe o boot — Runtime lida com isso
                }
            }

            // 5. Injeta o payload (manifest + código dos módulos) como script na página.
            //    Isso cruza a barreira sandbox→página de forma segura via JSON serializado.
            //    O Runtime vai detectar esse payload ao ser carregado e auto-inicializar.
            console.log('[Bootloader] Injetando payload no DOM...');
            const payloadJson = JSON.stringify({ manifest, moduleCodes });
            injectScript(`window.__ElefanteBootPayload = ${payloadJson};`, 'elefante-payload');

            // 6. Injeta o Runtime — ele detecta __ElefanteBootPayload e executa bootFromModules
            //    automaticamente, tudo dentro do contexto da página (sem cruzar o sandbox).
            console.log('[Bootloader] Injetando Runtime no DOM...');
            injectScript(runtimeCode, 'elefante-runtime');

            console.log('[Bootloader] Runtime injetado. Boot em andamento na página...');

        } catch (err) {
            console.error('[Bootloader] ❌ FATAL:', err.message, err);
        }
    }

    boot();

})();
