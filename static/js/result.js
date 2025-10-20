// ------------------ main async ------------------
(async function() {
  // --- Wait for filename ---
  while (!window.filename) await new Promise(r => setTimeout(r, 100));
  const filename = window.filename;
  const apiUrl = `/api/result/${filename}`;

  try {
    const resp = await fetch(apiUrl);
    if (!resp.ok) throw new Error(`Failed to load analysis data (status ${resp.status})`);
    const data = await resp.json();
    window.rekognitionData = data;

    // Map sections to keys & renderer
    const sections = {
      labels: {keys:['labels','Labels'], render: renderLabels, emptyMsg: "Không phát hiện được nhãn đối tượng nào trong ảnh."},
      faces: {keys:['faces','Faces','FaceDetails'], render: renderFaces, emptyMsg: "Không phát hiện được khuôn mặt nào."},
      celebrities: {keys:['celebrities','CelebrityFaces'], render: renderCelebrities, emptyMsg: "Không nhận dạng được người nổi tiếng nào."},
      ppe: {keys:['ppe','Persons'], render: renderPPE, emptyMsg: "Không phát hiện được thiết bị bảo hộ."},
      text: {keys:['text','TextDetections'], render: renderText, emptyMsg: "Không nhận diện được đoạn văn bản nào."},
      moderation: {keys:['moderation','ModerationLabels'], render: renderModeration, emptyMsg: "Không phát hiện nội dung nhạy cảm."},
      compare: {keys:['face_matches','FaceMatches'], render: renderCompare, emptyMsg: "Không tìm thấy khuôn mặt trùng khớp."}
    };

    for (const [sec, cfg] of Object.entries(sections)) {
      const arr = pickFirstArray(data, cfg.keys);
      const errMsg = data[`${sec}_error`] || null;
      renderSectionKeep(`${sec}-section`, arr, cfg.render, errMsg, cfg.emptyMsg);
    }

    // Vẽ tất cả bounding boxes
    drawAllBoundingBoxes(data);

    document.dispatchEvent(new Event("rekognitionDataReady"));

  } catch (err) {
    console.error(err);
    document.querySelector(".col-lg-7").innerHTML = `
      <div class="alert alert-danger mt-3">
        ❌ Lỗi khi tải kết quả: ${escapeHtml(err.message)}
      </div>`;
  }
})();

// ------------------ helpers ------------------
function pickFirstArray(obj, keys) {
  for (const k of keys) {
    if (!obj) continue;
    const v = obj[k];
    if (Array.isArray(v)) return v.length ? v : null;
    if (v && typeof v === 'object') return [v];
  }
  return null;
}

function renderSectionKeep(sectionId, dataArray, renderFn, errorMsg, emptyMessage) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  const content = section.querySelector('.content');
  section.style.display = 'block';

  if (errorMsg) {
    content.innerHTML = `<div class="text-danger">⚠️ Lỗi: ${escapeHtml(String(errorMsg))}</div>`;
    return;
  }

  if (!dataArray || dataArray.length === 0) {
    content.innerHTML = `<div class="text-muted fst-italic">⚠️ ${emptyMessage}</div>`;
    return;
  }

  content.innerHTML = renderFn(dataArray);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"'`=\/]/g, s => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;','/':'&#x2F;','`':'&#x60;','=':'&#x3D;'
  })[s]);
}

// ------------------ renderers ------------------
function renderLabels(labels) {
  setTimeout(() => {
    const names = labels.slice(0,10).map(l => l.Name);
    const confs = labels.slice(0,10).map(l => Math.round(l.Confidence));
  }, 0);

  return `
    <div class="mt-2">
      ${labels.map(l => `<div class="d-flex justify-content-between py-1 border-bottom">
        <div><strong>${escapeHtml(l.Name)}</strong></div>
        <div>${Math.round(l.Confidence||0)}%</div>
      </div>`).join('')}
    </div>`;
}

function renderFaces(faces) {
  return faces.map((f,i)=>`
    <div class="border-bottom py-2">
      <strong>Khuôn mặt #${i+1}</strong>
      <div>Độ tin cậy: ${(f.Confidence||0).toFixed(1)}%</div>
      <div>Độ tuổi: ${f.AgeRange ? `${f.AgeRange.Low} - ${f.AgeRange.High}` : 'N/A'}</div>
      <div>Cảm xúc: ${(f.Emotions||[]).slice(0,3).map(e=>`${e.Type} (${Math.round(e.Confidence)}%)`).join(', ')}</div>
    </div>`).join('');
}

