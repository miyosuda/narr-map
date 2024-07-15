import './css/style.css';

import { createRoot } from 'react-dom/client';
import { useState, useEffect } from 'react';
import { NodeState } from '@/types';
import { getNodeState, updateNodes } from '@/utils/node-utils';
import MindMap from '@/components/mindmap/mindmap'
const { nmAPI } = window;

const EDIT_HISTORY_MAX = 30;


const execCommands = [
  'copy',
  'paste',
  'cut',
  'undo',
  'redo',
  'selectall'
];


export default function App() {
  const initialRootState = getNodeState({
    id: 0,
    text: 'root',
    selected: true,
    editId: 0,
    accompaniedState: getNodeState({
      id: 1,
      editId: 1,
      isLeft: true
    })
  });

  useEffect(() => {
    nmAPI.onReceiveMessage((arg : string, obj : any) => {
      if( execCommands.some(element => element === arg) ) {
        document.execCommand(arg);
      }
    });
  }, []);
  
  const [rootState, setRootState] = useState(initialRootState);
  const [stateHistory, setStateHistory] = useState<NodeState[]>([initialRootState]);
  const [historyCursor, setHistoryCursor] = useState(0);
  const [nextNodeId, setNextNodeId] = useState(2); // Node ID管理
  const [nextEditId, setNextEditId] = useState(2); // Edit ID管理
  
  const setRootStateWithHistory = (newRootState: NodeState) : void => {
    setRootState(newRootState);

    let newStateHistory;
    if( historyCursor !== stateHistory.length-1 ) {
      newStateHistory = [...stateHistory.slice(0, historyCursor+1), newRootState];
    } else {
      newStateHistory = [...stateHistory, newRootState];
    }

    if(newStateHistory.length > EDIT_HISTORY_MAX) {
      newStateHistory = newStateHistory.slice(1);
      setStateHistory(newStateHistory);
    } else {
      setStateHistory(newStateHistory);
      setHistoryCursor(historyCursor+1);
    }
  }

  const undo = () => {
    if( historyCursor > 0 ) {
      setRootState(stateHistory[historyCursor-1]);
      setHistoryCursor(historyCursor-1);
    }
  }

  const redo = () => {
    if( historyCursor < stateHistory.length-1 ) {
      setRootState(stateHistory[historyCursor+1]);
      setHistoryCursor(historyCursor+1);
    }
  }

  return (
    <main className='flex justify-center items-center h-screen'>
      <div className='flex w-full h-screen'>
        <div className='flex flex-col w-full h-full'>
          <MindMap 
            rootState={rootState}
            setRootState={setRootState} 
            setRootStateWithHistory={setRootStateWithHistory}
            nextNodeId={nextNodeId}
            setNextNodeId={setNextNodeId}
            nextEditId={nextEditId}        
            setNextEditId={setNextEditId}
            undo={undo}
            redo={redo}/>
        </div>
      </div>
    </main>
  );
}

function render() {
  const root = createRoot(document.getElementById("root"));
  root.render(<App />);
}

render();
