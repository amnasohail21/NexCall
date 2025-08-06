import { useEffect, useRef, useState } from "react";

function VideoChat() {
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const pcRef = useRef(null); // RTCPeerConnection
  const [started, setStarted] = useState(false);

  const startCall = async () => {
    // 1. Get media stream
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideoRef.current.srcObject = stream;

    // 2. Create peer connection
    pcRef.current = new RTCPeerConnection();

    // 3. Add stream tracks to connection
    stream.getTracks().forEach((track) => {
      pcRef.current.addTrack(track, stream);
    });

    // 4. Handle remote stream
    pcRef.current.ontrack = (event) => {
      remoteVideoRef.current.srcObject = event.streams[0];
    };

    // 5. Create and set offer
    const offer = await pcRef.current.createOffer();
    await pcRef.current.setLocalDescription(offer);

    // 6. Simulate setting remote description (for local demo only)
    const pc2 = new RTCPeerConnection();
    pc2.ontrack = (event) => {
      remoteVideoRef.current.srcObject = event.streams[0];
    };
    pc2.onicecandidate = (e) => {
      if (e.candidate) pcRef.current.addIceCandidate(e.candidate);
    };
    pcRef.current.onicecandidate = (e) => {
      if (e.candidate) pc2.addIceCandidate(e.candidate);
    };

    stream.getTracks().forEach((track) => pc2.addTrack(track, stream));

    await pc2.setRemoteDescription(pcRef.current.localDescription);
    const answer = await pc2.createAnswer();
    await pc2.setLocalDescription(answer);
    await pcRef.current.setRemoteDescription(pc2.localDescription);

    setStarted(true);
  };

  return (
    <div className="p-4 flex flex-col items-center space-y-6">
      <h2 className="text-2xl font-bold">🔗 Local WebRTC Test</h2>
      <div className="flex space-x-4">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="w-64 h-40 bg-black rounded"
        />
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-64 h-40 bg-black rounded"
        />
      </div>
      {!started && (
        <button
          onClick={startCall}
          className="px-4 py-2 bg-green-600 text-white rounded"
        >
          Start Local Call
        </button>
      )}
    </div>
  );
}

export default VideoChat;
