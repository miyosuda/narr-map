import {
  Node,
  SPAN_Y_PER_NODE,
  HOVER_HIT_NONE,
  HOVER_HIT_SIBLING,
  HOVER_HIT_CHILD,
  HOVER_HIT_OTHER_CHILD,
} from './node';
import { GhostNode } from './ghost-node';
import { TextInput } from './text-input';
import { EditHistory } from './edit-history';
import { Config } from './config';
import { StateType } from './types';
import { checkIsWindows } from './utils';
const { nmAPI } = window;

const DRAG_NONE  = 0
const DRAG_NODE  = 1
const DRAG_GHOST = 2
const DRAG_BACK  = 3

const MOVE_UP    = 1
const MOVE_DOWN  = 2
const MOVE_RIGHT = 3
const MOVE_LEFT  = 4

const KEYCODE_A = 65
const KEYCODE_C = 67
const KEYCODE_V = 86
const KEYCODE_X = 88


type SVGType = HTMLElement & SVGSVGElement;
type CanvasType = HTMLElement & SVGGraphicsElement;


export class MapManager {
  dragMode : number;
  dragStartX : number;
  dragStartY : number;
  nodes : Array<Node>;
  selectedNodes : Array<Node>;
  handleDraggingNode : Node | null;
  nodeEdited : boolean;
  cursorDepth : number;
  copyingStates : Array<StateType>;
  lastMouseDownTime : number;
  ghostNode : GhostNode;  
  svg : SVGType;
  canvas : CanvasType;
  textInput : TextInput;
  editHistory : EditHistory
  canvasTranslateX : number;
  canvasTranslateY : number;
  rootNode : Node | null;
  leftRootNode : Node | null;
  config : Config | null;
  startCanvasTranslateX : number | null;
  startCanvasTranslateY : number | null;
  
  constructor() {
  }

  init() {
    this.dragMode = DRAG_NONE;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.nodes = [];
    this.selectedNodes = [];
    this.handleDraggingNode = null;
    this.nodeEdited = false;
    this.cursorDepth = 0;
    this.copyingStates = [];
    this.lastMouseDownTime = -1;
    
    this.ghostNode.hide()
  }

  prepare() {
    this.svg = document.getElementById('svg') as SVGType;
    this.canvas = document.getElementById('canvas') as CanvasType;

    const width = this.svg.width.baseVal.value;
    const height = this.svg.height.baseVal.value;
    this.setCanvasTranslate(width/2, height/2);
    
    this.onResize();
    
    document.onmousedown = event => this.onMouseDown(event);
    document.ondblclick  = event => this.onDoubleClick(event);
    document.onmouseup   = event => this.onMouseUp(event);
    document.onmousemove = event => this.onMouseMove(event);
    document.body.addEventListener('keydown',  event => this.onKeyDown(event));
    this.textInput = new TextInput(this);

    nmAPI.onReceiveMessage((arg : string, obj : any) => {
      if( arg === 'save' ||
        arg === 'load' ||
        arg === 'new-file') {
        
        if( this.textInput.isShown ) {
          this.textInput.hide();
        }
      } else if( arg === 'cut' ||
        arg === 'undo' ||
        arg === 'redo' ||
        arg === 'copy' ||
        arg === 'paste' ||
        arg === 'selectall') {
        if( this.textInput.isShown ) {
          document.execCommand(arg);
          return;
        }
      }

      if( arg === 'save' ) {
        this.save();
      } else if( arg === 'load' ) {
        this.load(obj);
      } else if( arg === 'new-file' ) {
        this.newFile();
      } else if( arg === 'cut' ) {
        this.cut();
      } else if( arg === 'undo' ) {
        this.undo();
      } else if( arg === 'redo' ) {
        this.redo();
      } else if( arg === 'copy' ) {
        this.copy();
      } else if( arg === 'paste' ) {
        this.paste();
      } else if( arg === 'selectall') {
        this.selectAll();
      } else if( arg === 'dark-mode') {
        // TODO: 整理
        const config = new Config();
        const darkMode = obj;
        config.darkMode = darkMode;
        this.applyConfig(config)
      } else if( arg === 'export') {
        this.export();
      }
    })
    
    this.addGhostNode();
    
    this.init();

    // TODO: configの生成/設定
    const config = new Config();
    this.applyConfig(config);
    
    this.addRootNode();
    this.editHistory = new EditHistory(this.getState());
  }

