document.querySelectorAll("[data-filter-group]").forEach((group) => {
    const targetSelector = group.getAttribute("data-filter-target");
    const items = targetSelector ? Array.from(document.querySelectorAll(targetSelector)) : [];
    const buttons = Array.from(group.querySelectorAll("[data-filter]"));

    buttons.forEach((button) => {
        button.addEventListener("click", () => {
            const filter = button.getAttribute("data-filter") || "all";
            buttons.forEach((item) => item.classList.toggle("active", item === button));

            items.forEach((item) => {
                const tags = (item.getAttribute("data-tags") || "").split(/\s+/).filter(Boolean);
                const matched = filter === "all" || tags.includes(filter);
                item.classList.toggle("is-hidden", !matched);
            });
        });
    });
});

document.querySelectorAll("[data-quick-message]").forEach((button) => {
    button.addEventListener("click", () => {
        const target = document.querySelector(button.getAttribute("data-target") || "");
        if (!target) {
            return;
        }

        target.value = button.getAttribute("data-quick-message") || "";
        target.focus();
    });
});

document.querySelectorAll("[data-demo-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        const message = form.parentElement?.querySelector("[data-form-message]");
        if (message) {
            message.textContent = "演示页面已收到提交，后续可在此接入真实接口。";
        }
    });
});
