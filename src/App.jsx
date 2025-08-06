import { Routes, Route, Link } from 'react-router-dom';

function Home() {
  return <h1 className="text-center mt-10 text-3xl">Welcome to NexCall</h1>;
}

function Login() {
  return <h1 className="text-center mt-10 text-3xl">Login Page (coming soon)</h1>;
}

function Dashboard() {
  return <h1 className="text-center mt-10 text-3xl">Dashboard (coming soon)</h1>;
}

function App() {
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
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </div>
  );
}

export default App;