  applyConfig(config : Config) {
	this.textInput.applyConfig(config);
	
    const body = document.getElementById('body');
    
    if(config.darkMode) {
      body.className = 'with-back-dark';
    } else {
      body.className = 'with-back-light';
    }

    this.nodes.forEach(node => {
      node.applyConfig(config);
    })

    this.config = config;
  }

  setCanvasTranslate(translateX : number, translateY : number) {
    this.canvasTranslateX = translateX;
    this.canvasTranslateY = translateY;
    
    this.canvas.setAttribute('transform', 'translate(' +
      this.canvasTranslateX + ',' +
      this.canvasTranslateY + ')');
  }
  
  onBackDragStart() {
    this.startCanvasTranslateX = this.canvasTranslateX;
    this.startCanvasTranslateY = this.canvasTranslateY;
  }

  onBackDrag(dx : number, dy : number) {
    const translateX = this.startCanvasTranslateX + dx;
    const translateY = this.startCanvasTranslateY + dy;

    this.setCanvasTranslate(translateX, translateY);
  }

  addRootNode() {
    const g = document.getElementById('overlay');
    
    const rightRootNode = new Node(null, g, this.config);
    rightRootNode.setText('root');
    this.nodes.push(rightRootNode);
    
    this.setNodeSelected(rightRootNode, true);

    const leftRootNode = new Node(null, g, this.config,
                                  true,
                                  rightRootNode);
    this.nodes.push(leftRootNode);

    this.rootNode = rightRootNode;
    this.leftRootNode = leftRootNode;
    
    this.updateLayout()
  }

  addGhostNode() {
    const g = document.getElementById('overlay') ;
    this.ghostNode = new GhostNode(g);
  }

  onResize() {
    // TODO:    
    // なぜかmarginをつけないとスクロールバーが出てしまう
    const margin = 2;
    
    this.svg.setAttribute('width', String(window.innerWidth - margin));
    this.svg.setAttribute('height', String(window.innerHeight - margin));
  }

  findPickNode(x : number,
               y : number,
               forHandle : boolean) {
    let pickNode = null;
    
    for(let i=0; i<this.nodes.length; i++) {
      const node = this.nodes[i];
      let hit = false;
      if(forHandle) {
        hit = node.containsPosForHandle(x, y);
      } else {
        hit = node.containsPos(x, y);
      }
      if(hit) {
        pickNode = node;
        break;
      }
    }
    return pickNode;
  }

  onMouseDown(e : MouseEvent) {
    if(e.which == 3) {
      // 右クリックの場合
      return;
    }

    if( this.textInput.isShown ) {
      // textInput表示中なら何もしない
      return;
    }

    this.nodeEdited = false;
    
    const localPos = this.getLocalPos(e);
    const x = localPos.x;
    const y = localPos.y;
    
    // マウスが乗ったnodeをpick対象として選ぶ
    const pickNodeForHandle = this.findPickNode(x, y, true);
    const pickNode = this.findPickNode(x, y, false);

    let dragMode = DRAG_NONE;
    const shiftDown = e.shiftKey;

    if(pickNodeForHandle != null) {
      pickNodeForHandle.onDragStart();
      this.handleDraggingNode = pickNodeForHandle;
      dragMode = DRAG_NODE;
    } else if(pickNode != null) {
      // pickNodeがあった場合
      if(shiftDown) {
        // shift押下時
        this.setNodeSelected(pickNode, true);
        if(!pickNode.isRoot) {
          dragMode = DRAG_GHOST;
          this.ghostNode.prepare(pickNode);
        } else {
          dragMode = DRAG_NONE;
        }
      } else {
        // pickしたnode以外のselectedをクリア
        this.clearNodeSelection(pickNode);
        if(!pickNode.isRoot) {
          dragMode = DRAG_GHOST;
          this.ghostNode.prepare(pickNode);
        } else {
          dragMode = DRAG_NONE;
        }        
      }
    } else {
      // 1つを除いてNode選択クリア
      const targetNode = this.selectedNodes[this.selectedNodes.length-1];
      this.clearNodeSelection(targetNode);
      dragMode = DRAG_BACK;
      this.onBackDragStart();
    }

    if(dragMode == DRAG_NODE || dragMode == DRAG_GHOST ) {
      this.dragStartX = x;
      this.dragStartY = y;
    } else if( dragMode == DRAG_BACK ) {
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
    }
    
    this.dragMode = dragMode;
  }

