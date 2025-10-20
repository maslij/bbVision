#!/bin/bash
# BrinkByte Vision - Frontend Environment Setup Script

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.local"
TEMPLATE_FILE="$SCRIPT_DIR/env.template"

echo "🔧 BrinkByte Vision - Frontend Environment Setup"
echo "================================================"
echo ""

# Check if .env.local already exists
if [ -f "$ENV_FILE" ]; then
    echo "⚠️  .env.local file already exists at: $ENV_FILE"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Setup cancelled. Keeping existing .env.local file."
        exit 1
    fi
    echo "🗑️  Removing existing .env.local file..."
    rm "$ENV_FILE"
fi

# Copy template to .env.local
if [ ! -f "$TEMPLATE_FILE" ]; then
    echo "❌ Template file not found: $TEMPLATE_FILE"
    exit 1
fi

cp "$TEMPLATE_FILE" "$ENV_FILE"
echo "📝 Created .env.local file from template"

echo ""
echo "✅ Environment file created successfully!"
echo ""
echo "📋 Configuration Summary:"
echo "  • tAPI Server: localhost:8090"
echo "  • Billing Server: http://localhost:8081"
echo "  • API Mode: development"
echo ""
echo "💡 To customize your configuration, edit: $ENV_FILE"
echo ""
echo "🚀 You can now start the frontend with:"
echo "   npm run dev"
echo ""

