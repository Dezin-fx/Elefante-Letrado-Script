// ==UserScript==
// @name         Elefante Assistente de Estudo
// @namespace    https://github.com/Dezin-fx
// @version      1.1.0
// @description  Runtime modular do Elefante Assistente de Estudo
// @match        https://reader.elefanteletrado.com.br/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      cdn.jsdelivr.net
// @connect      openrouter.ai
// ==/UserScript==

/**
 * 🐘 Elefante Assistente de Estudo - Bootloader v1.1.0
 *
 * Responsabilidade única: baixar tudo e entregar ao Runtime.
 * Este script roda no sandbox privilegiado do Tampermonkey e tem acesso
 * real às funções GM_*. Scripts injetados no DOM NÃO têm esse acesso,
 * portanto TODO download de rede acontece aqui.
 *
 * Fluxo:
 *   1. Injeta __ElefanteGM no window (para Storage: getValue/setValue)
 *   2. Baixa o manifesto (stable.json)
 *   3. Baixa o código do Runtime
 *   4. Baixa o código de cada módulo declarado no manifesto
 *   5. Injeta o Runtime no DOM
 *   6. Chama ElefanteRuntime.bootFromModules(manifest, moduleCodes)
 */
(function () {
    'use strict';

    const LOADER_VERSION = '1.1.0';
    const CDN_BASE = 'https://cdn.jsdelivr.net/gh/Dezin-fx/Elefante-Assistente-Releases@main/';
    const MANIFEST_URL = CDN_BASE + 'channels/stable.json';

    // ------------------------------------------------------------------
    // GM Bridge — expõe getValue/setValue no window para que o Runtime
    // e os módulos (injetados no DOM) possam ler/salvar configurações.
    // xmlhttpRequest NÃO é exposto aqui: o bootloader faz todos os fetches.
    // ------------------------------------------------------------------
    function injectGMBridge() {
        // Atribuímos diretamente no window do sandbox.
        // No Tampermonkey, window é um proxy que reflete para o page window,
        // então os scripts injetados no DOM conseguem ler window.__ElefanteGM.
        window.__ElefanteGM = {
            getValue:  (key, def) => GM_getValue(key, def),
            setValue:  (key, val) => GM_setValue(key, val),
            // xmlhttpRequest fica aqui apenas como trava de segurança;
            // o módulo AI não deve precisar usar — todas as requisições
            // de rede passarão pelo bootloader no futuro.
            xmlhttpRequest: (details) => GM_xmlhttpRequest(details)
        };
        console.log('[🐘 Bootloader] GM Bridge injetada no window.');
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
        console.log(`[🐘 Bootloader] v${LOADER_VERSION} iniciando...`);

        try {
            // 1. Injeta a GM Bridge no window ANTES de qualquer script de página
            injectGMBridge();

            // 2. Baixa o manifesto
            console.log('[🐘 Bootloader] Baixando manifesto:', MANIFEST_URL);
            const manifestText = await gmFetch(MANIFEST_URL);
            const manifest = JSON.parse(manifestText);
            console.log(`[🐘 Bootloader] Manifesto OK — canal: ${manifest.channel}, versão: ${manifest.version}`);

            // 3. Baixa o Runtime
            const runtimeUrl = resolveUrl(CDN_BASE, manifest.runtime.file);
            console.log('[🐘 Bootloader] Baixando Runtime:', runtimeUrl);
            const runtimeCode = await gmFetch(runtimeUrl);
            console.log(`[🐘 Bootloader] Runtime OK (${runtimeCode.length} bytes)`);

            // 4. Baixa cada módulo declarado no manifesto
            const moduleCodes = {};
            const moduleEntries = Object.entries(manifest.modules || {});

            for (const [name, info] of moduleEntries) {
                const url = resolveUrl(CDN_BASE, info.file);
                console.log(`[🐘 Bootloader] Baixando módulo "${name}":`, url);
                try {
                    moduleCodes[name] = await gmFetch(url);
                    console.log(`[🐘 Bootloader] Módulo "${name}" OK (${moduleCodes[name].length} bytes)`);
                } catch (err) {
                    console.error(`[🐘 Bootloader] ❌ Falha ao baixar módulo "${name}":`, err.message);
                    // Módulo falhou mas não interrompe o boot — Runtime lida com isso
                }
            }

            // 5. Injeta o Runtime no DOM da página
            console.log('[🐘 Bootloader] Injetando Runtime no DOM...');
            injectScript(runtimeCode, 'elefante-runtime');

            // 6. Aguarda o Runtime registrar-se no window.ElefanteRuntime
            //    (a injeção de <script> é síncrona, mas deixamos um tick de segurança)
            await new Promise(r => setTimeout(r, 50));

            if (!window.ElefanteRuntime) {
                throw new Error('window.ElefanteRuntime não encontrado após injeção do Runtime.');
            }

            // 7. Entrega manifesto + códigos para o Runtime inicializar os módulos
            console.log('[🐘 Bootloader] Iniciando bootFromModules...');
            await window.ElefanteRuntime.bootFromModules(manifest, moduleCodes);

        } catch (err) {
            console.error('[🐘 Bootloader] ❌ FATAL:', err.message, err);
        }
    }

    boot();

})();