  recenter() {
    let globalLeft   = Number.POSITIVE_INFINITY;
    let globalRight  = Number.NEGATIVE_INFINITY;
    let globalTop    = Number.POSITIVE_INFINITY;
    let globalBottom = Number.NEGATIVE_INFINITY;
    
    this.nodes.forEach(node => {
      if(!node.isDummy && node.isVisible) {
        globalLeft   = Math.min(globalLeft,   node.left);
        globalRight  = Math.max(globalRight,  node.right);
        globalTop    = Math.min(globalTop,    node.top);
        globalBottom = Math.max(globalBottom, node.bottom);
      }
    })
    
    const centerX = (globalLeft + globalRight)  * 0.5;
    const centerY = (globalTop  + globalBottom) * 0.5;
    
    const width = this.svg.width.baseVal.value;
    const height = this.svg.height.baseVal.value;
    
    this.setCanvasTranslate(width/2 - centerX, height/2 - centerY);
  }

  onDoubleClick(e : MouseEvent) {
    if( this.textInput.isShown ) {
      // textInput表示中なら何もしない
      return;
    }

    if(e.shiftKey) {
      return;
    }
    
    const localPos = this.getLocalPos(e);
    const x = localPos.x;
    const y = localPos.y;

    const pickNode = this.findPickNode(x, y, false);

    if(pickNode != null) {
      this.textInput.show(pickNode);
    } else {
      this.recenter();
    }
  }

  onMouseMove(e : MouseEvent) {
    if(e.which == 3) {
      // 右クリックの場合
      return;
    }
    
    if(this.dragMode != DRAG_NONE) {
      const localPos = this.getLocalPos(e);
      const x = localPos.x;
      const y = localPos.y;
      
      const dx = x - this.dragStartX;
      const dy = y - this.dragStartY;

      if(this.dragMode == DRAG_NODE) {
        // 1つのノードだけを動かす
        const dragTargetNode = this.handleDraggingNode;
        dragTargetNode.onDrag(dx, dy);
        this.nodeEdited = true;
        this.updateLayout();
      } else if(this.dragMode == DRAG_GHOST) {
        // Ghostを移動
        if(!this.ghostNode.isShown) {
          const targetNode = this.lastNode;
          this.ghostNode.show();
        }
        this.ghostNode.onDrag(dx, dy)
        // マウスオーバーの対応
        this.nodes.forEach(node => {
          if(node != this.ghostNode.node) {
            node.checkGhostHover(x, y);
          }
        })
      } else {
        // Backを移動
        const globalDx = e.clientX - this.dragStartX;
        const globalDy = e.clientY - this.dragStartY;
        this.onBackDrag(globalDx, globalDy);
      }
    } else {
      const localPos = this.getLocalPos(e);
      const x = localPos.x;
      const y = localPos.y;
      
      // マウスオーバーの対応
      this.nodes.forEach(node => {
        node.checkHover(x, y);
      })
    }
  }

