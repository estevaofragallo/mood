# moody ✦

Quem você foi, período a período. O moody gera recaps visuais do que você ouviu, leu, assistiu, por onde passou e das fotos que marcaram um intervalo de tempo, com uma leitura de humor (nome da fase, palavras e paleta). Os recaps se acumulam como **eras**.

Web app mobile-first (React + Vite + TypeScript), instalável como PWA. Todos os dados ficam no aparelho.

## Rodar

```bash
npm install
npm run dev        # http://localhost:5173 (use --host para abrir no celular na mesma rede)
npm run build      # typecheck + build de produção em dist/
```

## Como o produto funciona

- **Diário + janelas.** Cada registro (álbum, filme, série, livro, lugar, foto) tem uma data. Os períodos são janelas sobre o diário: tudo entre o início e o fim entra no recap. Por isso os períodos podem se sobrepor (um mês dentro de um trimestre, uma viagem dentro do ano), e um período criado depois do fato já sai preenchido.
- **Periodicidades.** Sugeridas: 1 mês, 3 meses, 6 meses, 1 ano (fim calculado automaticamente). Personalizadas: semanal, viagem (com destino) e livre (início, fim e nome à escolha).
- **Leitura de humor.** A IA sugere e você edita. Com uma chave da API da Anthropic (em *ajustes*), o Claude gera nome, palavras, paleta e resumo. Sem chave, ou se a chamada falhar, um motor local monta a leitura a partir dos tipos de registro, das notas e das cores extraídas das fotos. Em qualquer caso, nome, palavras, paleta e resumo são editáveis.
- **Card.** Stories (1080×1920) e carrossel 4:5 (capa, grade de capas das mídias com notas, fotos, lugares e frases), renderizados em canvas no próprio aparelho. Compartilhar usa a folha nativa do sistema; se ela não estiver disponível, as imagens são baixadas.
- **Eras.** Fechar um recap congela a leitura e o guarda na linha do tempo.

## Privacidade (alinhada ao conceito)

- Sem conta e sem servidor: IndexedDB local.
- Fotos são reprocessadas em canvas antes de serem guardadas, o que remove EXIF e GPS. A remoção foi verificada no teste ponta a ponta.
- Lugares só por nome e cidade, nunca por coordenada.
- Para a IA vão títulos, notas, frases e as cores extraídas das fotos. As fotos nunca são enviadas.
- O prompt restringe a leitura a vocabulário estético e emocional e proíbe inferências sobre religião, política, orientação sexual, gênero, saúde, etnia, classe e tipo de personalidade (LGPD, art. 11 e art. 20).
- Excluir um período apaga a leitura e oferece apagar também os registros exclusivos dele.

## Design

Base preta com atmosfera Y2K/Tumblr: vidro fosco, texto cromado, brilhos ✦, grão e linhas de varredura. Do design system de referência vêm os cartões com cantos bem arredondados, a pílula de vidro na navegação, o botão pílula com "+" circular, os números em matriz de pontos e o arco de progresso pontilhado.

Tokens em `src/styles/global.css` (`:root`). Fontes: Instrument Serif (títulos em itálico), Manrope (interface) e Doto (números e datas em matriz de pontos).

## Estrutura

```
src/
  lib/
    types.ts        modelos (Entry, Period, Reading)
    db.ts           IndexedDB (entries, periods, blobs)
    periods.ts      periodicidades, datas, títulos automáticos
    catalog.ts      busca Open Library (livros) e MusicBrainz (álbuns)
    images.ts       remoção de metadados, capas, extração de cores
    reading.ts      motor de leitura local
    reading-ai.ts   leitura via Claude (carregado sob demanda)
    card.ts         renderização dos cards em canvas
    settings.ts     chave da API e modelo (localStorage)
  store.tsx         estado global + cache de imagens
  screens/          Home, PeriodScreen, ShareScreen, Eras, Settings, sheets
  components/       Icon, Sheet, Rating, Cover, PeriodCard, Toast
```

## Limitações conhecidas / próximos passos

- **Chave da API no navegador.** Aceitável para protótipo pessoal. Para produto, mover a chamada para um backend (proxy) e tirar a chave do cliente.
- **Filmes e séries** entram à mão, com capa enviada pelo usuário (pôster, print ou foto). Qualquer mídia aceita capa manual, inclusive na edição. O próximo passo é integrar o TMDB (exige atribuição e acordo para uso comercial).
- **Busca em catálogo** não foi testada neste ambiente de desenvolvimento, porque a rede do sandbox bloqueia Open Library e MusicBrainz. Se a busca falhar, o app avisa e o preenchimento manual continua disponível.
- Sem service worker ainda (o app é instalável, mas não funciona offline no primeiro carregamento).
- Fase 2 do conceito: importações (Spotify, Last.fm, Letterboxd, Goodreads), sincronização entre aparelhos e comparação com amigos.
