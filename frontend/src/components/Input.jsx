import React from 'react'

export default function Input({ label, type='text', value, onChange, name, placeholder, error, children, ...rest }){
  return (
    <label className="form-label">
      <span className="form-label-text">{label}</span>
      <div className="input-wrap">
        <input className={`input ${error? 'input-error':''}`} type={type} name={name} value={value} onChange={onChange} placeholder={placeholder} {...rest} />
        {children}
      </div>
      {error && <div className="form-error">{error}</div>}
    </label>
  )
}
