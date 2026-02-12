import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props){
    super(props)
    this.state = { error: null, info: null }
  }

  static getDerivedStateFromError(error){
    return { error }
  }

  componentDidCatch(error, info){
    console.error('Unhandled render error', error, info)
    this.setState({ info })
  }

  render(){
    if (this.state.error) {
      return (
        <div style={{padding:40,textAlign:'center'}}>
          <h2>Something went wrong</h2>
          <p style={{color:'#666'}}>The application encountered an error. You can try reloading the page.</p>
          <button onClick={()=>window.location.reload()} style={{marginTop:12,padding:'8px 12px'}}>- Reload -</button>
          <details style={{marginTop:16,textAlign:'left',maxWidth:800,margin:'16px auto'}}>
            <summary>Technical details</summary>
            <pre style={{whiteSpace:'pre-wrap',fontSize:12,color:'#111'}}>{String(this.state.error)}</pre>
            {this.state.info && <pre style={{whiteSpace:'pre-wrap',fontSize:12}}>{this.state.info.componentStack}</pre>}
          </details>
        </div>
      )
    }
    return this.props.children
  }
}
