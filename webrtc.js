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
let availableCameras = [];
let selectedLocalCamera = null;
let selectedRemoteCamera = null;

// DOM elements
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const status = document.getElementById('status');
const localCameraSelect = document.getElementById('localCameraSelect');
const remoteCameraSelect = document.getElementById('remoteCameraSelect');

// Enumerate available cameras
async function enumerateCameras() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        availableCameras = devices.filter(device => device.kind === 'videoinput');
        
        // Populate camera selectors
        populateCameraSelectors();
        
        console.log(`Found ${availableCameras.length} camera(s)`);
        return availableCameras;
    } catch (error) {
        console.error('Error enumerating cameras:', error);
        updateStatus('Error accessing camera devices', 'error');
        return [];
    }
}

// Populate camera selectors
function populateCameraSelectors() {
    // Clear existing options
    localCameraSelect.innerHTML = '';
    remoteCameraSelect.innerHTML = '';
    
    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select a camera...';
    localCameraSelect.appendChild(defaultOption.cloneNode(true));
    remoteCameraSelect.appendChild(defaultOption);
    
    // Add camera options
    availableCameras.forEach((camera, index) => {
        const option = document.createElement('option');
        option.value = camera.deviceId;
        option.textContent = camera.label || `Camera ${index + 1}`;
        
        localCameraSelect.appendChild(option.cloneNode(true));
        remoteCameraSelect.appendChild(option);
    });
    
    // Auto-select first camera if available
    if (availableCameras.length > 0) {
        selectedLocalCamera = availableCameras[0].deviceId;
        selectedRemoteCamera = availableCameras[0].deviceId;
        localCameraSelect.value = selectedLocalCamera;
        remoteCameraSelect.value = selectedRemoteCamera;
    }
}

// Change local camera
async function changeLocalCamera() {
    const deviceId = localCameraSelect.value;
    if (!deviceId) return;
    
    selectedLocalCamera = deviceId;
    
    // If we have an active stream, restart it with new camera
    if (localStream && currentMode === 'sender') {
        await restartLocalStream();
    }
}

// Change remote camera
async function changeRemoteCamera() {
    const deviceId = remoteCameraSelect.value;
    if (!deviceId) return;
    
    selectedRemoteCamera = deviceId;
    
    // If we're connected, restart the connection with new camera
    if (isConnected && currentMode === 'sender') {
        await restartConnectionWithNewCamera();
    }
}

// Restart local stream with new camera
async function restartLocalStream() {
    try {
        // Stop current stream
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        
        // Get new stream with selected camera
        localStream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: selectedLocalCamera } },
            audio: true
        });
        
        localVideo.srcObject = localStream;
        
        // Update peer connection if active
        if (peerConnection && currentMode === 'sender') {
            // Remove old tracks
            const senders = peerConnection.getSenders();
            senders.forEach(sender => {
                if (sender.track && sender.track.kind === 'video') {
                    peerConnection.removeTrack(sender);
                }
            });
            
            // Add new video track
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) {
                peerConnection.addTrack(videoTrack, localStream);
            }
        }
        
        updateStatus('Local camera changed successfully');
    } catch (error) {
        console.error('Error changing local camera:', error);
        updateStatus('Error changing local camera', 'error');
    }
}

// Restart connection with new camera
async function restartConnectionWithNewCamera() {
    try {
        updateStatus('Restarting connection with new camera...');
        
        // Stop current connection
        stopConnection();
        
        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Restart connection
        await startConnection();
        
    } catch (error) {
        console.error('Error restarting connection:', error);
        updateStatus('Error restarting connection', 'error');
    }
}

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
    try {
        // Get user media with selected camera
        const constraints = {
            video: selectedLocalCamera ? 
                { deviceId: { exact: selectedLocalCamera } } : 
                true,
            audio: true
        };
        
        console.log('Sender: Getting user media with constraints:', constraints);
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        localVideo.srcObject = localStream;
        
        // Create peer connection
        peerConnection = new RTCPeerConnection(configuration);
        
        // Add local stream tracks
        localStream.getTracks().forEach(track => {
            console.log('Sender: Adding track:', track.kind);
            peerConnection.addTrack(track, localStream);
        });
        
        // Handle incoming tracks
        peerConnection.ontrack = (event) => {
            console.log('Sender: Track received', event);
            remoteVideo.srcObject = event.streams[0];
            isConnected = true;
            updateStatus('Connected! Video stream established.', 'connected');
            updateButtons();
        };
        
        // Handle connection state changes
        peerConnection.onconnectionstatechange = () => {
            console.log('Sender: Connection state:', peerConnection.connectionState);
            if (peerConnection.connectionState === 'connected') {
                isConnected = true;
                updateStatus('WebRTC connection established!', 'connected');
            } else if (peerConnection.connectionState === 'disconnected') {
                isConnected = false;
                updateStatus('Connection lost.', 'error');
            } else if (peerConnection.connectionState === 'failed') {
                isConnected = false;
                updateStatus('Connection failed.', 'error');
            }
            updateButtons();
        };
        
        // Handle ICE connection state changes
        peerConnection.oniceconnectionstatechange = () => {
            console.log('Sender: ICE connection state:', peerConnection.iceConnectionState);
        };
        
        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('Sender: ICE candidate generated');
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
        console.log('Sender: Creating offer...');
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        localStorage.setItem('webrtc_offer', JSON.stringify({
            sdp: offer,
            timestamp: Date.now()
        }));
        
        updateStatus('Offer created. Waiting for receiver...');
        console.log('Sender mode started successfully');
        
    } catch (error) {
        console.error('Error starting sender:', error);
        updateStatus('Error starting sender: ' + error.message, 'error');
    }
}

