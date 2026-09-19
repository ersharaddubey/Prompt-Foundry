import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Admin from './pages/Admin';
import Login from './pages/Login';
import Register from './pages/Register';
import Generate from './pages/Generate';
import Pricing from './pages/Pricing';
import Favorites from './pages/Favorites';
import PromptDetail from './pages/PromptDetail';
import History from './pages/History';
import Challenge from './pages/Challenge';
import Battle from './pages/Battle';

function PrivateRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/generate" element={<Generate />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/prompt/:id" element={<PromptDetail />} />
          <Route path="/history" element={<PrivateRoute><History /></PrivateRoute>} />
          <Route path="/challenge" element={<Challenge />} />
          <Route path="/battle" element={<Battle />} />
          <Route
            path="/admin"
            element={
              <PrivateRoute>
                <Admin />
              </PrivateRoute>
            }
          />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Admin />
              </PrivateRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
