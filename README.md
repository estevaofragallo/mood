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

- **Primeiro acesso.** Três livros, três álbuns e três filmes que definem a pessoa (por busca nos catálogos ou à mão; cada etapa pode ser pulada). Em seguida, a escolha do modo: *pelo meu gosto e humor* ou *com astrologia* (data, hora opcional e cidade de nascimento). As duas opções aparecem com o mesmo peso e em ordem aleatória, e a ordem fica registrada no perfil para medir viés de posição. Tudo pode ser editado ou desligado em *ajustes*; desligar o modo astral apaga os dados de nascimento.
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
    catalog.ts      busca TMDB (filmes/séries), Google Books + Open Library (livros), MusicBrainz (álbuns)
    images.ts       remoção de metadados, capas, extração de cores
    reading.ts      motor de leitura local
    reading-ai.ts   leitura via Claude (carregado sob demanda)
    profile.ts      perfil: favoritos, modo e dados de nascimento (localStorage)
    card.ts         renderização dos cards em canvas
    settings.ts     chave da API e modelo (localStorage)
  store.tsx         estado global + cache de imagens
  screens/          Home, PeriodScreen, ShareScreen, Eras, Settings, sheets
  components/       Icon, Sheet, Rating, Cover, PeriodCard, Toast
```

## Limitações conhecidas / próximos passos

- **Chave da API no navegador.** Aceitável para protótipo pessoal. Para produto, mover a chamada para um backend (proxy) e tirar a chave do cliente.
- **Catálogos.** Filmes e séries vêm do TMDB (em pt-BR, com pôster e direção ou criação preenchidas automaticamente), que exige uma chave gratuita em *ajustes*; aceita a chave v3 ou o token de leitura v4. Livros vêm do Google Books, com a Open Library como reserva tanto na busca quanto na capa (pelo ISBN). A chave do Google é opcional, mas sem ela a cota anônima pode esgotar. Para uso comercial, o TMDB exige atribuição (já incluída em *ajustes*) e um acordo específico. Qualquer mídia também aceita capa manual, inclusive na edição.
- **Busca em catálogo** foi testada com respostas simuladas, porque a rede do ambiente de desenvolvimento bloqueia TMDB, Open Library e MusicBrainz e esgotou a cota anônima do Google Books. Falta validar no aparelho com chaves reais. Se a busca falhar, o app avisa e o preenchimento manual continua disponível.
- Sem service worker ainda (o app é instalável, mas não funciona offline no primeiro carregamento).
- Fase 2 do conceito: importações (Spotify, Last.fm, Letterboxd, Goodreads), sincronização entre aparelhos e comparação com amigos.
