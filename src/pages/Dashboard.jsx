import React, { useEffect, useState } from "react";
import { ref, onValue, set } from "firebase/database";
import { database } from "../firebase";
import VideoChat from "../components/VideoChat";
import { v4 as uuidv4 } from "uuid";

export default function Dashboard() {
  const [users, setUsers] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);

  useEffect(() => {
    const usersRef = ref(database, "users");
    const unsub = onValue(usersRef, (snap) => {
      const data = snap.val() || {};
      setUsers(Object.keys(data).map((k) => ({ id: k, ...data[k] })));
    });
    return () => unsub();
  }, []);

  const startCallToUser = (user) => {
    // generate a new room id
    const roomId = `room-${user.id}-${Date.now()}`;
    setSelectedRoom(roomId);
  };

  const createNewFaceTime = () => {
    const newRoomId = `room-${uuidv4()}`;
    setSelectedRoom(newRoomId);
    // Optionally create a new empty room in DB for signaling (not required)
    set(ref(database, `rooms/${newRoomId}`), { createdAt: Date.now() });
  };

  return (
    <div className="w-full h-screen bg-gradient-to-b from-gray-900 to-black text-white flex">
      {/* Left sidebar */}
      <aside className="w-[340px] p-6 border-r border-black/40 flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <div className="text-2xl font-semibold">FaceTime</div>
        </div>

        <div className="mb-6 space-y-3">
          <button
            onClick={createNewFaceTime}
            className="w-full bg-white/10 hover:bg-white/20 text-white py-2 rounded-lg"
          >
            ➕ New FaceTime
          </button>
          <button className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg">
            🔗 Create Link
          </button>
        </div>

        <div className="text-sm text-gray-300 mb-3">Contacts</div>
        <div className="flex flex-col gap-4 overflow-auto max-h-[70vh] pr-2">
          {users.length === 0 && (
            <div className="text-gray-400">
              No users found (add users in Firebase)
            </div>
          )}
          {users.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between bg-white/5 p-3 rounded-xl"
            >
              <div className="flex items-center gap-3">
                <img
                  src={
                    u.avatar ||
                    `https://api.dicebear.com/6.x/initials/svg?seed=${u.name}`
                  }
                  alt={u.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-white"
                />
                <div>
                  <div className="font-medium">{u.name || "Unknown"}</div>
                  <div className="text-xs text-gray-400">
                    {u.status || "Available"}
                  </div>
                </div>
              </div>
              <div>
                <button
                  onClick={() => startCallToUser(u)}
                  className="px-3 py-2 bg-green-600 rounded-full"
                >
                  📞
                </button>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Right panel: video area */}
      <main className="flex-1 relative">
        {selectedRoom ? (
          <VideoChat roomId={selectedRoom} />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-center px-6">
            <div className="text-3xl font-semibold mb-4">Ready to FaceTime</div>
            <p className="text-gray-400 mb-6">
              Select a contact on the left to start a call
            </p>
            <div className="grid grid-cols-3 gap-4 w-full max-w-xl">
              {/* show placeholders */}
              <div className="bg-white/5 h-32 rounded-xl"></div>
              <div className="bg-white/5 h-32 rounded-xl"></div>
              <div className="bg-white/5 h-32 rounded-xl"></div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