  onMouseUp(e : MouseEvent) {
    if(e.which == 3) {
      // 右クリックの場合
      return;
    }
    
    this.handleDraggingNode = null
    if(this.dragMode == DRAG_GHOST) {
      const localPos = this.getLocalPos(e);
      const x = localPos.x;
      const y = localPos.y;

      let hoverHit = HOVER_HIT_NONE;
      let hoverHitNode = null;

      for(let i=0; i<this.nodes.length; i++) {
        const node = this.nodes[i];

        const ret = node.checkGhostHover(x, y);
        if(ret != HOVER_HIT_NONE && node !== this.ghostNode.node) {
          hoverHit = ret;
          hoverHitNode = node;
        }
        
        node.clearGhostHover();
      }
      
      if(hoverHit != HOVER_HIT_NONE) {
        if(hoverHit == HOVER_HIT_CHILD) {
          const newChildNode = this.ghostNode.node;

          if(!hoverHitNode.hasNodeInAncestor(newChildNode)) {
            // hoverHitNodeがnewChildNodeの子孫だったらNG
            const oldParentNode = newChildNode.detachFromParent();

            // TODO: 要整理
            if(newChildNode.isLeft != hoverHitNode.isLeft) {
              newChildNode.changeSideRecursive(hoverHitNode.isLeft);
            }
            
            hoverHitNode.attachChildNodeToTail(newChildNode);
            this.nodeEdited = true;

            this.updateLayout()
          }
        } else if(hoverHit == HOVER_HIT_OTHER_CHILD) {
          // rootの左側にhitした場合
          const newChildNode = this.ghostNode.node;

          // TODO: 要整理
          if(!newChildNode.isLeft) {
            // 右から左へ持ってきた場合
            newChildNode.changeSideRecursive(true);
          }
          
          const oldParentNode = newChildNode.detachFromParent();
          this.leftRootNode.attachChildNodeToTail(newChildNode);
          
          this.nodeEdited = true;
          this.updateLayout();
        } else if(hoverHit == HOVER_HIT_SIBLING) {
          const newChildNode = this.ghostNode.node;
          
          if(!hoverHitNode.hasNodeInAncestor(newChildNode)) {
            const newParentNode = hoverHitNode.parentNode;
            const oldParentNode = newChildNode.detachFromParent();
            // hoverHitNodeがnewChildNodeの子孫だったら何もしない
            newParentNode.attachChildNodeAboveSibling(newChildNode, hoverHitNode);
            this.nodeEdited = true;
            this.updateLayout();
          }
        }
      }
      this.ghostNode.hide();
    }
    
    this.dragMode = DRAG_NONE;

    if(this.nodeEdited) {
      // undoバッファ対応
      this.storeState();
      this.nodeEdited = false;
    }
  }
  
  onKeyDown(e : KeyboardEvent) {
    if( e.target != document.body ) {
      // input入力時のkey押下は無視する
      return;
    }

    const shiftDown = e.shiftKey;
	const isWindows = checkIsWindows();

    if(e.key === 'Tab' ) {
      this.addChildNode();
      e.preventDefault();
    } else if(e.key === 'Enter' ) {
      if(!e.ctrlKey) {
        this.addSiblingNode();
      } else {
        this.editText();
      }
      e.preventDefault()
    } else if(e.key === 'Backspace' ) {
      this.deleteSelectedNodes();
    } else if(e.key === 'ArrowUp' || (e.key == 'p' && e.ctrlKey)) {
      this.move(MOVE_UP, shiftDown);
    } else if(e.key === 'ArrowDown' || (e.key == 'n' && e.ctrlKey)) {
      this.move(MOVE_DOWN, shiftDown);
    } else if(e.key === 'ArrowRight' || (e.key == 'f' && e.ctrlKey)) {
      this.move(MOVE_RIGHT, shiftDown);
    } else if(e.key === 'ArrowLeft' || (e.key == 'b' && e.ctrlKey)) {
      this.move(MOVE_LEFT, shiftDown);
    } else if(e.key === 'F2') {
      this.editText();
    } else if(e.key == 'i' && e.ctrlKey) {
      this.editText(true)
    } else if(e.key === ' ') {
      this.toggleFold();
      e.preventDefault();
	} else if(e.keyCode == KEYCODE_C && e.ctrlKey && isWindows) {
	  // Original Copy, Paste, Cut short cut is not working on Windows, so
	  // manuall process these commands.
	  this.copy();
	} else if(e.keyCode == KEYCODE_V && e.ctrlKey && isWindows) {
	  this.paste();
	} else if(e.keyCode == KEYCODE_X && e.ctrlKey && isWindows) {
	  this.cut();
	} else if(e.keyCode == KEYCODE_A && e.ctrlKey && isWindows) {
	  this.selectAll();
    } else if(e.keyCode >= 49 && // '1'
      e.keyCode <= 90 && // 'Z'
      !e.ctrlKey &&
      !e.metaKey) {
      this.editText(true);
    } else if(e.key === 'F2') {
      this.editText();
    } else if(e.key === 'F12') {
      this.debug();
    }
  }

