import { NodeState, NodeDrawStateMapType, EDIT_STATE_NONE } from '@/types'
import { HOVER_STATE_TOP, HOVER_STATE_RIGHT, HOVER_STATE_LEFT } from '@/types'
import { isRoot, isDummy, getTextWithSymbol } from '@/utils/node-utils'
import { HANDLE_WIDTH, HANDLE_HEIGHT, calcHandlePos } from '@/utils/node-draw-utils';

const REGEX_RED_CIRCLE     = /^\(r\)/i;
const REGEX_GREEN_CIRCLE   = /^\(g\)/i;
const REGEX_BLUE_CIRCLE    = /^\(b\)/i;
const REGEX_YELLOW_CIRCLE  = /^\(y\)/i;

const RED_CIRCLE_EMOJI    = String.fromCodePoint(0x1F534);
const GREEN_CIRCLE_EMOJI  = String.fromCodePoint(0x1F7E2);
const BLUE_CIRCLE_EMOJI   = String.fromCodePoint(0x1F535);
const YELLOW_CIRCLE_EMOJI = String.fromCodePoint(0x1F7E1);

const LINE_RGB_COLOR = 'rgb(113,113,122)'; // tailwindのzinc-500と合わせた色味

const calcEdgeOutPos = (state: NodeState,
                        x: number,
                        y: number,
                        width: number,
                        height: number) => {
  if(isRoot(state)) {
    return {
      x : x + width / 2,
      y : y + height / 2,
    };
  } else {
    if(state.isLeft) {
      return {
        x : x,
        y : y + height - 0.5 // lineの幅を考慮している
      };
    } else {
      return {
        x : x + width,
        y : y + height - 0.5 // lineの幅を考慮している
      };
    }
  }
}


const calcEdgeInPos = (state: NodeState,
                       x: number,
                       y: number,
                       width: number,
                       height: number) => {
  const edgeEndPosY = y + height - 0.5; // lineの幅を考慮している

  let edgeEndPosX
  if(state.isLeft) {
    edgeEndPosX = x + width;
  } else {
    edgeEndPosX = x;
  }

  return {
    x : edgeEndPosX,
    y : edgeEndPosY
  };
}

const calcFoldMarkPos = (state: NodeState,
                         x: number,
                         y: number,
                         width: number,
                         height: number) => {
  if(state.isLeft) {
    return {
      x : x,
      y : y + height
    };
  } else {
    return {
      x : x + width,
      y : y + height
    };
  }
}

const formatEmoji = (text : string) => {
  text = text.replace(REGEX_RED_CIRCLE,    RED_CIRCLE_EMOJI);
  text = text.replace(REGEX_GREEN_CIRCLE,  GREEN_CIRCLE_EMOJI);
  text = text.replace(REGEX_BLUE_CIRCLE,   BLUE_CIRCLE_EMOJI);
  text = text.replace(REGEX_YELLOW_CIRCLE, YELLOW_CIRCLE_EMOJI);
  return text;
}

const getHoverSelectedStyle = (
  hoverState : number,
  selected: boolean,
  isRoot: boolean,
  darkMode: darkMode) : string => {
  
  let styleClass : string = '';
  
  if(hoverState === HOVER_STATE_TOP) {
    styleClass = darkMode ?
                 'bg-gradient-to-t from-black to-zinc-400' :
                 'bg-gradient-to-t from-white to-zinc-400';
  } else if( hoverState === HOVER_STATE_RIGHT ) {
    styleClass = darkMode ?
                 'bg-gradient-to-r from-black to-zinc-400' :
                 'bg-gradient-to-r from-white to-zinc-400';
  } else if( hoverState === HOVER_STATE_LEFT ) {
    styleClass = darkMode ?
                 'bg-gradient-to-l from-black to-zinc-400' :
                 'bg-gradient-to-l from-white to-zinc-400';
  } else if(selected) {
    // TODO: 色味調整
    styleClass = darkMode ? 'bg-zinc-600' : 'bg-zinc-300';
  } else if(isRoot) {
    styleClass = darkMode ? 'bg-black' : 'bg-white';
  }
    
  return styleClass
}


interface TextProps {
  isRoot: boolean;
  text: string;
  width : number;
  height : number;
  x: number;
  y: number;
  hoverState : number;
  selected : boolean;
  darkMode : boolean;
}

