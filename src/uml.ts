import { StateType } from './types'


function getStateUMLStr(state : StateType,
                        level : number,
                        skip : boolean) : string {

  let uml = '';

  if(!skip) {
    for(let i=0; i<level; i++) {
      uml += '+';
    }
    uml += ' ';
    uml += state['text'];
    uml += '\n';
  }
  
  state.children.forEach((childState : StateType) => {
    uml += getStateUMLStr(childState, level+1, false);
  })

  return uml;
}


export function convertStateToPlanetUML(state : StateType) : string {
  let uml = '@startmindmap\n';

  uml += getStateUMLStr(state['right'], 1, false);
  uml += getStateUMLStr(state['left'], 1, true);
  
  uml += '@endmindmap\n';
  return uml;
}
