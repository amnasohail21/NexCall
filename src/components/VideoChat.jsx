import { useEffect, useRef, useState } from "react";
import { ref, onValue, set, push, get, remove } from "firebase/database";
import { database } from "../firebase";

function VideoChat({ roomId }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const [started, setStarted] = useState(false);
  const [isCaller, setIsCaller] = useState(null);
  const [incomingCall, setIncomingCall] = useState(false);

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

  // incoming calls
  useEffect(() => {
    const unsubscribe = onValue(offerRef, (snapshot) => {
      if (snapshot.val() && !started && isCaller === null) {
        setIncomingCall(true);
      }
    });
    return () => unsubscribe();
  }, []);

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
      setIncomingCall(false);
    } catch (err) {
      console.error("Error answering call:", err);
    }
  };

  const declineCall = () => {
    remove(roomRef);
    setIncomingCall(false);
  };

  return (
    <div className="relative w-full h-screen bg-black text-white overflow-hidden">
      {/* Remote Video */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Black gradient at bottom */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/80 to-transparent z-10"></div>

      {/* Local Video */}
      <video
        ref={localVideoRef}
        autoPlay
        muted
        playsInline
        className="absolute top-6 right-6 w-28 h-40 md:w-32 md:h-44 rounded-xl border-2 border-white object-cover shadow-lg z-20"
      />

      {/* Incoming Call Overlay */}
      {incomingCall && !started && (
        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-30">
          <h2 className="text-2xl font-semibold mb-6">📞 Incoming Call</h2>
          <div className="flex space-x-6">
            <button
              onClick={declineCall}
              className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-2xl"
            >
              ❌
            </button>
            <button
              onClick={answerCall}
              className="w-16 h-16 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center text-2xl"
            >
              ✅
            </button>
          </div>
        </div>
      )}

      {/* Call Controls */}
      {started && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex space-x-6 z-20">
          <button className="w-14 h-14 bg-gray-500 hover:bg-gray-600 rounded-full flex items-center justify-center">🎤</button>
          <button
            onClick={() => window.location.reload()}
            className="w-14 h-14 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center"
          >
            📴
          </button>
          <button className="w-14 h-14 bg-gray-500 hover:bg-gray-600 rounded-full flex items-center justify-center">📷</button>
        </div>
      )}

      {/* Call Start Buttons */}
      {!started && !incomingCall && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex space-x-6 z-20">
          <button
            onClick={startCall}
            className="w-16 h-16 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center text-white text-xl"
          >
            📞
          </button>
        </div>
      )}
    </div>
  );
}

export default VideoChat;
