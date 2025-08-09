import { useEffect, useRef, useState } from "react";
import { ref, onValue, set, push, get, remove } from "firebase/database";
import { database } from "../firebase";
import {
  FaPhoneAlt,
  FaMicrophone,
  FaMicrophoneSlash,
  FaVideo,
  FaVideoSlash,
} from "react-icons/fa";

function VideoChat({ roomId }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const ringtoneRef = useRef(null);

  const [started, setStarted] = useState(false);
  const [isCaller, setIsCaller] = useState(null);
  const [incomingCall, setIncomingCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callEnded, setCallEnded] = useState(false);

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
        const candidatesRef = isCaller
          ? callerCandidatesRef
          : calleeCandidatesRef;
        push(candidatesRef, candidateData);
      }
    };
  };

  // Play/stop ringtone on incoming call
  useEffect(() => {
    if (incomingCall && ringtoneRef.current) {
      ringtoneRef.current.play().catch(() => {});
    } else if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
    }
  }, [incomingCall]);

  // Browser notification on incoming call
  useEffect(() => {
    if (incomingCall) {
      if (Notification.permission === "granted") {
        new Notification("NexCall", { body: "Incoming FaceTime call 📞" });
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then((permission) => {
          if (permission === "granted") {
            new Notification("NexCall", { body: "Incoming FaceTime call 📞" });
          }
        });
      }
    }
  }, [incomingCall]);

  // Listen for incoming call offer
  useEffect(() => {
    if (started || isCaller !== null) return;
    const unsubscribe = onValue(offerRef, (snapshot) => {
      if (snapshot.exists()) {
        setIncomingCall(true);
      }
    });
    return () => unsubscribe();
  }, [offerRef, started, isCaller]);

  // Listen for remote ICE candidates
  useEffect(() => {
    if (!pcRef.current || isCaller === null) return;

    const remoteCandidatesRef = isCaller
      ? calleeCandidatesRef
      : callerCandidatesRef;

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
  }, [isCaller]);

  // Cleanup peer connection and room data on unmount or call end
  useEffect(() => {
    return () => {
      hangUpCall();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCall = async () => {
    setIsCaller(true);
    setupPeerConnection();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        stream.getTracks().forEach((track) =>
          pcRef.current.addTrack(track, stream)
        );
      }

      const offer = await pcRef.current.createOffer();
      await pcRef.current.setLocalDescription(offer);
      await set(offerRef, offer);

      // Listen for answer from callee
      const unsubscribe = onValue(answerRef, async (snapshot) => {
        const answer = snapshot.val();
        if (
          answer &&
          pcRef.current.signalingState === "have-local-offer"
        ) {
          await pcRef.current.setRemoteDescription(
            new RTCSessionDescription(answer)
          );
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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        stream.getTracks().forEach((track) =>
          pcRef.current.addTrack(track, stream)
        );
      }

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
    remove(roomRef).catch(() => {});
    setIncomingCall(false);
  };

  // Hang up call and cleanup everything
  const hangUpCall = () => {
    if (pcRef.current) {
      pcRef.current.getSenders().forEach((sender) => {
        if (sender.track) sender.track.stop();
      });
      pcRef.current.close();
      pcRef.current = null;
    }

    remove(roomRef)
      .catch(() => {})
      .finally(() => {
        setStarted(false);
        setIsCaller(null);
        setIncomingCall(false);
        setCallEnded(true);
      });
  };

  const toggleMute = () => {
    const stream = localVideoRef.current?.srcObject;
    if (stream) {
      stream.getAudioTracks().forEach((track) => (track.enabled = !track.enabled));
      setIsMuted((m) => !m);
    }
  };

  const toggleVideo = () => {
    const stream = localVideoRef.current?.srcObject;
    if (stream) {
      stream.getVideoTracks().forEach((track) => (track.enabled = !track.enabled));
      setIsVideoOff((v) => !v);
    }
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />

      <video
        ref={localVideoRef}
        autoPlay
        muted
        playsInline
        className="absolute bottom-6 right-6 w-28 h-40 md:w-36 md:h-48 rounded-xl border-2 border-white shadow-lg z-20 object-cover"
      />

      {/* Ringtone audio */}
      <audio ref={ringtoneRef} src="/ringtone.mp3" loop />

      {/* Incoming call overlay with fade animation */}
      <div
        className={`absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-30
          transition-opacity duration-300
          ${incomingCall && !started ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      >
        <h2 className="text-2xl font-semibold mb-6">📞 Incoming Call</h2>
        <div className="flex space-x-6">
          <button
            onClick={declineCall}
            className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center text-2xl
              transform transition-transform duration-150 hover:scale-110 active:scale-90"
            aria-label="Decline call"
          >
            ❌
          </button>
          <button
            onClick={answerCall}
            className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-2xl
              transform transition-transform duration-150 hover:scale-110 active:scale-90"
            aria-label="Answer call"
          >
            ✅
          </button>
        </div>
      </div>

      {/* Call controls with fade & scale animations */}
      <div
        className={`absolute bottom-8 left-1/2 transform -translate-x-1/2 flex space-x-6 z-20
          bg-black/40 backdrop-blur-lg rounded-full px-6 py-3
          transition-opacity duration-300
          ${started && !callEnded ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      >
        <button
          onClick={toggleMute}
          className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-black text-xl
            transform transition-transform duration-150 hover:scale-110 active:scale-90"
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
        </button>
        <button
          onClick={hangUpCall}
          className="w-14 h-14 bg-red-500 rounded-full flex items-center justify-center text-white text-xl
            transform transition-transform duration-150 hover:scale-110 active:scale-90"
          title="End Call"
        >
          <FaPhoneAlt />
        </button>
        <button
          onClick={toggleVideo}
          className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-black text-xl
            transform transition-transform duration-150 hover:scale-110 active:scale-90"
          title={isVideoOff ? "Turn Video On" : "Turn Video Off"}
        >
          {isVideoOff ? <FaVideoSlash /> : <FaVideo />}
        </button>
      </div>

      {/* Start call button */}
      {!started && !incomingCall && !callEnded && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20">
          <button
            onClick={startCall}
            className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-white text-2xl
              transform transition-transform duration-150 hover:scale-110 active:scale-90"
            title="Start Call"
            aria-label="Start call"
          >
            📞
          </button>
        </div>
      )}

      {/* Call ended overlay */}
      {callEnded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-2xl z-20 bg-black/80">
          <p>Call Ended</p>
        </div>
      )}
    </div>
  );
}

export default VideoChat;
