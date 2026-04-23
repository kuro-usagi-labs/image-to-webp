import os
import threading
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

from PIL import Image  # type: ignore[import-not-found]

try:
    from tkinterdnd2 import DND_FILES, TkinterDnD  # type: ignore[import-not-found]
except Exception:
    DND_FILES = None
    TkinterDnD = None


class PNGToWebPApp:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title("PNG to WebP - Simple Converter")
        self.root.geometry("760x460")
        self.root.minsize(680, 420)

        self.selected_items: list[tuple[str, str]] = []
        self.output_dir = tk.StringVar(value="")
        self.quality = tk.IntVar(value=85)
        self.status_text = tk.StringVar(value="Pilih file PNG, folder PNG, atau drag-and-drop.")
        self.progress_text = tk.StringVar(value="0/0")

        self._build_ui()

    def _build_ui(self) -> None:
        frame = ttk.Frame(self.root, padding=16)
        frame.pack(fill="both", expand=True)

        ttk.Label(
            frame,
            text="PNG to WebP Converter",
            font=("Segoe UI", 15, "bold"),
        ).pack(anchor="w", pady=(0, 12))

        button_row = ttk.Frame(frame)
        button_row.pack(fill="x", pady=4)

        self.select_btn = ttk.Button(button_row, text="Pilih File PNG", command=self.select_files)
        self.select_btn.pack(side="left")

        self.select_folder_btn = ttk.Button(
            button_row, text="Pilih Folder PNG", command=self.select_png_folder
        )
        self.select_folder_btn.pack(side="left", padx=8)

        self.output_btn = ttk.Button(
            button_row, text="Pilih Folder Output", command=self.select_output_folder
        )
        self.output_btn.pack(side="left")

        self.start_btn = ttk.Button(button_row, text="Konversi ke WebP", command=self.start_conversion)
        self.start_btn.pack(side="right")

        self.files_count_label = ttk.Label(frame, text="File terpilih: 0")
        self.files_count_label.pack(anchor="w", pady=(12, 0))

        self.output_label = ttk.Label(frame, text="Folder output: (belum dipilih)")
        self.output_label.pack(anchor="w", pady=(4, 0))

        self.drop_area = tk.Label(
            frame,
            text="Drag & drop file PNG / folder PNG di sini",
            relief="groove",
            borderwidth=2,
            bg="#f7f9fc",
            fg="#2b4a66",
            height=4,
        )
        self.drop_area.pack(fill="x", pady=(12, 4))
        self._setup_drag_and_drop()

        quality_row = ttk.Frame(frame)
        quality_row.pack(fill="x", pady=(12, 6))

        ttk.Label(quality_row, text="Quality WebP:").pack(side="left")
        self.quality_scale = ttk.Scale(
            quality_row,
            from_=1,
            to=100,
            variable=self.quality,
            command=self._update_quality_text,
        )
        self.quality_scale.pack(side="left", fill="x", expand=True, padx=8)

        self.quality_label = ttk.Label(quality_row, text=f"{self.quality.get()}%")
        self.quality_label.pack(side="left")

        self.progress = ttk.Progressbar(frame, orient="horizontal", mode="determinate")
        self.progress.pack(fill="x", pady=(14, 4))

        ttk.Label(frame, textvariable=self.progress_text).pack(anchor="e")

        ttk.Label(
            frame,
            textvariable=self.status_text,
            foreground="#1f5f99",
            wraplength=700,
            justify="left",
        ).pack(fill="x", pady=(12, 0))

    def _setup_drag_and_drop(self) -> None:
        if not DND_FILES or not hasattr(self.drop_area, "drop_target_register"):
            self.drop_area.config(text="Drag & drop nonaktif. Install: pip install tkinterdnd2")
            return

        self.drop_area.drop_target_register(DND_FILES)  # type: ignore[attr-defined]
        self.drop_area.dnd_bind("<<Drop>>", self.on_drop)  # type: ignore[attr-defined]

    def _update_quality_text(self, _event: str | None = None) -> None:
        self.quality_label.config(text=f"{int(self.quality.get())}%")

    def _set_selection(self, entries: list[tuple[str, str]], source_text: str) -> None:
        self.selected_items = entries
        self.files_count_label.config(text=f"File terpilih: {len(self.selected_items)}")

        if self.selected_items and not self.output_dir.get():
            default_output = os.path.join(os.path.dirname(self.selected_items[0][0]), "output_webp")
            self.output_dir.set(default_output)
            self.output_label.config(text=f"Folder output: {default_output}")

        if self.selected_items:
            self.status_text.set(f"Siap dikonversi ({source_text}).")
        else:
            self.status_text.set("Tidak ada file PNG yang dipilih.")

    def _collect_png_from_folder(self, folder: str) -> list[tuple[str, str]]:
        entries: list[tuple[str, str]] = []
        for root_dir, _, files in os.walk(folder):
            rel_dir = os.path.relpath(root_dir, folder)
            rel_dir = "" if rel_dir == "." else rel_dir
            for filename in files:
                if filename.lower().endswith(".png"):
                    entries.append((os.path.join(root_dir, filename), rel_dir))
        return entries

    def select_files(self) -> None:
        files = filedialog.askopenfilenames(
            title="Pilih file PNG",
            filetypes=[("PNG files", "*.png")],
        )
        if not files:
            return

        entries = [(path, "") for path in files if path.lower().endswith(".png")]
        self._set_selection(entries, "dari file")

    def select_png_folder(self) -> None:
        folder = filedialog.askdirectory(title="Pilih folder PNG")
        if not folder:
            return

        entries = self._collect_png_from_folder(folder)
        self._set_selection(entries, "dari folder")

    def select_output_folder(self) -> None:
        folder = filedialog.askdirectory(title="Pilih folder output")
        if not folder:
            return

        self.output_dir.set(folder)
        self.output_label.config(text=f"Folder output: {folder}")
        self.status_text.set("Folder output berhasil dipilih.")

    def on_drop(self, event: tk.Event) -> None:
        raw_data = getattr(event, "data", "")
        paths = self.root.tk.splitlist(raw_data)
        entries: list[tuple[str, str]] = []

        for item in paths:
            norm_path = os.path.normpath(item)
            if os.path.isdir(norm_path):
                entries.extend(self._collect_png_from_folder(norm_path))
            elif os.path.isfile(norm_path) and norm_path.lower().endswith(".png"):
                entries.append((norm_path, ""))

        self._set_selection(entries, "drag-and-drop")

    def start_conversion(self) -> None:
        if not self.selected_items:
            messagebox.showwarning("Peringatan", "Silakan pilih minimal 1 file PNG.")
            return

        output_dir = self.output_dir.get().strip()
        if not output_dir:
            messagebox.showwarning("Peringatan", "Silakan pilih folder output.")
            return

        os.makedirs(output_dir, exist_ok=True)

        self._set_controls_state("disabled")
        self.progress["value"] = 0
        self.progress["maximum"] = len(self.selected_items)
        self.progress_text.set(f"0/{len(self.selected_items)}")
        self.status_text.set("Mulai konversi...")

        worker = threading.Thread(target=self._convert_worker, daemon=True)
        worker.start()

    def _resolve_output_path(self, output_root: str, rel_dir: str, base_name: str) -> str:
        target_dir = os.path.join(output_root, rel_dir) if rel_dir else output_root
        os.makedirs(target_dir, exist_ok=True)

        candidate = os.path.join(target_dir, f"{base_name}.webp")
        if not os.path.exists(candidate):
            return candidate

        index = 1
        while True:
            candidate = os.path.join(target_dir, f"{base_name}_{index}.webp")
            if not os.path.exists(candidate):
                return candidate
            index += 1

    def _convert_worker(self) -> None:
        total = len(self.selected_items)
        success = 0
        failed = 0
        output_root = self.output_dir.get()
        quality = int(self.quality.get())

        for index, (src_path, rel_dir) in enumerate(self.selected_items, start=1):
            base_name = os.path.splitext(os.path.basename(src_path))[0]
            dst_path = self._resolve_output_path(output_root, rel_dir, base_name)

            try:
                with Image.open(src_path) as img:
                    if img.mode in ("RGBA", "LA", "P"):
                        img = img.convert("RGBA")
                    else:
                        img = img.convert("RGB")
                    img.save(dst_path, "WEBP", quality=quality, method=6)

                success += 1
                status = f"Berhasil: {os.path.basename(src_path)}"
            except Exception as exc:
                failed += 1
                status = f"Gagal: {os.path.basename(src_path)} ({exc})"

            self.root.after(0, self._update_progress, index, total, status)

        final_message = (
            f"Selesai. Berhasil: {success}, Gagal: {failed}. "
            f"Hasil ada di: {output_root}"
        )
        self.root.after(0, self._finish_conversion, final_message)

    def _update_progress(self, current: int, total: int, status: str) -> None:
        self.progress["value"] = current
        self.progress_text.set(f"{current}/{total}")
        self.status_text.set(status)

    def _finish_conversion(self, message: str) -> None:
        self._set_controls_state("normal")
        self.status_text.set(message)
        messagebox.showinfo("Konversi selesai", message)

    def _set_controls_state(self, state: str) -> None:
        self.select_btn.config(state=state)
        self.select_folder_btn.config(state=state)
        self.output_btn.config(state=state)
        self.start_btn.config(state=state)
        self.quality_scale.config(state=state)


def main() -> None:
    if TkinterDnD is not None:
        root = TkinterDnD.Tk()
    else:
        root = tk.Tk()
    PNGToWebPApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