function renderCelebrities(items) {
  return items.map(c=>`
    <div class="border-bottom py-2">
      <strong>${escapeHtml(c.Name || c.name)}</strong>
      <div>Độ tin cậy: ${(c.MatchConfidence||c.Confidence||0).toFixed(1)}%</div>
      ${c.Urls && c.Urls[0] ? `<div><a href="${/^https?:\/\//i.test(c.Urls[0]) ? c.Urls[0] : 'https://'+c.Urls[0]}" target="_blank" rel="noopener noreferrer">Xem thêm</a></div>` : ''}
    </div>`).join('');
}

function renderPPE(persons) {
  return persons.map((p,i)=>{
    const parts = (p.BodyParts||[]).flatMap(pt => 
      (pt.EquipmentDetections||[]).map(eq => `${pt.Name}: ${eq.Type} - ${(eq.CoversBodyPart?'✅':'❌')}`)
    );
    return `<div class="border-bottom py-2"><strong>Người ${i+1}</strong><div>${parts.join('<br>')}</div></div>`;
  }).join('');
}

function renderText(items) {
  const lines = (items||[]).filter(t=>t.Type==='LINE').map(t=>t.DetectedText);
  if (lines.length) return lines.map(l=>`<div>${escapeHtml(l)}</div>`).join('');
  return (items||[]).map(t=>escapeHtml(t.DetectedText||t)).join('');
}

function renderModeration(items) {
  return items.map(m=>`<div class="border-bottom py-1">${escapeHtml(m.Name)} — ${(m.Confidence||0).toFixed(1)}%</div>`).join('');
}

function renderCompare(items) {
  if (!items || !items.length) return '<div class="text-muted">⚠️ Không tìm thấy khuôn mặt trùng khớp nào.</div>';
  return items.map((m,i)=>`<div class="border-bottom py-1"><strong>Match ${i+1}</strong> — Similarity: ${(m.Similarity||0).toFixed(1)}%</div>`).join('');
}

// ------------------ Plotly bar helper ------------------
function renderPlotlyBar(containerId, labels, values) {
  const container = document.getElementById(containerId);
  if (!container) return;
  Plotly.newPlot(container, [{x: values, y: labels, type:'bar', orientation:'h'}], {margin:{l:150}}, {displayModeBar:false});
}

// ------------------ draw bounding boxes ------------------
function drawAllBoundingBoxes(data) {
  const imgId = 'main-image';
  const boxes = [];

  // Faces
  if (data.faces) boxes.push(...data.faces.map(f => ({...f.BoundingBox, color:'lime'})).filter(Boolean));

  // PPE
  if (data.ppe) {
    const ppeBoxes = data.ppe.flatMap(p =>
      (p.BodyParts||[]).flatMap(pt => (pt.EquipmentDetections||[]).map(eq => ({...eq.BoundingBox, color:'orange'})))
    ).filter(Boolean);
    boxes.push(...ppeBoxes);
  }

  // Celebrities
  if (data.celebrities) boxes.push(...data.celebrities.map(c => ({...c.BoundingBox, color:'gold'})).filter(Boolean));

  // Labels (Instances)
  if (data.labels) {
    data.labels.forEach(label => {
      if (label.Instances && label.Instances.length) {
        boxes.push(...label.Instances.map(inst => ({...inst.BoundingBox, color:'cyan'})).filter(Boolean));
      }
    });
  }

  // Text
  if (data.text) {
    data.text.forEach(t => {
      if (t.Geometry && t.Geometry.BoundingBox) {
        boxes.push({...t.Geometry.BoundingBox, color:'magenta'});
      }
    });
  }

  drawBoundingBoxesWithColors(imgId, boxes);
}

function drawBoundingBoxesWithColors(imageId, boxes) {
  const img = document.getElementById(imageId);
  const canvas = document.getElementById('overlay-canvas');
  if (!img || !canvas || !boxes?.length) return;

  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);

  boxes.forEach(b => {
    if (!b) return;
    ctx.strokeStyle = b.color || 'red';
    ctx.lineWidth = 2;
    const x = (b.Left||0) * canvas.width;
    const y = (b.Top||0) * canvas.height;
    const w = (b.Width||0) * canvas.width;
    const h = (b.Height||0) * canvas.height;
    ctx.strokeRect(x, y, w, h);
  });
}
