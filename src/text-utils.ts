// textノードのサイズを取得
export const getElementDimension = (html : string,
                                    className : string|null=null) => {
  const element = document.createElement('foreignObject');
  
  // elementのsizeは子に依存
  element.style.display = 'inline-block';
  element.style.visibility = 'hidden';
  element.innerHTML = html;

  if( className != null ) {
    element.className = className;
  }
  
  document.body.append(element);
  
  const dims = {
    'width' : element.getBoundingClientRect().width,
    'height' : element.getBoundingClientRect().height,
  }
  
  element.remove();
  return dims;
}