// Start receiver mode
async function startReceiver() {
    try {
        // Create peer connection
        peerConnection = new RTCPeerConnection(configuration);
        
        // Handle incoming tracks
        peerConnection.ontrack = (event) => {
            console.log('Receiver: Track received', event);
            remoteVideo.srcObject = event.streams[0];
            isConnected = true;
            updateStatus('Connected! Receiving video stream.', 'connected');
            updateButtons();
        };
        
        // Handle connection state changes
        peerConnection.onconnectionstatechange = () => {
            console.log('Receiver: Connection state:', peerConnection.connectionState);
            if (peerConnection.connectionState === 'connected') {
                isConnected = true;
                updateStatus('WebRTC connection established!', 'connected');
            } else if (peerConnection.connectionState === 'disconnected') {
                isConnected = false;
                updateStatus('Connection lost.', 'error');
            } else if (peerConnection.connectionState === 'failed') {
                isConnected = false;
                updateStatus('Connection failed.', 'error');
            }
            updateButtons();
        };
        
        // Handle ICE connection state changes
        peerConnection.oniceconnectionstatechange = () => {
            console.log('Receiver: ICE connection state:', peerConnection.iceConnectionState);
        };
        
        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('Receiver: ICE candidate generated');
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
        console.log('Receiver mode started successfully');
        
    } catch (error) {
        console.error('Error starting receiver:', error);
        updateStatus('Error starting receiver: ' + error.message, 'error');
    }
}

// Signaling mechanism using localStorage
function startSignaling() {
    console.log('Starting signaling for mode:', currentMode);
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
        try {
            const answer = JSON.parse(answerData);
            if (answer.timestamp > (Date.now() - 10000)) { // Within 10 seconds
                // Only set remote description if we haven't already
                if (peerConnection.remoteDescription === null) {
                    await peerConnection.setRemoteDescription(answer.sdp);
                    localStorage.removeItem('webrtc_answer');
                    updateStatus('Answer received. Establishing connection...');
                }
            }
        } catch (error) {
            console.error('Error processing answer:', error);
            updateStatus('Error processing answer: ' + error.message, 'error');
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
    
    // Check for answer (in case we're receiving an answer from another receiver)
    const answerData = localStorage.getItem('webrtc_answer');
    if (answerData) {
        try {
            const answer = JSON.parse(answerData);
            if (answer.timestamp > (Date.now() - 10000)) { // Within 10 seconds
                await peerConnection.setRemoteDescription(answer.sdp);
                localStorage.removeItem('webrtc_answer');
                updateStatus('Answer received. Establishing connection...');
            }
        } catch (error) {
            console.error('Error processing answer:', error);
        }
    }
    
    // Check for offer
    const offerData = localStorage.getItem('webrtc_offer');
    if (offerData) {
        try {
            const offer = JSON.parse(offerData);
            if (offer.timestamp > (Date.now() - 10000)) { // Within 10 seconds
                // Only process if we haven't already set a remote description
                if (peerConnection.remoteDescription === null) {
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
        } catch (error) {
            console.error('Error processing offer:', error);
            updateStatus('Error processing offer: ' + error.message, 'error');
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
document.addEventListener('DOMContentLoaded', async () => {
    updateStatus('Loading cameras...');
    
    // Request camera permissions and enumerate devices
    try {
        // Request initial permission
        await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        
        // Enumerate cameras
        await enumerateCameras();
        
        updateStatus('Ready to connect. Select your mode and click "Start Connection".');
    } catch (error) {
        console.error('Error during initialization:', error);
        updateStatus('Error accessing camera. Please check permissions.', 'error');
    }
    
    updateButtons();
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    stopConnection();
}); 