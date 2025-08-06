import { useAuth } from '../AuthContext';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import VideoChat from '../components/VideoChat';

function Dashboard() {
  const { user } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const dummyUsers = [
    { id: 1, name: "Ahmed" },
    { id: 2, name: "Zara" },
    { id: 3, name: "Zain" }
  ]; 

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-semibold">🎥 NexCall Dashboard</h1>
        <button
          onClick={handleLogout}
          className="bg-red-500 text-white px-4 py-2 rounded"
        >
          Logout
        </button>
      </div>

      <p className="mb-4 text-gray-600">Logged in as: {user?.displayName}</p>

      <div className="bg-white shadow rounded p-4">
        <h2 className="text-xl font-medium mb-4">Online Users</h2>
        <ul className="space-y-2">
          {dummyUsers.map((u) => (
            <li
              key={u.id}
              className="flex items-center justify-between p-3 bg-gray-100 rounded"
            >
              <span>{u.name}</span>
              <button className="bg-blue-500 text-white px-3 py-1 rounded">
                Call
              </button>
            </li>
          ))}
        </ul>
      </div>
      <VideoChat />
    </div>
  );
}

export default Dashboard;