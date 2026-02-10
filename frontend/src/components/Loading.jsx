import React from 'react'

export default function Loading({ small }) {
  return (
    <div style={{ padding: small ? 8 : 24, textAlign: 'center' }}>
      <div className="spinner" style={{ display: 'inline-block', width: small ? 20 : 36, height: small ? 20 : 36, border: '4px solid #e5e7eb', borderTop: '4px solid #0f766e', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