  editText(directInput=false) {
    this.textInput.show(this.lastNode, !directInput);
  }
  
  move(direction : number,
       shiftDown : boolean) {
    let node = null;

    if(direction == MOVE_RIGHT) {
      if(!this.lastNode.isLeft) {
        node = this.lastNode.getLatestVisibleChild();
      } else {
        node = this.lastNode.parentNode;
      }

      if(node != null) {
        if(node.isDummy) {
          node = this.rootNode;
        }     
        this.cursorDepth = node.depth
      } else if(this.lastNode.isFolded) {
        this.toggleFold();
      }
    } else if(direction == MOVE_LEFT) {
      if(!this.lastNode.isLeft) {
        if(this.lastNode.isRoot) {
          node = this.leftRootNode.getLatestVisibleChild();
        } else {
          node = this.lastNode.parentNode;
        }
      } else {
        node = this.lastNode.getLatestVisibleChild();
      }
      if(node != null) {
        this.cursorDepth = node.depth
      } else if(this.lastNode.isFolded) {
        this.toggleFold();
      }

    } else if(direction == MOVE_UP) {
      node = this.lastNode.getSibling(true, this.cursorDepth);
    } else {
      node = this.lastNode.getSibling(false, this.cursorDepth);
    }

    if(node != null) {
      if(!shiftDown) {
        this.clearNodeSelection(node, false); // cursorDepthを更新しない
      } else {
        this.setNodeSelected(node, true, false); // cursorDepthを更新しない
      }
    }
  }

  toggleFold() {
    if(!this.lastNode.isRoot) {
      const ret = this.lastNode.toggleFolded();
      if(ret) {
        this.clearNodeSelection(this.lastNode);
        this.updateLayout();
        this.storeState();
      }
    }
  }

  getLocalPos(e : MouseEvent) {
    const rect = this.svg.getBoundingClientRect();
    const pos = this.svg.createSVGPoint();
    pos.x = e.clientX - rect.left;
    pos.y = e.clientY - rect.top;
    const canvasLocalPos = pos.matrixTransform(this.canvas.getScreenCTM().inverse());
    return canvasLocalPos;
  }
  
  addChildNode() {
    const g = document.getElementById('nodes');
    
    let isLeft;
    let parentNode;
    if(this.lastNode.isRoot && this.lastNode.hasChildren) {
      // leftRootの子にする
      isLeft = true;
      parentNode = this.leftRootNode;
    } else {
      isLeft = this.lastNode.isLeft;
      parentNode = this.lastNode;
    }

    const node = new Node(parentNode, g, this.config, isLeft);
    this.nodes.push(node);
    parentNode.addChildNode(node);
    
    this.clearNodeSelection(node);
    
    this.updateLayout();
    
    this.textInput.show(node);
  }
  
  addSiblingNode() {
    if(this.lastNode.isRoot) {
      this.addChildNode();
    } else {
      const g = document.getElementById('nodes');
      const oldLastNode = this.lastNode;
      const parentNode = this.lastNode.parent;

      const node = new Node(parentNode, g, this.config, oldLastNode.isLeft);
      this.nodes.push(node);
      parentNode.addChildNodeBelow(node, oldLastNode);
      
      this.clearNodeSelection(node);
      
      this.updateLayout();
      
      this.textInput.show(node);
    }
  }
  
