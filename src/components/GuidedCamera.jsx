import { useEffect, useRef, useState } from "react";

const BASE_WIDTH = 0.40;
const BASE_HEIGHT = 0.18;

export default function GuidedCamera({ onCapture, onClose }) {
  const videoRef=useRef(null), streamRef=useRef(null);
  const [error,setError]=useState(""),[ready,setReady]=useState(false);
  const [facingMode,setFacingMode]=useState("environment");
  const [widthScale,setWidthScale]=useState(1),[heightScale,setHeightScale]=useState(1);

  useEffect(()=>{
    let active=true;
    (async()=>{
      try{
        setError(""); setReady(false);
        if(!navigator.mediaDevices?.getUserMedia) throw Error("Camera is not supported.");
        const stream=await navigator.mediaDevices.getUserMedia({
          video:{facingMode:{ideal:facingMode},width:{ideal:1920},height:{ideal:1080}},audio:false
        });
        if(!active){stream.getTracks().forEach(t=>t.stop());return;}
        streamRef.current=stream; videoRef.current.srcObject=stream;
        await videoRef.current.play(); setReady(true);
      }catch(e){setError(e?.message||"Camera could not be opened.");}
    })();
    return()=>{active=false;streamRef.current?.getTracks().forEach(t=>t.stop());streamRef.current=null;};
  },[facingMode]);

  function capture(fullPage=false){
    const v=videoRef.current;if(!v||!ready)return;
    const vw=Number(v.videoWidth),vh=Number(v.videoHeight);
    if(vw<2||vh<2){setError("Camera image is not ready.");return;}
    let sx=0,sy=0,cw=vw,ch=vh;
    if(!fullPage){
      cw=Math.max(2,Math.min(vw,Math.round(vw*BASE_WIDTH*widthScale)));
      ch=Math.max(2,Math.min(vh,Math.round(vh*BASE_HEIGHT*heightScale)));
      sx=Math.max(0,Math.round((vw-cw)/2));sy=Math.max(0,Math.round((vh-ch)/2));
    }
    const c=document.createElement("canvas");c.width=cw;c.height=ch;
    const ctx=c.getContext("2d");if(!ctx)return;
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";
    ctx.drawImage(v,sx,sy,cw,ch,0,0,cw,ch);
    c.toBlob(blob=>{
      if(!blob){setError("Could not capture image.");return;}
      onCapture({imageUrl:URL.createObjectURL(blob),width:cw,height:ch,scanMode:fullPage?"full":"rectangle"});
    },"image/jpeg",0.94);
  }

  const fw=Math.min(92,BASE_WIDTH*widthScale*100),fh=Math.min(82,BASE_HEIGHT*heightScale*100);
  return <div className="fixed inset-0 z-[100] bg-black text-white">
    <div className="relative h-full w-full overflow-hidden">
      <video ref={videoRef} muted playsInline className="absolute inset-0 h-full w-full object-cover"/>
      <div className="pointer-events-none absolute inset-0 bg-black/45">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" style={{width:`${fw}%`,height:`${fh}%`}}/>
      </div>
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{width:`${fw}%`,height:`${fh}%`}}>
        <div className="absolute inset-0 rounded-xl border-2 border-white/90"/>
        <div className="absolute -left-0.5 -top-0.5 h-8 w-8 rounded-tl-xl border-l-4 border-t-4 border-blue-400"/>
        <div className="absolute -right-0.5 -top-0.5 h-8 w-8 rounded-tr-xl border-r-4 border-t-4 border-blue-400"/>
        <div className="absolute -bottom-0.5 -left-0.5 h-8 w-8 rounded-bl-xl border-b-4 border-l-4 border-blue-400"/>
        <div className="absolute -bottom-0.5 -right-0.5 h-8 w-8 rounded-br-xl border-b-4 border-r-4 border-blue-400"/>
      </div>
      <header className="absolute left-0 right-0 top-0 flex items-center justify-between p-3">
        <button onClick={onClose} className="rounded-full bg-black/55 px-4 py-2 text-sm">Close</button>
        <div className="rounded-full bg-black/55 px-3 py-2 text-xs">Document Scan</div>
        <button onClick={()=>setFacingMode(v=>v==="environment"?"user":"environment")} className="rounded-full bg-black/55 px-3 py-2">↔</button>
      </header>
      {error&&<div className="absolute left-4 right-4 top-20 rounded-xl bg-red-600/90 p-4 text-sm">{error}</div>}
      <div className="absolute bottom-28 left-1/2 z-10 w-[92%] max-w-md -translate-x-1/2 rounded-2xl bg-black/65 p-3 backdrop-blur">
        <div className="grid grid-cols-[44px_1fr] items-center gap-2 text-xs">
          <span>↔ W</span><input type="range" min=".60" max="2.30" step=".05" value={widthScale} onChange={e=>setWidthScale(+e.target.value)}/>
          <span>↕ H</span><input type="range" min=".60" max="3.20" step=".05" value={heightScale} onChange={e=>setHeightScale(+e.target.value)}/>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 to-transparent p-5 pt-20">
        <div className="flex items-center justify-center gap-4">
          <button disabled={!ready} onClick={()=>capture(true)} className="rounded-xl bg-white/15 px-4 py-3 text-xs font-semibold backdrop-blur disabled:opacity-40">📄 Full Page</button>
          <button disabled={!ready} onClick={()=>capture(false)} className="h-20 w-20 rounded-full border-4 border-white bg-white/20 disabled:opacity-40"><span className="mx-auto block h-14 w-14 rounded-full bg-white"/></button>
        </div>
      </div>
    </div>
  </div>;
}
