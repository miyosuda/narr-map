import { describe, it, expect } from 'vitest'
import { convertStateToPlanetUML, convertPlanetUMLToState } from '../src/uml'

describe('UML', () => {
  it('should be able convert state to PlanetUML', () => {
    const state = {
      'right' : {
        'text' : 'a',
        'children' : [
          {
            'text' : 'b',
            'children' : []
          },
          {
            'text' : 'c',
            'children' : []
          }
        ]
      },
      'left' : {
        'text' : '',
        'children' : []
      }
    };
    
    const uml = convertStateToPlanetUML(state);
    
    const expectedUML = `@startmindmap
+ a
++ b
++ c
@endmindmap
`;
    
    expect(uml).toBe(expectedUML);
  });


  it('should be able convert PlanetUML to state', () => {
    const uml = `@startmindmap
+ a
++ 1
++ 2
++ 3
+++ 4
+++ 5
+++ 6
++++ 7
++ 8
++ 9
+++ 10
+++ 11
@endmindmap
`;

    const state = convertPlanetUMLToState(uml);
    console.log(state);
  });  
})
