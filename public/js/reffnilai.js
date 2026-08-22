document.addEventListener("DOMContentLoaded", async () => {

    // 🔹 load data awal
    const res = await fetch("/refnilai/get");
    const data = await res.json();

    if (data) {
        Object.keys(data).forEach(key => {
            const input = document.querySelector(`[name=${key}]`);
            if (input) input.value = data[key];
        });
    }

    // 🔹 submit update
    document.getElementById("formRef").addEventListener("submit", async (e) => {
        e.preventDefault();

        const formData = new FormData(e.target);
        const json = Object.fromEntries(formData.entries());

        const res = await fetch("/refnilai/update", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(json)
        });

        const result = await res.json();

        if (result.success) {
            alert("Berhasil disimpan!");
        } else {
            alert("Gagal!");
        }
    });

});