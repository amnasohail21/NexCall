import { useEffect, useRef, useState } from "react";
import { ref, onValue, set, push, get, remove } from "firebase/database";
import { database } from "../firebase";

function VideoChat({ roomId }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const [started, setStarted] = useState(false);
  const [isCaller, setIsCaller] = useState(null); // null = no role yet

  // Firebase DB paths
  const roomRef = ref(database, `rooms/${roomId}`);
  const offerRef = ref(database, `rooms/${roomId}/offer`);
  const answerRef = ref(database, `rooms/${roomId}/answer`);
  const callerCandidatesRef = ref(database, `rooms/${roomId}/callerCandidates`);
  const calleeCandidatesRef = ref(database, `rooms/${roomId}/calleeCandidates`);

  // Setup peer connection
  const setupPeerConnection = () => {
    pcRef.current = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    pcRef.current.ontrack = (event) => {
      console.log("📡 Remote track received");
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pcRef.current.onicecandidate = (event) => {
      if (!event.candidate) return;
      const candidateData = event.candidate.toJSON();
      const candidatesRef = isCaller ? callerCandidatesRef : calleeCandidatesRef;
      push(candidatesRef, candidateData);
      console.log("📡 Local ICE candidate pushed:", candidateData);
    };
  };

  // Handle remote ICE candidates
  useEffect(() => {
    if (!roomId || !pcRef.current || isCaller === null) return;

    const remoteCandidatesRef = isCaller ? calleeCandidatesRef : callerCandidatesRef;
    const unsubscribe = onValue(remoteCandidatesRef, (snapshot) => {
      const candidates = snapshot.val();
      if (candidates) {
        Object.values(candidates).forEach(async (candidate) => {
          try {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            console.log("✅ Remote ICE candidate added:", candidate);
          } catch (err) {
            console.error("⚠️ Error adding remote ICE candidate:", err);
          }
        });
      }
    });

    return () => unsubscribe();
  }, [roomId, isCaller]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      remove(roomRef).catch(() => {});
    };
  }, [roomId]);

  // Caller
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
      console.log("📤 Offer set in DB:", offer);

      const unsubscribe = onValue(answerRef, async (snapshot) => {
        const answer = snapshot.val();
        if (
          answer &&
          pcRef.current &&
          pcRef.current.signalingState === "have-local-offer"
        ) {
          try {
            console.log("📨 Answer received:", answer);
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
            setStarted(true);
            unsubscribe(); // Listen only once
          } catch (err) {
            console.error("❌ Failed to set remote answer:", err);
          }
        }
      });
    } catch (err) {
      console.error("❌ Error starting call:", err);
    }
  };

  // Callee
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

      console.log("📥 Setting remote description with offer:", offer);
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(offer));

      const answer = await pcRef.current.createAnswer();
      await pcRef.current.setLocalDescription(answer);
      await set(answerRef, answer);
      console.log("📤 Answer set in DB:", answer);

      setStarted(true);
    } catch (err) {
      console.error("❌ Error answering call:", err);
    }
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
