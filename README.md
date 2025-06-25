# WebRTC Sender/Receiver

A simple WebRTC application that allows peer-to-peer video communication between two browser tabs locally.

## Features

- **Dual Mode**: Single page that can act as both sender and receiver
- **Local Signaling**: Uses localStorage for signaling between tabs (no server required)
- **Real-time Video**: Live video and audio streaming
- **Modern UI**: Clean, responsive interface
- **Connection Status**: Real-time connection state feedback

## How to Use

### Prerequisites

- Modern browser with WebRTC support (Chrome, Firefox, Safari, Edge)
- Camera and microphone access
- Two browser tabs/windows

### Setup Instructions

1. **Open the Application**
   - Open `index.html` in your browser
   - Or serve it using a local web server (recommended)

2. **Start Local Server** (Optional but recommended)
   ```bash
   # Using Python 3
   python -m http.server 8000
   
   # Using Node.js (if you have http-server installed)
   npx http-server
   
   # Using PHP
   php -S localhost:8000
   ```

3. **Test the Connection**
   - Open the application in **two different browser tabs**
   - In the **first tab**: Select "Sender" mode and click "Start Connection"
   - In the **second tab**: Select "Receiver" mode and click "Start Connection"
   - Allow camera/microphone access when prompted
   - The connection should establish automatically

### How It Works

1. **Signaling**: The application uses localStorage to exchange WebRTC signaling data between tabs
2. **Offer/Answer**: The sender creates an offer, the receiver responds with an answer
3. **ICE Candidates**: Both peers exchange ICE candidates for NAT traversal
4. **Media Stream**: Once connected, video and audio streams flow directly between peers

## Technical Details

### WebRTC Components

- **RTCPeerConnection**: Manages the peer-to-peer connection
- **getUserMedia**: Captures camera and microphone
- **ICE Servers**: Uses Google's public STUN servers for NAT traversal
- **Signaling**: localStorage-based signaling mechanism

### File Structure

```
├── index.html          # Main HTML file with UI
├── webrtc.js          # WebRTC logic and signaling
└── README.md          # This file
```

### Browser Compatibility

- ✅ Chrome 56+
- ✅ Firefox 52+
- ✅ Safari 11+
- ✅ Edge 79+

## Troubleshooting

### Common Issues

1. **"getUserMedia not supported"**
   - Ensure you're using HTTPS or localhost
   - Check browser compatibility

2. **"No video/audio"**
   - Check camera/microphone permissions
   - Ensure devices are not in use by other applications

3. **"Connection failed"**
   - Check browser console for errors
   - Ensure both tabs are on the same origin (localhost)
   - Try refreshing both tabs

4. **"ICE connection failed"**
   - Check firewall settings
   - Try different network (mobile hotspot, etc.)

### Debug Mode

Open browser developer tools (F12) to see detailed connection logs and error messages.

## Advanced Usage

### Customization

You can modify the WebRTC configuration in `webrtc.js`:

```javascript
const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        // Add your own TURN servers here
    ]
};
```

### Adding TURN Servers

For better connectivity across different networks, add TURN servers:

```javascript
const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        {
            urls: 'turn:your-turn-server.com:3478',
            username: 'username',
            credential: 'password'
        }
    ]
};
```

## Security Notes

- This application runs locally and doesn't transmit data to external servers
- Camera/microphone access is required for functionality
- localStorage is used for signaling (data is stored locally)
- No persistent data is stored beyond the session

## License

This project is open source and available under the MIT License. 