  updateLayout() {
    // 各NodeのtopY, bottomY, locateOffsetを更新
    this.rootNode.updateYBounds();
    this.leftRootNode.updateYBounds();
    
    // 各Nodeのx,yを更新する
    this.rootNode.updateLayout(null, null);
    this.leftRootNode.updateLayout(null, null);
  }
  
  deleteNode(node : Node) {
    const parentNode = node.parent;

    const removeNodeCallback = (node : Node) => {
      // nodes[]から削除する
      const nodeIndex = this.nodes.indexOf(node);
      if(nodeIndex >= 0) {
        this.nodes.splice(nodeIndex, 1);
      }
    }

    node.remove(removeNodeCallback);
    
    if(parentNode != null) {
      this.updateLayout();
    }
  }

  get lastNode() : Node {
    return this.selectedNodes[this.selectedNodes.length-1];
  }

  setNodeSelected(node : Node,
                  selected : boolean,
                  updateCursorDepth=true) {
    if(node.isSelected != selected) {
      node.setSelected(selected);
      
      if(selected) {
        // selectedにしたのでselectedNodes[]に追加
        this.selectedNodes.push(node);
      } else {
        // selectedを外したのでselectedNodesから削除
        const nodeIndex = this.selectedNodes.indexOf(node);
        if(nodeIndex >= 0) {
          this.selectedNodes.splice(nodeIndex, 1);
        }
      }
    } else if(node.isSelected) {
      // nodeを最後に持ってくる
      const nodeIndex = this.selectedNodes.indexOf(node);
      if(nodeIndex >= 0) {
        this.selectedNodes.splice(nodeIndex, 1);
      }
      this.selectedNodes.push(node);
    }

    if(selected && updateCursorDepth) {
      this.cursorDepth = node.depth;
    }
  }

  clearNodeSelection(leftNode : Node,
                     updateCursorDepth=true) {
    this.selectedNodes.forEach(node => {
      node.setSelected(false);
    })
    this.selectedNodes = []
    
    this.selectedNodes.push(leftNode);
    leftNode.setSelected(true);

    if(updateCursorDepth) {
      this.cursorDepth = leftNode.depth;
    }
  }

  deleteSelectedNodes() {
    let modified = false;
    
    this.selectedNodes.forEach(node => {
      // ノードを削除
      if(!node.isRoot) {
        this.deleteNode(node);
        modified = true
      } else {
        if(!node.isSelected) {
          node.setSelected(false);
        }
      }
    })
    
    this.selectedNodes = [];
    
    let targetNode = this.nodes[this.nodes.length-1];
    if(targetNode.isDummy) {
      targetNode = this.nodes[this.nodes.length-2];
    }
    
    this.setNodeSelected(targetNode, true);
    
    this.updateLayout();

    if(modified) {
      this.storeState();
    }
  }

  cut() {
    this.copy();
    this.deleteSelectedNodes();
  }

  onTextDecided(node : Node, changed : boolean) {
    this.cursorDepth = node.depth;
    if( changed ) {
      // 文字列が変更された場合
      this.updateLayout();
      
      // undoバッファ対応
      this.storeState();

      // ファイル新規保存時用にファイル名設定
      if(node.isRoot && !node.isDummy) {
        if(node.text.length > 0) {
          nmAPI.sendMessage('set-root-text', node.text);
        } else {
          nmAPI.sendMessage('set-root-text', null);
        }
      }
    }
  }

  clearAllNodes() {
    const oldLeftRootNode = this.leftRootNode;
    this.deleteNode(oldLeftRootNode);
    
    const oldRightRootNode = this.rootNode;
    this.deleteNode(oldRightRootNode);

    this.rootNode = null;
    this.leftRootNode = null;
  }

  storeState() {
    const state = this.getState();
    this.editHistory.addHistory(state);
    
    this.setDirty();
  }

