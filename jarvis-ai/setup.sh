#!/bin/bash

# JARVIS AI Assistant - Setup Script for Termux
echo "🚀 JARVIS AI Assistant - Setup"
echo "=============================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found!"
    echo "   Installing Node.js..."
    pkg update && pkg install nodejs -y
fi

echo "✅ Node.js version: $(node --version)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

echo ""
echo "✅ Dependencies installed!"
echo ""

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo ""
    echo "⚠️  IMPORTANT: Edit .env and add your OpenRouter API key!"
    echo "   Use: nano .env"
    echo ""
else
    echo "✅ .env file already exists"
fi

echo ""
echo "==================================="
echo "Setup complete!"
echo ""
echo "To start JARVIS:"
echo "  1. Add your API key to .env (if not done)"
echo "  2. Run: npm start"
echo "  3. Open: http://localhost:3000"
echo ""
echo "For LAN access, edit .env and set:"
echo "  BIND_LAN=true"
echo "==================================="
