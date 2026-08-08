# JARVIS AI Assistant

A futuristic, polished AI assistant that runs locally on Android Termux or any system with Node.js.

## Features

- **Interactive 3D Sphere** - Beautiful WebGL sphere that reacts to JARVIS states (idle, listening, thinking, speaking)
- **Voice Input/Output** - Browser-based speech recognition and text-to-speech
- **Streaming Responses** - Real-time AI responses from OpenRouter
- **Conversation Memory** - Local storage for conversation history
- **Futuristic UI** - Dark, glass-morphic design with smooth animations
- **Mobile Optimized** - Touch controls, responsive layout, performance modes
- **Configurable** - Multiple AI models, voice settings, visual quality options

## Quick Start (Termux)

1. **Install Node.js** (if not already installed):
   ```bash
   pkg install nodejs
   ```

2. **Navigate to the project**:
   ```bash
   cd jarvis-ai
   ```

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Configure API key**:
   ```bash
   cp .env.example .env
   nano .env
   ```
   
   Add your OpenRouter API key:
   ```
   OPENROUTER_API_KEY=your_api_key_here
   OPENROUTER_MODEL=google/gemma-3-27b-it:free
   PORT=3000
   ```

5. **Start JARVIS**:
   ```bash
   npm start
   ```

6. **Open in browser**:
   - On device: `http://localhost:3000`
   - From another device (if BIND_LAN=true): `http://YOUR_IP:3000`

## Configuration

### Environment Variables (.env)

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENROUTER_API_KEY` | - | Your OpenRouter API key (required) |
| `OPENROUTER_MODEL` | `google/gemma-3-27b-it:free` | AI model to use |
| `PORT` | `3000` | Server port |
| `BIND_LAN` | `false` | Bind to all interfaces for LAN access |

### Available Free Models

- `google/gemma-3-27b-it:free` - Gemma 3 27B (default, recommended)
- `google/gemma-2-9b-it:free` - Gemma 2 9B
- `meta-llama/llama-3-8b-instruct:free` - Llama 3 8B

## Usage

### Text Input
- Type your message and press Enter or tap Send
- Shift+Enter for new line

### Voice Input
- Tap the microphone button
- Speak your message
- JARVIS will auto-send when you finish speaking

### Voice Output
- Toggle in Settings → Voice
- Adjust speech speed (0.7x - 1.5x)

### Controls
- **Sphere**: Drag to rotate, scroll/pinch to zoom
- **Stop**: Stop generation or speech
- **Copy/Regenerate/Speak**: Actions on each response

### Performance Modes
- **High**: Maximum particles and effects
- **Balanced**: Good quality/performance ratio (default)
- **Low**: Minimal effects for older devices

## Project Structure

```
jarvis-ai/
├── server.js          # Express backend, OpenRouter integration
├── public/
│   ├── index.html     # Main HTML
│   ├── styles.css     # Futuristic styling
│   ├── sphere.js      # Three.js 3D sphere
│   ├── app.js         # Frontend application logic
│   └── three.min.js   # Three.js library
├── .env.example       # Environment template
├── package.json       # Dependencies
└── README.md          # This file
```

## Browser Compatibility

**Recommended**: Chrome, Edge, or other Chromium-based browsers

Features requiring specific browser support:
- Speech Recognition: Chrome, Edge
- Speech Synthesis: Most modern browsers
- WebGL: All modern browsers

## Troubleshooting

### Microphone not working
- Grant microphone permission when prompted
- Check browser settings for microphone access
- Use text input as fallback

### API errors
- Verify your OpenRouter API key in `.env`
- Check internet connection
- Ensure the model is available (try a different free model)

### Slow performance
- Switch to "Low" performance mode in Settings
- Enable "Reduced Motion" if animations cause issues
- Close other browser tabs

### No audio
- Check if voice is enabled in Settings
- Verify device volume
- Some browsers require user interaction before audio plays

## Security Notes

- API key is stored server-side only (never exposed to frontend)
- Conversations are stored locally in browser
- No data is sent to external servers except OpenRouter API
- For LAN access, explicitly set `BIND_LAN=true`

## License

ISC

---

**Built with**: Express, Three.js, Web Speech API, OpenRouter API
