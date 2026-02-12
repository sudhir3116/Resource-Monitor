import React from 'react'

export default function Button({ children, variant='primary', loading, ...rest }){
  return (
    <button className={`btn btn-${variant}`} disabled={loading} {...rest}>
      {loading ? <span className="spinner-inline" /> : children}
    </button>
  )
}
