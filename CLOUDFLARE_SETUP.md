# 🌩️ Configuração SkyOffice para Cloudflare

Este guia explica como configurar e fazer deploy do SkyOffice na infraestrutura da Cloudflare usando **Cloudflare Pages** (cliente) e **Cloudflare Workers** (servidor).

## 📋 Pré-requisitos

1. **Conta Cloudflare** (gratuita ou paga)
2. **Node.js** e **Yarn** instalados
3. **Wrangler CLI** da Cloudflare
4. **Git** configurado

## 🚀 Configuração Rápida

### 1. Instalar Wrangler CLI

```bash
npm install -g wrangler
```

### 2. Fazer login na Cloudflare

```bash
wrangler login
```

### 3. Executar script de deploy automático

```bash
./deploy-cloudflare.sh
```

## 🔧 Configuração Manual

### Passo 1: Instalar dependências do Cloudflare

```bash
yarn add -D @cloudflare/workers-types wrangler
```

### Passo 2: Configurar variáveis de ambiente

1. Copie o arquivo de exemplo:
```bash
cp client/env.example client/.env.local
```

2. Edite `client/.env.local`:
```env
VITE_SERVER_URL=wss://skyoffice-server.SEU-SUBDOMINIO.workers.dev
NODE_ENV=production
```

### Passo 3: Build e Deploy do Worker (Servidor)

```bash
# Build do worker
yarn build:worker

# Deploy do worker
wrangler deploy
```

### Passo 4: Configurar redirects do cliente

Edite `client/_redirects` e substitua `your-subdomain` pela URL real do seu worker:

```
# Exemplo:
/api/*  https://skyoffice-server.meusubdominio.workers.dev/:splat  200
```

### Passo 5: Build e Deploy do Cliente

```bash
# Build do cliente para Cloudflare
yarn build:client:cf

# Deploy para Cloudflare Pages
cd client
wrangler pages deploy dist --project-name skyoffice-client
```

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Infrastructure                 │
├─────────────────────────────────────────────────────────────┤
│  📱 Cliente (React/Vite)     │  🖥️  Servidor (Node.js)      │
│  Cloudflare Pages           │  Cloudflare Workers          │
│                             │                              │
│  • Interface do usuário     │  • WebSocket connections     │
│  • Assets estáticos         │  • Game logic (Colyseus)     │
│  • Roteamento SPA           │  • Durable Objects (estado)  │
│  • PWA capabilities         │  • Real-time multiplayer     │
└─────────────────────────────────────────────────────────────┘
```

## 📁 Estrutura de Arquivos Adicionados

```
SkyOffice/
├── wrangler.toml                    # Configuração do Worker
├── deploy-cloudflare.sh            # Script de deploy automático
├── server/
│   ├── tsconfig.worker.json        # TypeScript config para Worker
│   └── worker/
│       └── index.ts                # Código do Worker
├── client/
│   ├── vite.config.cloudflare.ts   # Configuração Vite para CF
│   ├── _redirects                  # Redirects do Cloudflare Pages
│   ├── _headers                    # Headers de segurança
│   └── env.example                 # Exemplo de variáveis de ambiente
```

## 🔧 Comandos Disponíveis

```bash
# Development
yarn dev:worker              # Executar worker localmente
yarn start                   # Executar servidor local original

# Build
yarn build:worker           # Build do worker
yarn build:client           # Build do cliente (padrão)
yarn build:client:cf        # Build do cliente para Cloudflare

# Deploy
yarn deploy:worker          # Deploy apenas do worker
yarn deploy:client          # Deploy apenas do cliente
yarn deploy:all             # Build e deploy completo
```

## 🌐 URLs de Acesso

Após o deploy, você terá:

- **Cliente**: `https://skyoffice-client.pages.dev`
- **Worker**: `https://skyoffice-server.SEU-SUBDOMINIO.workers.dev`

## ⚙️ Configurações Avançadas

### Domínio Personalizado

1. No painel da Cloudflare Pages:
   - Vá em **Custom domains**
   - Adicione seu domínio (ex: `skyoffice.seudominio.com`)

2. No Worker:
   - Configure routes personalizadas no `wrangler.toml`

### Variáveis de Ambiente

Para adicionar variáveis de ambiente ao Worker:

```bash
# Definir variável
wrangler secret put NOME_DA_VARIAVEL

# Listar variáveis
wrangler secret list
```

### Monitoramento

- **Analytics**: Disponível no painel Cloudflare
- **Logs**: `wrangler tail` para logs em tempo real
- **Metrics**: Métricas de performance automáticas

## 🔍 Troubleshooting

### Problema: WebSocket não conecta

**Solução**: Verifique se a URL do worker está correta em:
- `client/.env.local`
- `client/_redirects`
- `client/src/services/Network.ts`

### Problema: Worker não inicia

**Solução**: Verifique:
1. Se as dependências estão instaladas
2. Se o build foi executado sem erros
3. Logs do worker: `wrangler tail`

### Problema: Assets não carregam

**Solução**: 
1. Verifique se o build do cliente foi feito corretamente
2. Confirme se os headers estão configurados em `client/_headers`

## 🎯 Benefícios da Cloudflare

### Performance
- **CDN Global**: Assets servidos de localizações próximas aos usuários
- **HTTP/3**: Protocolo mais rápido automaticamente
- **Brotli Compression**: Compressão avançada automática

### Escalabilidade
- **Auto-scaling**: Escala automaticamente com a demanda
- **Edge Computing**: Processamento distribuído globalmente
- **Durable Objects**: Estado consistente globalmente

### Segurança
- **DDoS Protection**: Proteção automática contra ataques
- **SSL/TLS**: HTTPS automático e gratuito
- **WAF**: Web Application Firewall integrado

## 💰 Custos

### Tier Gratuito
- **Pages**: 500 builds/mês, 1 build simultâneo
- **Workers**: 100,000 requests/dia
- **Durable Objects**: 1GB storage, 1M requests/mês

### Tier Pago
- **Pages**: Builds ilimitados, múltiplos builds simultâneos
- **Workers**: $5/10M requests
- **Durable Objects**: $0.50/GB storage/mês

## 📚 Recursos Adicionais

- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)
- [Durable Objects Guide](https://developers.cloudflare.com/workers/runtime-apis/durable-objects/)

## 🤝 Suporte

Para problemas específicos do SkyOffice na Cloudflare:
1. Verifique os logs: `wrangler tail`
2. Consulte a documentação da Cloudflare
3. Abra uma issue no repositório do projeto