const Text = (props: TextProps) => {
  const classList: string[] = [];
  if(props.isRoot) {
    classList.push('border border-zinc-500 rounded-md p-[2px_3px_3px_4px]');
  } else {
    classList.push('border-b border-zinc-500 p-[0px_3px_0px_4px]');
  }

  if( props.darkMode ) {
    classList.push('text-white');
  } else {
    classList.push('text-black');
  }
  
  const hoverSelectedStyle = getHoverSelectedStyle(props.hoverState,
                                                   props.selected,
                                                   props.isRoot,
                                                   props.darkMode);

  if(hoverSelectedStyle !== '') {
    classList.push(hoverSelectedStyle);
  }
  
  return (
    <foreignObject
    className={classList.join(' ')}
    visibility='visible'
    width={props.width}
    height={props.height}
    x={props.x}
    y={props.y}
    >
    <span className='select-none whitespace-nowrap'>
    {formatEmoji(props.text)}
    </span>
    </foreignObject>
  )
};


interface LineProps {
  x1 : number;
  y1 : number;
  x2 : number;
  y2 : number;
}

const Line = (props: LineProps) => {
  return (
    <line
      x1={props.x1}
      y1={props.y1}
      x2={props.x2}
      y2={props.y2}
      stroke={LINE_RGB_COLOR}
      strokeWidth='1'>
    </line>
  )
};

const FOLD_MARK_RADIUS = 3;

interface FoldMarkProps {
  x : number;
  y : number;
  darkMode: boolean;
}

const FoldMark = (props: FoldMarkProps) => {
  const fillColor = props.darkMode ? '#000000' : '#ffffff';
  
  return (
    <circle
      stroke={LINE_RGB_COLOR}
      fill={fillColor}
      strokeWidth='1'
      cx={props.x}
      cy={props.y}
      r={FOLD_MARK_RADIUS}
    >
    </circle>
  )
};


interface HandleProps {
  x : number;
  y : number;
  darkMode : boolean;
}

const Handle = (props: HandleProps) => {
  const fillColor = props.darkMode ? '#000000' : '#ffffff';
  
  return (
    <ellipse
    stroke='#7f7f7f'
    fill={fillColor}
    strokeWidth='1'
    cx={props.x + HANDLE_WIDTH/2}
    cy={props.y + HANDLE_HEIGHT/2}
    rx={HANDLE_WIDTH/2}
    ry={HANDLE_HEIGHT/2+1}
    >
    </ellipse>
  )
};


interface NodeProps {
  state: NodeState;
  drawStateMap: NodeDrawStateMapType;
  edgeStartX: number;
  edgeStartY: number;
  darkMode : boolean;
}

export const Node = (props: NodeProps) => {
  const { state, drawStateMap, edgeStartX, edgeStartY, darkMode } = props;

  const displayText = getTextWithSymbol(state.text, state.symbol);

  const { x, y, width, height } = drawStateMap[state.id];
  
  let edgeEndX : number = 0;
  let edgeEndY : number = 0;
  
  if( !isRoot(state) ) {
    const { x: edgeEndX_, y: edgeEndY_ } = calcEdgeInPos(state, x, y, width, height);
    edgeEndX = edgeEndX_;
    edgeEndY = edgeEndY_;
  }

  // 子ノードのY方向の開始位置
  const { x: childEdgeStartX, y: childEdgeStartY } = calcEdgeOutPos(state, x, y, width, height);
  const { x: handleX, y: handleY } = calcHandlePos(state, x, y, width);
  const { x: foldMarkX, y: foldMarkY } = calcFoldMarkPos(state, x, y, width, height);

  return (
    <>
      {
        ((state.accompaniedState != null) &&
         (
           <Node
             key={state.accompaniedState.id}
             state={state.accompaniedState}
             drawStateMap={drawStateMap}
             edgeStartX={edgeStartX}
             edgeStartY={edgeStartY}
             darkMode={darkMode}
           />
         )
        )
      }
      {
        (!state.folded && state.children) &&
        state.children.map(childState => 
          (
            <Node
              key={childState.id}
              state={childState}
              drawStateMap={drawStateMap}
              edgeStartX={childEdgeStartX}
              edgeStartY={childEdgeStartY}
              darkMode={darkMode}
            />
          )
        )
      }
      {
        (!isDummy(state) && state.editState === EDIT_STATE_NONE) &&
        <Text
          isRoot={isRoot(state)}
          text={displayText}
          width={width}
          height={height}
          x={x}
          y={y}
          hoverState={state.hoverState}
          selected={state.selected}
          darkMode={darkMode}
        ></Text>
      }
      {
        !isRoot(state) &&
        <Line
          x1={edgeStartX}
          y1={edgeStartY}
          x2={edgeEndX!}
          y2={edgeEndY!}
        ></Line>
      }
      {
        (state.folded && state.children) &&
        <FoldMark
          x={foldMarkX}
          y={foldMarkY}
          darkMode={darkMode}
        ></FoldMark>
      }
      {
        state.handleShown &&
        <Handle
          x={handleX}
          y={handleY}
          darkMode={darkMode}
        ></Handle>
      }
    </>
  );
};
