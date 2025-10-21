document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("fileinput");
  const preview = document.getElementById("preview");
  const compareFile = document.getElementById("compare-file");
  const comparePreview = document.getElementById("compare-preview");

  // --- Hiển thị preview ảnh chính ---
  fileInput.addEventListener("change", (e) => {
    preview.innerHTML = "";
    const f = e.target.files[0];
    if (!f) return;

    const img = document.createElement("img");
    img.src = URL.createObjectURL(f);
    preview.appendChild(img);
  });
  // --- Hiển thị preview ảnh so sánh ---
  compareFile.addEventListener("change", (e) => {
    comparePreview.innerHTML = "";
    const f = e.target.files[0];
    if (!f) return;

    const img = document.createElement("img");
    img.src = URL.createObjectURL(f);
    comparePreview.appendChild(img);
  });
});
