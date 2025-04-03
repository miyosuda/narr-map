import './css/style.css'

import { createRoot } from 'react-dom/client'
import MindMap from '@/components/mindmap/mindmap'

function App() {
  return (
    <main className="flex justify-center items-center h-screen">
      <div className="flex w-full h-screen">
        <div className="flex flex-col w-full h-full">
          <MindMap />
        </div>
      </div>
    </main>
  )
}

function render() {
  const root = createRoot(document.getElementById('root'))
  root.render(<App />)
}

render()
