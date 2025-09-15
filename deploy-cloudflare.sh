#!/bin/bash

# Script para deploy do SkyOffice na Cloudflare
# Autor: Configuração automática para Cloudflare Pages + Workers

set -e

echo "🚀 Iniciando deploy do SkyOffice na Cloudflare..."

# Verificar se wrangler está instalado
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler não está instalado. Instalando..."
    npm install -g wrangler
fi

# Verificar se está logado no Cloudflare
echo "🔐 Verificando autenticação Cloudflare..."
if ! wrangler whoami &> /dev/null; then
    echo "❌ Não está logado no Cloudflare. Execute: wrangler login"
    exit 1
fi

echo "✅ Autenticado no Cloudflare"

# Instalar dependências
echo "📦 Instalando dependências..."
yarn install
cd types && yarn install && cd ..
cd client && yarn install && cd ..

# Build do cliente para Cloudflare Pages
echo "🏗️  Fazendo build do cliente..."
cd client
yarn build --config vite.config.cloudflare.ts

# Verificar se precisa configurar a URL do servidor
if grep -q "your-subdomain" _redirects; then
    echo "⚠️  ATENÇÃO: Atualize a URL do servidor em client/_redirects"
    echo "   Substitua 'your-subdomain' pelo seu subdomínio real"
fi

cd ..

# Build do worker
echo "🏗️  Fazendo build do worker..."
yarn build:worker

# Deploy do worker primeiro
echo "🚀 Fazendo deploy do worker..."
wrangler deploy

# Obter URL do worker
WORKER_URL=$(wrangler deployment list --name skyoffice-server --format json | jq -r '.[0].url' 2>/dev/null || echo "")

if [ -n "$WORKER_URL" ]; then
    echo "✅ Worker deployado em: $WORKER_URL"
    
    # Atualizar redirects com a URL real
    sed -i "s/skyoffice-server\.your-subdomain\.workers\.dev/${WORKER_URL#https:\/\/}/g" client/_redirects
    echo "🔧 Redirects atualizados com a URL do worker"
else
    echo "⚠️  Não foi possível obter a URL do worker automaticamente"
    echo "   Atualize manualmente em client/_redirects"
fi

# Deploy do cliente
echo "🚀 Fazendo deploy do cliente (Pages)..."
cd client

# Verificar se o projeto Pages existe
if ! wrangler pages project list | grep -q "skyoffice-client"; then
    echo "📝 Criando projeto Cloudflare Pages..."
    wrangler pages project create skyoffice-client --production-branch main
fi

wrangler pages deploy dist --project-name skyoffice-client --compatibility-date 2024-09-15

cd ..

echo ""
echo "🎉 Deploy concluído com sucesso!"
echo ""
echo "📋 Próximos passos:"
echo "   1. Configure o domínio personalizado no Cloudflare Pages (opcional)"
echo "   2. Configure as variáveis de ambiente se necessário"
echo "   3. Teste a aplicação nas URLs fornecidas"
echo ""
echo "🔗 URLs de acesso:"
echo "   Cliente: https://skyoffice-client.pages.dev"
echo "   Worker: https://skyoffice-server.your-subdomain.workers.dev"
echo ""
echo "📚 Documentação:"
echo "   - Cloudflare Pages: https://developers.cloudflare.com/pages/"
echo "   - Cloudflare Workers: https://developers.cloudflare.com/workers/"
