import { Routes, Route, Link, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useState } from 'react';
import { auth, provider } from './firebase';
import { signInWithPopup, signOut } from 'firebase/auth';

function Home() {
  return <h1 className="text-center mt-10 text-3xl">Welcome to NexCall</h1>;
}

function Login() {
  const [user, setUser] = useState(null);

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      setUser(result.user);
    } catch (err) {
      console.error("Login error:", err);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  return (
    <div className="text-center mt-10">
      {user ? (
        <div>
          <h2 className="text-2xl mb-4">Welcome, {user.displayName}</h2>
          <img
            src={user.photoURL}
            alt="User"
            className="mx-auto rounded-full w-20 h-20 mb-4"
          />
          <button
            onClick={handleLogout}
            className="bg-red-500 text-white px-4 py-2 rounded"
          >
            Logout
          </button>
        </div>
      ) : (
        <button
          onClick={handleLogin}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Sign in with Google
        </button>
      )}
    </div>
  );
}

function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="text-center mt-10">
      <h1 className="text-3xl mb-2">🎥 Call Dashboard</h1>
      <p className="text-gray-600">Logged in as {user?.displayName}</p>
      {/* Online users, join call button, etc. will go here */}
    </div>
  );
}

function App() {
  const { user } = useAuth();

  return (
    <div>
      <nav className="p-4 bg-gray-800 text-white flex space-x-4">
        <Link to="/" className="hover:underline">Home</Link>
        <Link to="/login" className="hover:underline">Login</Link>
        <Link to="/dashboard" className="hover:underline">Dashboard</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/dashboard"
          element={user ? <Dashboard /> : <Navigate to="/login" replace />}
        />
      </Routes>
    </div>
  );
}

export default App;
