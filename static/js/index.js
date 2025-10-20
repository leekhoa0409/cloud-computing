document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("fileinput");
  const preview = document.getElementById("preview");
  const compareCheck = document.getElementById("enable-compare");
  const compareInput = document.getElementById("compare-input");
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

  // --- Bật/tắt phần compare ---
  compareCheck.addEventListener("change", (e) => {
    const checked = e.target.checked;
    compareInput.style.display = checked ? "block" : "none";

    if (!checked) {
      compareFile.value = "";
      comparePreview.innerHTML = "";
    }
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
