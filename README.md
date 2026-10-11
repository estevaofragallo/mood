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
- **Indicação do dia.** No topo da tela inicial: a pessoa marca como está (leve, intenso, nostálgico…) e o tipo de mídia que quer, e recebe uma obra com duas alternativas. Com a chave da API, o Claude cruza favoritos, registros com notas, humor e, no modo astral, a lua do dia, o Sol e a Lua natais e os aspectos ao Sol natal. Sem chave, uma curadoria local de cerca de 40 obras é filtrada pelo humor. Nunca indica o que já foi registrado, favoritado, indicado antes ou marcado como "já conheço". "Registrar" abre o registro já preenchido.
- **Céu calculado no aparelho.** Signos, fase da Lua e aspectos são calculados localmente com `astronomy-engine` (MIT); os dados de nascimento não saem do aparelho. Sem hora de nascimento, a Lua natal é marcada como incerta quando muda de signo naquele dia. Ascendente e casas ficam para uma próxima etapa, porque exigem converter a cidade em coordenadas.
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

Preto e azul, em linguagem plana e lo-fi inspirada na estética dos apps de GIF dos anos 2010: caixa alta, bordas duras, grão, linhas de varredura e grade de capas. Nenhum logotipo, fonte ou elemento de marca de terceiros é reproduzido.

Há três opções de visual, que variam tipografia, tom de azul e cantos. A escolha fica em *ajustes → visual* e vale também para os cards exportados:

| Opção | Títulos | Texto | Números | Azul |
|---|---|---|---|---|
| LOOP | Archivo (larga, 900) | Archivo | Space Mono | elétrico `#2B5CFF` |
| FLASH | Anton (condensada) | DM Sans | VT323 | neon `#00B2FF` |
| STICKER | Unbounded (arredondada) | Figtree | Silkscreen | cobalto `#3D6BFF` |

Todas as fontes são do Google Fonts, com licença aberta (OFL). Os tokens ficam em `src/lib/theme.ts` e `src/styles/global.css`.

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
    daily.ts        indicação do dia: humor, curadoria local, histórico
    daily-ai.ts     indicação do dia via Claude (carregado sob demanda)
    astro.ts        signos natais, lua do dia e aspectos (astronomy-engine)
    profile.ts      perfil: favoritos, modo e dados de nascimento (localStorage)
    card.ts         renderização dos cards em canvas
    settings.ts     chaves de API e modelo (localStorage)
    theme.ts        as três opções de visual e a aplicação dos tokens
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
