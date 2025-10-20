// // visualize.js (clean & consistent overlays)
// (function () {
//   function $(id) { return document.getElementById(id); }

//   function relToCanvas(box, imgEl, canvasEl) {
//     const scaleX = canvasEl.width / imgEl.naturalWidth;
//     const scaleY = canvasEl.height / imgEl.naturalHeight;
//     return {
//       x: box.Left * imgEl.naturalWidth * scaleX,
//       y: box.Top * imgEl.naturalHeight * scaleY,
//       w: box.Width * imgEl.naturalWidth * scaleX,
//       h: box.Height * imgEl.naturalHeight * scaleY
//     };
//   }

//   // ========== DRAW OVERLAYS ==========
//   function drawCanvasOverlays(imgEl, canvasEl, detections) {
//     if (!imgEl || !canvasEl) return;
//     canvasEl.width = imgEl.clientWidth;
//     canvasEl.height = imgEl.clientHeight;
//     canvasEl.style.position = 'absolute';
//     canvasEl.style.left = imgEl.offsetLeft + 'px';
//     canvasEl.style.top = imgEl.offsetTop + 'px';

//     const ctx = canvasEl.getContext('2d');
//     ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
//     ctx.lineWidth = 2;
//     ctx.font = '14px Arial';

//     const drawBox = (box, color, label) => {
//       if (!box) return;
//       const b = relToCanvas(box, imgEl, canvasEl);
//       ctx.strokeStyle = color;
//       ctx.strokeRect(b.x, b.y, b.w, b.h);
      
//       // Add label if provided
//       if (label) {
//         ctx.fillStyle = color;
//         ctx.fillRect(b.x - 1, b.y - 20, ctx.measureText(label).width + 10, 20);
//         ctx.fillStyle = 'white';
//         ctx.fillText(label, b.x + 4, b.y - 5);
//       }
//     };

//     // Faces - highlight facial features and emotions
//     (detections.faces || []).forEach((f, i) => {
//       const conf = f.Confidence ? `${Math.round(f.Confidence)}%` : '';
//       const emotions = f.Emotions ? f.Emotions[0]?.Type : '';
//       const label = `Face ${i + 1} ${emotions ? `(${emotions})` : ''} ${conf}`;
//       drawBox(f.BoundingBox, 'lime', label);
//     });

//     // Labels - show instance confidence
//     (detections.labels || []).forEach(lab => 
//       (lab.Instances || []).forEach((inst, i) => {
//         const conf = inst.Confidence ? `${Math.round(inst.Confidence)}%` : '';
//         drawBox(inst.BoundingBox, 'deepskyblue', `${lab.Name} ${conf}`);
//       })
//     );

//     // Text - show detected text
//     (detections.text || []).forEach(td => {
//       if (td.Type === 'LINE') {
//         drawBox(td.Geometry?.BoundingBox, 'orange', td.DetectedText);
//       }
//     });

//     // PPE - show equipment types and coverage
//     (detections.ppe || []).forEach((p, i) => {
//       drawBox(p.BoundingBox, 'purple', `Person ${i + 1}`);
//       (p.BodyParts || []).forEach(part =>
//         (part.EquipmentDetections || []).forEach(eq => {
//           const status = eq.CoversBodyPart ? '✓' : '✗';
//           drawBox(eq.BoundingBox, eq.CoversBodyPart ? 'lime' : 'red', 
//             `${eq.Type} ${status}`);
//         })
//       );
//     });

//     // Celebrities - show name and confidence
//     (detections.celebrities || []).forEach(c => {
//       const conf = c.MatchConfidence ? `${Math.round(c.MatchConfidence)}%` : '';
//       drawBox(c.Face?.BoundingBox, 'gold', `${c.Name} ${conf}`);
//     });

//     // Face matches for comparison
//     (detections.face_matches || []).forEach((m, i) => {
//       const similarity = Math.round(m.Similarity);
//       drawBox(m.Face?.BoundingBox, 'cyan', `Match ${similarity}%`);
//     });
//   }

//   // ========== FEATURE RENDERERS ==========
//   function renderLabels(data) {
//     const el = $('labels-section');
//     if (!el) return;
//     const labels = data.labels || [];
//     el.innerHTML = '<strong>Labels</strong>';
//     if (!labels.length) return el.innerHTML += '<div>No labels detected.</div>';
//     el.innerHTML += '<div id="labels-chart"></div>';
//     const top = labels.slice(0, 10);
//     Plotly.newPlot('labels-chart', [{
//       x: top.map(l => Math.round(l.Confidence)).reverse(),
//       y: top.map(l => l.Name).reverse(),
//       type: 'bar', orientation: 'h',
//       marker: { color: 'rgba(0,120,255,0.7)' }
//     }], { margin: { l: 120 } }, { displayModeBar: false });
//   }

