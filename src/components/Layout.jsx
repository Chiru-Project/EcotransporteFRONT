import { Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from './Navbar';
import './Layout.css';

const Layout = () => {
  const { user } = useAuth();
  
  // Determinar la clase del layout según el rol (comparar como número)
  // Admin (role 1) = fondo blanco + navbar rojo
  // User (role 2) = todo verde
  const isAdmin = Number(user?.role) === 1;
  const layoutClass = isAdmin ? 'layout layout-user' : 'layout layout-admin';

  return (
    <div className={layoutClass}>
      <Navbar />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
