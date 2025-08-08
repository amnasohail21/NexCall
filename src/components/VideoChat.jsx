import { useEffect, useRef, useState } from "react";
import { ref, onValue, set, push, get, remove } from "firebase/database";
import { database } from "../firebase";

function VideoChat({ roomId }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const [started, setStarted] = useState(false);
  const [isCaller, setIsCaller] = useState(null);

  const roomRef = ref(database, `rooms/${roomId}`);
  const offerRef = ref(database, `rooms/${roomId}/offer`);
  const answerRef = ref(database, `rooms/${roomId}/answer`);
  const callerCandidatesRef = ref(database, `rooms/${roomId}/callerCandidates`);
  const calleeCandidatesRef = ref(database, `rooms/${roomId}/calleeCandidates`);

  const setupPeerConnection = () => {
    pcRef.current = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    pcRef.current.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pcRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        const candidateData = event.candidate.toJSON();
        const candidatesRef = isCaller ? callerCandidatesRef : calleeCandidatesRef;
        push(candidatesRef, candidateData);
      }
    };
  };

  useEffect(() => {
    if (!roomId || !pcRef.current || isCaller === null) return;

    const remoteCandidatesRef = isCaller ? calleeCandidatesRef : callerCandidatesRef;
    const unsubscribe = onValue(remoteCandidatesRef, (snapshot) => {
      const candidates = snapshot.val();
      if (candidates) {
        Object.values(candidates).forEach(async (candidate) => {
          try {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.error("Error adding remote ICE candidate:", err);
          }
        });
      }
    });

    return () => unsubscribe();
  }, [roomId, isCaller]);

  useEffect(() => {
    return () => {
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      remove(roomRef).catch(() => {});
    };
  }, [roomId]);

  const startCall = async () => {
    setIsCaller(true);
    setupPeerConnection();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideoRef.current.srcObject = stream;
      stream.getTracks().forEach((track) => pcRef.current.addTrack(track, stream));

      const offer = await pcRef.current.createOffer();
      await pcRef.current.setLocalDescription(offer);
      await set(offerRef, offer);

      const unsubscribe = onValue(answerRef, async (snapshot) => {
        const answer = snapshot.val();
        if (answer && pcRef.current?.signalingState === "have-local-offer") {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
          setStarted(true);
          unsubscribe();
        }
      });
    } catch (err) {
      console.error("Error starting call:", err);
    }
  };

  const answerCall = async () => {
    setIsCaller(false);
    setupPeerConnection();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideoRef.current.srcObject = stream;
      stream.getTracks().forEach((track) => pcRef.current.addTrack(track, stream));

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
    } catch (err) {
      console.error("Error answering call:", err);
    }
  };

  return (
    <div className="relative w-full h-screen bg-black text-white overflow-hidden">
      {/* Remote Video (full screen) */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Local Video (small bottom-right) */}
      <video
        ref={localVideoRef}
        autoPlay
        muted
        playsInline
        className="absolute bottom-6 right-6 w-28 h-40 md:w-32 md:h-44 rounded-2xl border-4 border-white object-cover shadow-lg"
      />

      {/* Control Buttons (bottom center) */}
      {!started && (
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-white/20 backdrop-blur-md px-6 py-4 rounded-3xl flex space-x-6 shadow-xl">
          <button
            onClick={startCall}
            className="w-14 h-14 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center text-white text-xl"
          >
            📞
          </button>
          <button
            onClick={answerCall}
            className="w-14 h-14 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center text-white text-xl"
          >
            
          </button>
        </div>
      )}
    </div>
  );
}

export default VideoChat;
