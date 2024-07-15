interface RectProps {
  x : number;
  y : number;
  width : number;
  height : number;  
}

export const Rect = (props: RectProps) => {
  return (
    <rect
      x={props.x}
      y={props.y}
      width={props.width}
      height={props.height}
      fill='none'
      stroke='#7f7f7f'
      strokeWidth='2'>
    </rect>
  )
};
