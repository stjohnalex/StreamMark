// WebRTC Configuration
const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// Global variables
let peerConnection = null;
let localStream = null;
let currentMode = 'sender';
let isConnected = false;
let signalingInterval = null;

// DOM elements
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const status = document.getElementById('status');

// Mode selection
function setMode(mode) {
    currentMode = mode;
    
    // Update UI
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Reset connection when changing modes
    resetConnection();
    
    updateStatus(`Mode set to: ${mode}. Ready to connect.`);
}

// Start WebRTC connection
async function startConnection() {
    try {
        updateStatus('Starting connection...');
        
        if (currentMode === 'sender') {
            await startSender();
        } else {
            await startReceiver();
        }
        
        // Start signaling
        startSignaling();
        
    } catch (error) {
        console.error('Error starting connection:', error);
        updateStatus(`Error: ${error.message}`, 'error');
    }
}

// Start sender mode
async function startSender() {
    // Get user media
    localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
    });
    
    localVideo.srcObject = localStream;
    
    // Create peer connection
    peerConnection = new RTCPeerConnection(configuration);
    
    // Add local stream tracks
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });
    
    // Handle incoming tracks
    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
        isConnected = true;
        updateStatus('Connected! Video stream established.', 'connected');
        updateButtons();
    };
    
    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
        console.log('Connection state:', peerConnection.connectionState);
        if (peerConnection.connectionState === 'connected') {
            isConnected = true;
            updateStatus('WebRTC connection established!', 'connected');
        } else if (peerConnection.connectionState === 'disconnected') {
            isConnected = false;
            updateStatus('Connection lost.', 'error');
        }
        updateButtons();
    };
    
    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            // Store ICE candidate for receiver
            const candidates = JSON.parse(localStorage.getItem('webrtc_ice_candidates') || '[]');
            candidates.push({
                candidate: event.candidate,
                timestamp: Date.now()
            });
            localStorage.setItem('webrtc_ice_candidates', JSON.stringify(candidates));
        }
    };
    
    // Create and store offer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    localStorage.setItem('webrtc_offer', JSON.stringify({
        sdp: offer,
        timestamp: Date.now()
    }));
    
    updateStatus('Offer created. Waiting for receiver...');
}

// Start receiver mode
async function startReceiver() {
    // Create peer connection
    peerConnection = new RTCPeerConnection(configuration);
    
    // Handle incoming tracks
    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
        isConnected = true;
        updateStatus('Connected! Receiving video stream.', 'connected');
        updateButtons();
    };
    
    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
        console.log('Connection state:', peerConnection.connectionState);
        if (peerConnection.connectionState === 'connected') {
            isConnected = true;
            updateStatus('WebRTC connection established!', 'connected');
        } else if (peerConnection.connectionState === 'disconnected') {
            isConnected = false;
            updateStatus('Connection lost.', 'error');
        }
        updateButtons();
    };
    
    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            // Store ICE candidate for sender
            const candidates = JSON.parse(localStorage.getItem('webrtc_ice_candidates_receiver') || '[]');
            candidates.push({
                candidate: event.candidate,
                timestamp: Date.now()
            });
            localStorage.setItem('webrtc_ice_candidates_receiver', JSON.stringify(candidates));
        }
    };
    
    updateStatus('Receiver ready. Waiting for offer...');
}

// Signaling mechanism using localStorage
function startSignaling() {
    signalingInterval = setInterval(async () => {
        try {
            if (currentMode === 'sender') {
                await handleSenderSignaling();
            } else {
                await handleReceiverSignaling();
            }
        } catch (error) {
            console.error('Signaling error:', error);
        }
    }, 1000); // Check every second
}

// Handle sender signaling
async function handleSenderSignaling() {
    if (!peerConnection) return;
    
    // Check for answer
    const answerData = localStorage.getItem('webrtc_answer');
    if (answerData) {
        const answer = JSON.parse(answerData);
        if (answer.timestamp > (Date.now() - 10000)) { // Within 10 seconds
            await peerConnection.setRemoteDescription(answer.sdp);
            localStorage.removeItem('webrtc_answer');
            updateStatus('Answer received. Establishing connection...');
        }
    }
    
    // Check for receiver ICE candidates
    const candidates = JSON.parse(localStorage.getItem('webrtc_ice_candidates_receiver') || '[]');
    const recentCandidates = candidates.filter(c => c.timestamp > (Date.now() - 10000));
    
    for (const candidateData of recentCandidates) {
        try {
            await peerConnection.addIceCandidate(candidateData.candidate);
        } catch (error) {
            console.log('ICE candidate already added or invalid');
        }
    }
    
    // Clean up old candidates
    localStorage.setItem('webrtc_ice_candidates_receiver', JSON.stringify(recentCandidates));
}

// Handle receiver signaling
async function handleReceiverSignaling() {
    if (!peerConnection) return;
    
    // Check for offer
    const offerData = localStorage.getItem('webrtc_offer');
    if (offerData) {
        const offer = JSON.parse(offerData);
        if (offer.timestamp > (Date.now() - 10000)) { // Within 10 seconds
            await peerConnection.setRemoteDescription(offer.sdp);
            
            // Create and store answer
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            
            localStorage.setItem('webrtc_answer', JSON.stringify({
                sdp: answer,
                timestamp: Date.now()
            }));
            
            localStorage.removeItem('webrtc_offer');
            updateStatus('Offer received. Answer sent. Establishing connection...');
        }
    }
    
    // Check for sender ICE candidates
    const candidates = JSON.parse(localStorage.getItem('webrtc_ice_candidates') || '[]');
    const recentCandidates = candidates.filter(c => c.timestamp > (Date.now() - 10000));
    
    for (const candidateData of recentCandidates) {
        try {
            await peerConnection.addIceCandidate(candidateData.candidate);
        } catch (error) {
            console.log('ICE candidate already added or invalid');
        }
    }
    
    // Clean up old candidates
    localStorage.setItem('webrtc_ice_candidates', JSON.stringify(recentCandidates));
}

// Stop connection
function stopConnection() {
    if (signalingInterval) {
        clearInterval(signalingInterval);
        signalingInterval = null;
    }
    
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
    
    isConnected = false;
    updateStatus('Connection stopped.');
    updateButtons();
}

// Reset connection
function resetConnection() {
    stopConnection();
    
    // Clear localStorage
    localStorage.removeItem('webrtc_offer');
    localStorage.removeItem('webrtc_answer');
    localStorage.removeItem('webrtc_ice_candidates');
    localStorage.removeItem('webrtc_ice_candidates_receiver');
    
    updateStatus('Connection reset. Ready to connect.');
}

// Update status display
function updateStatus(message, type = '') {
    status.textContent = message;
    status.className = 'status';
    if (type) {
        status.classList.add(type);
    }
    console.log(message);
}

// Update button states
function updateButtons() {
    startBtn.disabled = isConnected;
    stopBtn.disabled = !isConnected;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    updateStatus('Ready to connect. Select your mode and click "Start Connection".');
    updateButtons();
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    stopConnection();
}); 