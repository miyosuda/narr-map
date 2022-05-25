// textノードのサイズを取得
export const getElementDimension = (html, className=null) => {
  const element = document.createElement('span')
  
  // elementのsizeは子に依存
  element.style.display = 'inline-block'
  element.style.visibility = 'hidden'
  element.innerHTML = html

  if( className != null ) {
    element.className = className
  }
  
  document.body.append(element)
  
  const dims = {}
  // 上下左右2px幅を広げている
  dims.width = element.getBoundingClientRect().width + 2
  dims.height = element.getBoundingClientRect().height + 2

  element.remove()
  return dims
}

