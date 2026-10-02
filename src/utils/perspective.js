
function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function solveLinearSystem(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[pivot][col])) pivot = row;
    }
    if (Math.abs(M[pivot][col]) < 1e-10) throw new Error("Invalid document corners.");
    [M[col], M[pivot]] = [M[pivot], M[col]];
    const divisor = M[col][col];
    for (let j = col; j <= n; j++) M[col][j] /= divisor;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = M[row][col];
      for (let j = col; j <= n; j++) M[row][j] -= factor * M[col][j];
    }
  }
  return M.map(row => row[n]);
}

export function computeHomography(src, dst) {
  const A = [];
  const b = [];
  for (let i = 0; i < 4; i++) {
    const {x, y} = src[i];
    const {x: u, y: v} = dst[i];
    A.push([x,y,1,0,0,0,-u*x,-u*y]); b.push(u);
    A.push([0,0,0,x,y,1,-v*x,-v*y]); b.push(v);
  }
  return solveLinearSystem(A, b);
}

function inverseHomography(h, u, v) {
  const [a,b,c,d,e,f,g,k] = h;
  const A = e - f*k;
  const B = c*k - b;
  const C = b*f - c*e;
  const D = f*g - d;
  const E = a - c*g;
  const F = c*d - a*f;
  const G = d*k - e*g;
  const H = b*g - a*k;
  const I = a*e - b*d;
  const det = a*A + b*D + c*G;
  if (Math.abs(det) < 1e-12) throw new Error("Invalid perspective transform.");
  const x = (A*u + B*v + C) / det;
  const y = (D*u + E*v + F) / det;
  const w = (G*u + H*v + I) / det;
  return {x: x/w, y: y/w};
}

export function perspectiveWarp(sourceCanvas, sourcePoints, options = {}) {
  const [tl,tr,br,bl] = sourcePoints;
  const maxWidth = Math.max(distance(tl,tr), distance(bl,br));
  const maxHeight = Math.max(distance(tl,bl), distance(tr,br));
  const maxW = options.maxWidth || 2400;
  const maxH = options.maxHeight || 3200;
  const scale = Math.min(1, maxW/Math.max(1,maxWidth), maxH/Math.max(1,maxHeight));
  const outW = Math.max(1, Math.round(maxWidth*scale));
  const outH = Math.max(1, Math.round(maxHeight*scale));

  const dst = [
    {x:0,y:0},{x:outW-1,y:0},
    {x:outW-1,y:outH-1},{x:0,y:outH-1}
  ];
  const h = computeHomography(sourcePoints, dst);
  const output = document.createElement("canvas");
  output.width = outW; output.height = outH;
  const outCtx = output.getContext("2d", {willReadFrequently:true});
  const outData = outCtx.createImageData(outW,outH);
  const srcCtx = sourceCanvas.getContext("2d", {willReadFrequently:true});
  const srcData = srcCtx.getImageData(0,0,sourceCanvas.width,sourceCanvas.height);

  for (let y=0; y<outH; y++) {
    for (let x=0; x<outW; x++) {
      const p = inverseHomography(h,x,y);
      const di=(y*outW+x)*4;
      if (p.x<0 || p.y<0 || p.x>=sourceCanvas.width-1 || p.y>=sourceCanvas.height-1) {
        outData.data[di]=255; outData.data[di+1]=255; outData.data[di+2]=255; outData.data[di+3]=255;
        continue;
      }
      const x0=Math.floor(p.x), y0=Math.floor(p.y);
      const x1=Math.min(x0+1,sourceCanvas.width-1), y1=Math.min(y0+1,sourceCanvas.height-1);
      const dx=p.x-x0, dy=p.y-y0;
      for (let c=0;c<4;c++) {
        const p00=srcData.data[(y0*sourceCanvas.width+x0)*4+c];
        const p10=srcData.data[(y0*sourceCanvas.width+x1)*4+c];
        const p01=srcData.data[(y1*sourceCanvas.width+x0)*4+c];
        const p11=srcData.data[(y1*sourceCanvas.width+x1)*4+c];
        const top=p00+(p10-p00)*dx;
        const bottom=p01+(p11-p01)*dx;
        outData.data[di+c]=Math.round(top+(bottom-top)*dy);
      }
    }
  }
  outCtx.putImageData(outData,0,0);
  return output;
}
