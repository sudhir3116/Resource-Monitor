import React from 'react'

export default function Card({ children, className='' }){
  return (
    <div className={`card card-auth ${className}`}>
      {children}
    </div>
  )
}