  applyNodeState(state : StateType,
                 parentNode : Node | null) {
    
    let node : Node|null = null;
    
    if(parentNode == null) {
      const g = document.getElementById('overlay');
      if(!state['isLeft'] ) {
        // TOOD: 要整理
        node = new Node(null, g, this.config);
        this.rootNode = node;
      } else {
        // TOOD: 要整理 (isLeftを後で再設定されている？)
        node = new Node(null, g, this.config, true, this.rootNode);
        this.leftRootNode = node;
      }
      // ここではまだapplyState(state)しない
      this.nodes.push(node);
    } else {
      const g = document.getElementById('nodes');
      node = new Node(parentNode, g, this.config);
      // ここではまだapplyState(state)しない
      this.nodes.push(node);
      parentNode.addChildNode(node);
    }
    
    state.children.forEach((childState : StateType) => {
      this.applyNodeState(childState, node);
    })

    // folded反映の関係でchildrendにstateを適用した後にこのnodeのstateを適用する
    node.applyState(state);
    
    if(node.isSelected) {
      this.selectedNodes.push(node);
    }    
  }

  applyMapState(state : StateType) {
    this.clearAllNodes();

    this.init();

    this.applyNodeState(state['right'], null);
    this.applyNodeState(state['left'], null);

    this.cursorDepth = this.lastNode.depth;

    this.updateLayout();
  }
  
  newFile() {
    this.clearAllNodes();
    
    this.init();
    
    this.addRootNode();
    this.editHistory = new EditHistory(this.getState());
  }

  getState() {
    const mapState = {
      'right' : this.rootNode.getState(),
      'left' : this.leftRootNode.getState(),
    };
    return mapState;
  }

  load(state : StateType) {
    this.applyMapState(state);
    
    this.editHistory = new EditHistory(state);

    // load後にrecenterしておく
    this.recenter();
  }

  save() {
    const state = this.getState();
    nmAPI.sendMessage('response-save', state);
  }

  export() {
    const state = this.getState();
    nmAPI.sendMessage('response-export', state);
  }
  
  undo() {
    const state = this.editHistory.undo();
    if( state != null ) {
      this.applyMapState(state);
    }
  }

  redo() {
    const state = this.editHistory.redo();
    if( state != null ) {
      this.applyMapState(state);
    }
  }

  collectCopiableNodes() {
    const candidateNodes = new Array<Node>();
    this.selectedNodes.forEach(node => {
      if(!node.isRoot) {
        candidateNodes.push(node);
      }
    })

    const copiableNodes = new Array<Node>();
    candidateNodes.forEach(node => {
      // 親にcandidateNodesが含まれていなければcopy可能とする
      if(node.checkCopiable(candidateNodes)) {
        copiableNodes.push(node);
      }
    })

    return copiableNodes;
  }

  copy() {
    const nodes = this.collectCopiableNodes();
    const copyingStates = new Array<StateType>();
    nodes.forEach(node => {
      copyingStates.push(node.getState());
    })
    this.copyingStates = copyingStates;
  }

  modifyStateForCopy(state : StateType,
                     isLeft : boolean) {
    state['isLeft'] = isLeft;
    state['selected'] = false;
    state['folded'] = false;

    const childrenState : Array<StateType> = state['children'];

    childrenState.forEach((childState : StateType) => {
      this.modifyStateForCopy(childState, isLeft);
    })
  }

  paste() {
    const parentNode = this.lastNode;
    const isLeft = parentNode.isLeft;

    let modified = false;
    
    this.copyingStates.forEach(state => {
      this.modifyStateForCopy(state, isLeft);
      this.applyNodeState(state, parentNode);
      modified = true;
    })
    
    this.updateLayout();

    if(modified) {
      this.storeState();
    }
  }

  selectAll() {
    this.selectedNodes = []
    this.nodes.forEach(node => {
      if(!node.isDummy) {
        node.setSelected(true);
        this.selectedNodes.push(node);
      }
    })
    this.cursorDepth = 0;
  }

  setDirty() {
    nmAPI.sendMessage('set-dirty', null);
  }

  debugDump() {
    console.log('---------')
    for(let i=0; i<this.nodes.length; i++) {
      const node = this.nodes[i];
      node.debugDump();
    }
  }

  debug() {
    this.debugDump();
  }
}
