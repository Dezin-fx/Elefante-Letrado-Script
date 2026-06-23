# 📘 Elefante Letrado Automático

![Status](https://img.shields.io/badge/status-active-brightgreen)
![Platform](https://img.shields.io/badge/platform-browser-blue)
![Type](https://img.shields.io/badge/type-userscript-yellow)

## 📌 Sobre o projeto

Este script automatiza a leitura e resolução de questões na plataforma Elefante Letrado diretamente no navegador.

Ele reduz ações manuais ao detectar atividades, extrair perguntas e gerar respostas automaticamente com auxílio de IA

## 🔒 É seguro?

- O script roda apenas no seu navegador  
- Nenhum dado é enviado para terceiros além da API escolhida pelo usuário 
- A chave da API é configurada localmente  

## 🚀 Como usar

1. Instale Tampermonkey  
2. Adicione o script  
3. Configure o arquivo `Config.js`  
4. Acesse a plataforma  

## Principais funções:

- Navegação automática entre páginas quando não há interação necessária  
- Detecção de quizzes e perguntas na interface  
- Extração automática de perguntas e alternativas
- Geração de respostas utilizando IA 
- Uso de contexto do livro para melhorar a precisão das respostas  
- Interface de controle injetada na página  
- Sistema de auto-paginação  

## Instalação e Uso

O script pode ser usado com Tampermonkey (recomendado)

### 1. Instalar Tampermonkey
- Chrome / Firefox / Edge: extensão oficial

### 2. Adicionar o script
- Criar novo userscript
- Colar o conteúdo do `Script.js`
- Salvar e ativar

### 3. Acessar a plataforma
- Abrir o Elefante Letrado normalmente

# Atenção❗

O script depende de um campo de contexto onde o usuário informa o conteúdo base do livro ou atividade atual. Esse contexto é usado como referência para interpretar perguntas e gerar respostas mais coerentes.

## 🔑 API utilizada

O projeto utiliza a API da [OpenRouter](https://openrouter.ai)

### É necessário:

* Criar uma conta no OpenRouter
* Gerar uma API key em [OpenRouter Key](https://openrouter.ai/workspaces/default/keys)
* Inserir no arquivo Config.js em `OPENROUTER_KEY`

## Variáveis

O script utiliza o [Config.js](https://github.com/Dezin-fx/Elefante-Letrado-Automatico/blob/main/Config.js) para declarar o valor das variáveis usadas. Para usar o script é necessário alterar os valores de `BOOK_TITLE` e `BOOK_CONTEXT`

> `BOOK_CONTEXT` É do que se trata o livro, colocar gênero, autor(a), etc. Recomendo fortemente ir no chatGPT ou na IA de sua preferência e pedir um resumo completo do livro pra colocar aqui; pois assim a IA do script ganha mais contexto!
> 
> `BOOK_TITLE` Apenas o titulo do livro.
