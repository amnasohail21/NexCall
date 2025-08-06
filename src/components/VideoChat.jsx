import { useEffect, useRef, useState } from "react";
import { 
  database, 
  // import get, set, push, remove, ref, onValue from firebase/database
} from "../firebase";
import { ref, onValue, set, push, get, remove } from "firebase/database";

function VideoChat({ roomId }) {
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const pcRef = useRef(null);
  const [started, setStarted] = useState(false);
  const [isCaller, setIsCaller] = useState(false);

  // Firebase DB paths
  const roomRef = ref(database, `rooms/${roomId}`);
  const offerRef = ref(database, `rooms/${roomId}/offer`);
  const answerRef = ref(database, `rooms/${roomId}/answer`);
  const callerCandidatesRef = ref(database, `rooms/${roomId}/callerCandidates`);
  const calleeCandidatesRef = ref(database, `rooms/${roomId}/calleeCandidates`);

  useEffect(() => {
    if (!roomId) return;

    pcRef.current = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" }
      ],
    });

    // When remote track arrives, show it on remote video
    pcRef.current.ontrack = (event) => {
      remoteVideoRef.current.srcObject = event.streams[0];
    };

    // Caller ICE candidates -> callerCandidates path
    // Callee ICE candidates -> calleeCandidates path
    pcRef.current.onicecandidate = (event) => {
      if (!event.candidate) return;

      const candidateData = event.candidate.toJSON();
      const candidatesRef = isCaller ? callerCandidatesRef : calleeCandidatesRef;
      push(candidatesRef, candidateData);
    };

    // Cleanup on unmount
    return () => {
      pcRef.current?.close();
      remove(roomRef); // Remove room data when done
    };
  }, [roomId, isCaller]);

  // Listen for remote ICE candidates based on role
  useEffect(() => {
    if (!roomId) return;
    const remoteCandidatesRef = isCaller ? calleeCandidatesRef : callerCandidatesRef;

    const unsubscribe = onValue(remoteCandidatesRef, (snapshot) => {
      const candidates = snapshot.val();
      if (candidates) {
        Object.values(candidates).forEach((candidate) => {
          pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        });
      }
    });

    return () => unsubscribe();
  }, [roomId, isCaller]);

  // Caller: start call and create offer
  const startCall = async () => {
    setIsCaller(true);

    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideoRef.current.srcObject = stream;
    stream.getTracks().forEach(track => pcRef.current.addTrack(track, stream));

    const offer = await pcRef.current.createOffer();
    await pcRef.current.setLocalDescription(offer);

    await set(offerRef, offer);

    // Listen for answer
    onValue(answerRef, async (snapshot) => {
      const answer = snapshot.val();
      if (answer) {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        setStarted(true);
      }
    });
  };

  // Callee: answer call
  const answerCall = async () => {
    setIsCaller(false);

    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideoRef.current.srcObject = stream;
    stream.getTracks().forEach(track => pcRef.current.addTrack(track, stream));

    // Get offer from DB
    const offerSnapshot = await get(offerRef);
    const offer = offerSnapshot.val();
    if (!offer) {
      alert("No offer found!");
      return;
    }

    await pcRef.current.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await pcRef.current.createAnswer();
    await pcRef.current.setLocalDescription(answer);

    await set(answerRef, answer);

    setStarted(true);
  };

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <div className="flex space-x-4">
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className="w-1/2 border rounded"
        />
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-1/2 border rounded"
        />
      </div>

      {!started && (
        <div className="space-x-4">
          <button
            onClick={startCall}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Start Call (Caller)
          </button>
          <button
            onClick={answerCall}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Answer Call (Callee)
          </button>
        </div>
      )}
    </div>
  );
}

export default VideoChat;
