import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Dashboard from './pages/Dashboard'
import Training from './pages/Training'
import Analysis from './pages/Analysis'
import ModelInfo from './pages/ModelInfo'
import { getHealth } from './services/api'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', description: 'Stock predictions & insights' },
  { to: '/training', label: 'Training', description: 'Train & fine-tune models' },
  { to: '/analysis', label: 'Analysis', description: 'Market data & charts' },
  { to: '/model', label: 'Model Info', description: 'Architecture & specs' },
]

// ==================== Sidebar Component ====================
function Sidebar({ isMobileMenuOpen, onCloseMobile }) {
  const location = useLocation()
  const [backendStatus, setBackendStatus] = useState('checking')
  const [modelStatus, setModelStatus] = useState('unknown')
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const health = await getHealth()
        setBackendStatus(health.status === 'ok' || health.status === 'healthy' ? 'online' : 'degraded')
        setModelStatus(health.cuda_available ? 'GPU' : 'CPU')
      } catch (error) {
        setBackendStatus('offline')
      }
    }
    checkHealth()
    const interval = setInterval(checkHealth, 30000)
    return () => clearInterval(interval)
  }, [])

  const statusColor = {
    online: '#2563eb',
    offline: '#dc2626',
    degraded: '#f59e0b',
    checking: '#94a3b8',
    unknown: '#94a3b8'
  }

  return (
    <aside style={{
      width: '260px',
      background: '#ffffff',
      borderRight: '1px solid #e2e8f0',
      padding: '24px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      flexShrink: 0,
      height: '100vh',
      position: isMobile ? 'fixed' : 'relative',
      top: 0,
      left: 0,
      zIndex: isMobile ? 1000 : 'auto',
      ...(isMobile && !isMobileMenuOpen ? { display: 'none' } : {})
    }}>
      {/* Logo */}
      <div style={{
        padding: '0 12px 20px',
        borderBottom: '1px solid #e2e8f0',
        marginBottom: '16px'
      }}>
        <div style={{
          fontSize: '20px',
          fontWeight: '700',
          color: '#1e293b',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <span style={{ color: '#2563eb' }}>Stock Trend</span>
          <span style={{ color: '#1e293b' }}>Prediction</span>
        </div>
        <div style={{
          fontSize: '11px',
          color: '#64748b',
          marginTop: '6px',
          fontFamily: 'monospace'
        }}>
          LSTM-Attention Platform
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {NAV_ITEMS.map(({ to, label, description }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onCloseMobile}
            title={description}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '14px',
              color: isActive ? '#2563eb' : '#475569',
              textDecoration: 'none',
              transition: 'all 0.2s ease',
              fontWeight: isActive ? '600' : '500',
              background: isActive ? '#eff6ff' : 'transparent',
            })}
          >
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Status Footer */}
      <div style={{
        marginTop: 'auto',
        padding: '16px 12px',
        fontSize: '11px',
        color: '#64748b',
        borderTop: '1px solid #e2e8f0'
      }}>
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: statusColor[backendStatus],
              display: 'inline-block',
              marginRight: '8px'
            }} />
            <span style={{ color: '#475569' }}>
              Backend: {' '}
              <span style={{ color: statusColor[backendStatus], fontWeight: '500' }}>
                {backendStatus === 'online' ? 'Connected' :
                  backendStatus === 'offline' ? 'Offline' : 'Checking...'}
              </span>
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#94a3b8',
              display: 'inline-block',
              marginRight: '8px'
            }} />
            <span style={{ color: '#475569' }}>Model: {modelStatus}</span>
          </div>
        </div>
        <div style={{
          background: '#f8fafc',
          padding: '12px',
          borderRadius: '8px',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ color: '#475569', marginBottom: '4px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Data Source</div>
          <div style={{ color: '#1e293b', fontFamily: 'monospace', fontSize: '12px', fontWeight: '500' }}>Yahoo Finance</div>
          <div style={{ color: '#475569', marginTop: '8px', marginBottom: '4px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>API Endpoint</div>
          <div style={{ color: '#1e293b', fontFamily: 'monospace', fontSize: '11px' }}>localhost:8000</div>
        </div>
      </div>
    </aside>
  )
}

// ==================== Mobile Header ====================
function MobileHeader({ onMenuToggle }) {
  return (
    <div className="mobile-header" style={{
      display: 'none',
      padding: '16px',
      background: '#ffffff',
      borderBottom: '1px solid #e2e8f0',
      alignItems: 'center',
      justifyContent: 'space-between'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <span style={{ fontSize: '18px', fontWeight: '700', color: '#2563eb' }}>Stock Trend</span>
        <span style={{ fontSize: '12px', fontWeight: '600', color: '#1e293b' }}>Prediction</span>
      </div>
      <button
        onClick={onMenuToggle}
        style={{
          background: '#f1f5f9',
          border: 'none',
          color: '#475569',
          padding: '8px 12px',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '18px'
        }}
      >
        ☰
      </button>
    </div>
  )
}

// ==================== App Content (inside Router) ====================
function AppContent() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  const location = useLocation()

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768)
      if (window.innerWidth > 768) setMobileMenuOpen(false)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location])

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: '#f8fafc'
    }}>
      {/* Mobile overlay */}
      {isMobile && mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 999
          }}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        isMobileMenuOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Content */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        overflow: 'auto'
      }}>
        <MobileHeader onMenuToggle={() => setMobileMenuOpen(true)} />

        <main style={{
          flex: 1,
          overflow: 'auto',
          background: '#f8fafc'
        }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/training" element={<Training />} />
            <Route path="/analysis" element={<Analysis />} />
            <Route path="/model" element={<ModelInfo />} />
            <Route path="*" element={
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                padding: '40px',
                color: '#64748b'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>404</div>
                <h2 style={{ color: '#1e293b', marginBottom: '8px' }}>Page Not Found</h2>
                <NavLink to="/" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: '600' }}>
                  ← Back to Dashboard
                </NavLink>
              </div>
            } />
          </Routes>
        </main>
      </div>
    </div>
  )
}

// ==================== Root App (wraps with Router) ====================
export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}