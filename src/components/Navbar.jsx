import { Link, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

const Navbar = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const adminMenuRef = useRef(null);
  const mobileMenuRef = useRef(null);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  // Cerrar menús al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (adminMenuRef.current && !adminMenuRef.current.contains(event.target)) {
        setAdminMenuOpen(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target) &&
          !event.target.closest('.hamburger-btn')) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isAuthenticated) return null;

  const isAdmin = Number(user?.role) === 1;
  const navbarClass = isAdmin ? 'navbar navbar-admin' : 'navbar navbar-user';

  return (
    <nav className={navbarClass}>
      <div className="navbar-left">
        <div className="navbar-brand">
          <Link to="/dashboard">Guías de Remisión</Link>
        </div>
        <div className={`navbar-menu ${mobileMenuOpen ? 'open' : ''}`} ref={mobileMenuRef}>
          <Link to="/dashboard" className="navbar-item" onClick={closeMobileMenu}>Dashboard</Link>
          <Link to="/viajes-cliente" className="navbar-item" onClick={closeMobileMenu}>Viajes</Link>
          <Link to="/documents" className="navbar-item" onClick={closeMobileMenu}>Documentos</Link>
          {isAdmin && (
            <Link to="/upload" className="navbar-item" onClick={closeMobileMenu}>Subir PDF</Link>
          )}
          {isAdmin && (
            <div className="navbar-dropdown" ref={adminMenuRef}>
              <button 
                className="navbar-item dropdown-toggle"
                onClick={() => setAdminMenuOpen(!adminMenuOpen)}
              >
                Tarifas e Info ▾
              </button>
              {adminMenuOpen && (
                <div className="dropdown-menu">
                  <Link to="/admin/tarifas" className="dropdown-item"
                    onClick={() => { setAdminMenuOpen(false); closeMobileMenu(); }}>
                    Tarifas de Clientes
                  </Link>
                  <Link to="/admin/empresas" className="dropdown-item"
                    onClick={() => { setAdminMenuOpen(false); closeMobileMenu(); }}>
                    Empresas de Transporte
                  </Link>
                  <Link to="/admin/unidades" className="dropdown-item"
                    onClick={() => { setAdminMenuOpen(false); closeMobileMenu(); }}>
                    Unidades (Placas)
                  </Link>
                </div>
              )}
            </div>
          )}
          <div className="navbar-end-mobile">
            <span className="navbar-user-info">
              {user?.email} ({isAdmin ? 'Admin' : 'Usuario'})
            </span>
            <button onClick={() => { handleLogout(); closeMobileMenu(); }} className="btn-logout">
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>

      <div className="navbar-end">
        <span className="navbar-user-info">
          {user?.email} ({isAdmin ? 'Admin' : 'Usuario'})
        </span>
        <button onClick={handleLogout} className="btn-logout">
          Cerrar Sesión
        </button>
      </div>

      <button
        className="hamburger-btn"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label="Menú"
      >
        <span className={`hamburger-line ${mobileMenuOpen ? 'open' : ''}`}></span>
        <span className={`hamburger-line ${mobileMenuOpen ? 'open' : ''}`}></span>
        <span className={`hamburger-line ${mobileMenuOpen ? 'open' : ''}`}></span>
      </button>
    </nav>
  );
};

export default Navbar;