//   function renderCelebrities(data) {
//     const el = $('celebrities-section');
//     const celebs = data.celebrities || [];
//     el.innerHTML = '<strong>Celebrities</strong>';
//     if (!celebs.length) return el.innerHTML += '<div>No celebrities detected.</div>';
//     el.innerHTML += celebs.map(c =>
//       `<div style="margin-top:6px">${c.Name} (${c.MatchConfidence.toFixed(1)}%) ${
//         c.Urls?.[0] ? `<a href="${c.Urls[0]}" target="_blank">Link</a>` : ''
//       }</div>`
//     ).join('');
//   }

//   function renderFaces(data) {
//     const el = $('faces-section');
//     const faces = data.faces || [];
//     el.innerHTML = '<strong>Faces</strong>';
//     if (!faces.length) return el.innerHTML += '<div>No faces detected.</div>';
//     el.innerHTML += faces.map((f, i) => {
//       const age = `${f.AgeRange?.Low ?? '?'}-${f.AgeRange?.High ?? '?'}`;
//       const emos = (f.Emotions || []).slice(0, 2).map(e => e.Type).join(', ');
//       return `<div>Face ${i + 1}: Age ${age}, Emotions: ${emos}</div>`;
//     }).join('');
//   }

//   function renderPPE(data) {
//     const el = $('ppe-section');
//     const persons = data.ppe || [];
//     el.innerHTML = '<strong>PPE Detection</strong>';
//     if (!persons.length) return el.innerHTML += '<div>No PPE detected.</div>';
//     el.innerHTML += persons.map((p, i) => {
//       const parts = p.BodyParts || [];
//       const eqs = parts.flatMap(part => (part.EquipmentDetections || []).map(eq =>
//         `${eq.Type} (${eq.CoversBodyPart ? '✅' : '❌'})`));
//       return `<div>Person ${i + 1}: ${eqs.join(', ')}</div>`;
//     }).join('');
//   }

//   function renderText(data) {
//     const el = $('text-section');
//     const texts = (data.text || []).filter(t => t.Type === 'LINE');
//     el.innerHTML = '<strong>Text Detection</strong>';
//     if (!texts.length) return el.innerHTML += '<div>No text detected.</div>';
//     el.innerHTML += texts.map(t => `<div>${t.DetectedText}</div>`).join('');
//   }

//   function renderModeration(data) {
//     const el = $('moderation-section');
//     const mods = data.moderation || [];
//     el.innerHTML = '<strong>Moderation</strong>';
//     if (!mods.length) return el.innerHTML += '<div>No moderation labels.</div>';
//     el.innerHTML += mods.map(m =>
//       `<div>${m.Name} — ${(m.Confidence || 0).toFixed(1)}%</div>`
//     ).join('');
//   }

//   function renderCompare(data) {
//     const el = $('compare-section');
//     if (!el || !data.compare_image) return;
//     const compareImgData = data.compare_image;
//     const matches = data.face_matches || [];

//     el.innerHTML = `
//       <strong>Face Comparison</strong>
//       <div style="position:relative;display:inline-block">
//         <img id="compare-image" src="${compareImgData.url}" style="max-width:100%;border-radius:6px;">
//         <canvas id="compare-overlay"></canvas>
//       </div>
//       <div style="margin-top:8px">
//         ${matches.length ? matches.map(m => `<div>${m.Similarity.toFixed(1)}%</div>`).join('') : '<div>No matches found.</div>'}
//       </div>
//     `;

//     const compareImg = $('compare-image');
//     const compareCanvas = $('compare-overlay');
//     if (compareImg.complete) drawCanvasOverlays(compareImg, compareCanvas, { faces: matches.map(m => ({ BoundingBox: m.Face?.BoundingBox })) });
//     else compareImg.onload = () => drawCanvasOverlays(compareImg, compareCanvas, { faces: matches.map(m => ({ BoundingBox: m.Face?.BoundingBox })) });
//   }

//   // ========== MAIN ==========
//   function init() {
//     const data = window.rekognitionData || {};
//     const img = $('main-image');
//     const canvas = $('overlay-canvas');
//     if (!img) return;

//     function renderAll() {
//       drawCanvasOverlays(img, canvas, data);
//       renderLabels(data);
//       renderFaces(data);
//       renderCelebrities(data);
//       renderPPE(data);
//       renderText(data);
//       renderModeration(data);
//       renderCompare(data);
//     }

//     if (img.complete) renderAll();
//     else img.onload = renderAll;

//     window.addEventListener('resize', () => {
//       if (img.complete) drawCanvasOverlays(img, canvas, data);
//     });
//   }

//   setTimeout(init, 100);
// })();
