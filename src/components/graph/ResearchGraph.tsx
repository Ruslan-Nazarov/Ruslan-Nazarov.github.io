import {useMemo,useState} from 'react';
import {ReactFlow,ReactFlowProvider,Background,Controls,useReactFlow,MarkerType,Position} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import katex from 'katex';

type GraphNode={
  id:string;title_ru:string;title_en:string;type:string;researchStatus:string;
  formula:string;explanation_ru:string;explanation_en:string;extra_ru?:string;extra_en?:string;
  predecessors:string[];position:{x:number;y:number};tags:string[];hasUnpublishedStructure?:boolean;
  image?:string;links?:{url:string;label_ru:string;label_en:string}[];
};
type Graph={demo:boolean;nodes:GraphNode[];edges:{id:string;source:string;target:string}[]};
type Props={lang:'ru'|'en';t:Record<string,string>;publicData:Graph;demoData:Graph};
function Formula({value}:{value:string}){
  return <span className="graph-formula" dangerouslySetInnerHTML={{__html:katex.renderToString(value,{throwOnError:false,trust:false,maxExpand:1000,strict:'ignore',output:'htmlAndMathml'})}}/>;
}
function Viewer({lang,t,publicData,demoData}:Props){
  const [demo,setDemo]=useState(publicData.nodes.length===0);
  const [query,setQuery]=useState(''),[type,setType]=useState(''),[status,setStatus]=useState(''),[tag,setTag]=useState('');
  const [selected,setSelected]=useState<string|null>(null);
  const [relation,setRelation]=useState('all');
  const flow=useReactFlow();
  const data=demo?demoData:publicData;
  const selectedNode=data.nodes.find(n=>n.id===selected);
  const tags=[...new Set(data.nodes.flatMap(n=>n.tags))];
  const visible=useMemo(()=>data.nodes.filter(n=>(!query||`${n[`title_${lang}`]} ${n.tags.join(' ')}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))&&(!type||type===n.type)&&(!status||status===n.researchStatus)&&(!tag||n.tags.includes(tag))),[data,query,type,status,tag,lang]);
  const visibleIds=new Set(visible.map(n=>n.id));
  const connected=useMemo(()=>{
    const found=new Set<string>();if(!selected)return found;found.add(selected);
    const walk=(id:string,direction:'predecessors'|'descendants')=>{
      const next=data.edges.filter(e=>direction==='predecessors'?e.target===id:e.source===id).map(e=>direction==='predecessors'?e.source:e.target);
      next.forEach(n=>{if(!found.has(n)){found.add(n);walk(n,direction)}});
    };
    if(relation!=='descendants')walk(selected,'predecessors');
    if(relation!=='predecessors')walk(selected,'descendants');
    return found;
  },[selected,relation,data]);
  const nodes=visible.map(n=>({
    id:n.id,position:n.position,selected:n.id===selected,sourcePosition:Position.Right,targetPosition:Position.Left,
    ariaLabel:`${n[`title_${lang}`]}, ${t[n.researchStatus]}`,
    data:{label:<div className="graph-node-content"><span className="node-kicker">{t[n.type]}</span><strong>{n[`title_${lang}`]}</strong><Formula value={n.formula}/><small>{t[n.researchStatus]}</small></div>},
    className:selected&&!connected.has(n.id)?'dim-node':'',
    style:{width:230},
  }));
  const edges=data.edges.filter(e=>visibleIds.has(e.source)&&visibleIds.has(e.target)).map(e=>({
    ...e,markerEnd:{type:MarkerType.ArrowClosed,color:'var(--accent)'},
    style:{stroke:'var(--accent)',strokeWidth:connected.has(e.source)&&connected.has(e.target)?3:1.5,opacity:selected&&(!connected.has(e.source)||!connected.has(e.target))?0.2:1}
  }));
  const choose=(id:string)=>{setSelected(id);flow.fitView({nodes:[{id}],duration:350,maxZoom:1.1,padding:0.8});};
  const reset=()=>{setQuery('');setType('');setStatus('');setTag('');setSelected(null);setRelation('all');setTimeout(()=>flow.fitView({padding:0.15,duration:250}),50)};
  return <section className="graph-app" aria-label={t.graph}>
    <div className="graph-mode"><button type="button" className={!demo?'active':''} aria-pressed={!demo} onClick={()=>{setDemo(false);reset()}}>{t.publicGraph} ({publicData.nodes.length})</button><button type="button" className={demo?'active':''} aria-pressed={demo} onClick={()=>{setDemo(true);reset()}}>{t.demo}</button></div>
    {demo?<p className="notice">{t.demoText}</p>:!data.nodes.length&&<p className="notice">{t.noApproved}</p>}
    <div className="graph-toolbar">
      <label>{t.searchNodes}<input type="search" value={query} onChange={e=>setQuery(e.target.value)}/></label>
      <label>{t.nodeType}<select value={type} onChange={e=>setType(e.target.value)}><option value="">{t.all}</option>{['кризис-разрешение','противоречие','частный_случай','качество'].map(x=><option key={x} value={x}>{t[x]}</option>)}</select></label>
      <label>{t.researchStatus}<select value={status} onChange={e=>setStatus(e.target.value)}><option value="">{t.all}</option>{['подтверждено','черновик','не выведено'].map(x=><option key={x} value={x}>{t[x]}</option>)}</select></label>
      {tags.length>0&&<label>{t.tag}<select value={tag} onChange={e=>setTag(e.target.value)}><option value="">{t.all}</option>{tags.map(x=><option key={x} value={x}>{t['tag:'+x]||x}</option>)}</select></label>}
      <button type="button" className="button secondary" onClick={()=>flow.fitView({duration:300,padding:0.15})}>{t.fit}</button>
      <button type="button" className="text-button" onClick={reset}>{t.reset}</button>
    </div>
    <div className="graph-workspace">
      <div className="graph-canvas" aria-label={t.graph} onKeyDown={event=>{
        if(event.key==='Enter'||event.key===' '){const id=(event.target as HTMLElement).closest('.react-flow__node')?.getAttribute('data-id');if(id){event.preventDefault();setSelected(id)}}
      }}>
        <ReactFlow nodes={nodes} edges={edges} onNodeClick={(_,node)=>setSelected(node.id)} onPaneClick={()=>setSelected(null)}
          fitView fitViewOptions={{padding:0.15}} nodesDraggable={false} nodesConnectable={false} elementsSelectable
          minZoom={0.2} maxZoom={2} colorMode="system"
          ariaLabelConfig={{'controls.ariaLabel':t.graph,'controls.zoomIn.ariaLabel':t.zoomIn,'controls.zoomOut.ariaLabel':t.zoomOut,'controls.fitView.ariaLabel':t.fit,'minimap.ariaLabel':t.graph,'node.a11yDescription.default':t.selectNode,'node.a11yDescription.keyboardDisabled':t.selectNode}}>
          <Background color="var(--line)" gap={22} size={1}/><Controls showInteractive={false}/>
        </ReactFlow>
        {visible.length===0&&<p className="graph-empty">{data.nodes.length?t.noResults:t.noApproved}</p>}
      </div>
      <aside className="graph-detail" aria-live="polite">
        {selectedNode?<>
          <div className="eyebrow">{demo?t.demo:t[selectedNode.type]}</div>
          <h2>{selectedNode[`title_${lang}`]}</h2>
          <span className="badge">{t[selectedNode.researchStatus]}</span>
          <div className="detail-formula"><Formula value={selectedNode.formula}/></div>
          <p>{selectedNode[`explanation_${lang}`]}</p>
          {selectedNode[`extra_${lang}`]&&<p>{selectedNode[`extra_${lang}`]}</p>}
          {selectedNode.image&&<img src={selectedNode.image} alt={selectedNode[`title_${lang}`]}/>}
          {selectedNode.hasUnpublishedStructure&&<p className="notice">{t.hiddenStructure}</p>}
          <label className="relation-filter">{t.allConnections}<select value={relation} onChange={e=>setRelation(e.target.value)}><option value="all">{t.allConnections}</option><option value="predecessors">{t.predecessors}</option><option value="descendants">{t.descendants}</option></select></label>
          <div className="graph-related">{data.nodes.filter(n=>n.id!==selected&&connected.has(n.id)).map(n=><button type="button" key={n.id} onClick={()=>choose(n.id)}>{n[`title_${lang}`]} ↗</button>)}</div>
          {selectedNode.links?.map(link=><a key={link.url} href={link.url} rel="noopener noreferrer">{link[`label_${lang}`]} ↗</a>)}
        </>:<><span className="graph-detail-symbol" aria-hidden="true">∑</span><p>{t.selectNode}</p></>}
        <p className="small muted">{t.modelNote}</p>
      </aside>
    </div>
    <details className="graph-text-list" open>
      <summary>{t.nodeList} ({visible.length})</summary>
      <div>{visible.map(n=><button type="button" key={n.id} aria-pressed={selected===n.id} onClick={()=>choose(n.id)}>{n[`title_${lang}`]}<small>{t[n.researchStatus]}</small></button>)}</div>
    </details>
  </section>
}
export default function ResearchGraph(props:Props){return <ReactFlowProvider><Viewer {...props}/></ReactFlowProvider>}
